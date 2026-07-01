"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { idadeAnos, dataBrParaIso } from "@/lib/idade";
import { capitalizarNome } from "@/lib/nome";
import { chaveTelefoneBR } from "@/lib/telefone";
import {
  perfilPrimario,
  buildDiagnosticosFormais,
  parseDiagnosticosFormais,
} from "@/lib/onboarding/diagnostico";

const dataNascimentoSchema = (minAnos: number, maxAnos: number, msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => {
      const iso = dataBrParaIso(v);
      if (!iso) return false;
      const a = idadeAnos(iso);
      return a !== null && a >= minAnos && a <= maxAnos;
    }, msg);

// ============================================================
// Helpers
// ============================================================

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, onboarding_step")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");

  return { supabase, user, family };
}

async function bumpStep(supabase: Awaited<ReturnType<typeof createClient>>, familyId: string, nextStep: number) {
  const { error } = await supabase
    .from("family_accounts")
    .update({ onboarding_step: nextStep })
    .eq("id", familyId);
  if (error) throw new Error(`Erro ao avançar etapa: ${error.message}`);
  revalidatePath("/onboarding");
}

// ============================================================
// Atribuição de afiliado — lê o cookie kolo_ref (setado por /i/CODIGO) e
// vincula a família ao afiliado, uma única vez. Best-effort: chamada no
// início do onboarding e nunca trava o fluxo.
// ============================================================

export async function atribuirAfiliado(): Promise<void> {
  try {
    const { supabase, user, family } = await requireFamily();

    const { data: fam } = await supabase
      .from("family_accounts")
      .select("afiliado_id")
      .eq("id", family.id)
      .maybeSingle();
    if (fam?.afiliado_id) return; // já atribuído

    const ref = (await cookies()).get("kolo_ref")?.value;
    if (!ref) return;

    const admin = createServiceRoleClient();
    const { data: af } = await admin
      .from("afiliados")
      .select("id, email, ativo")
      .eq("codigo_unico", ref)
      .eq("ativo", true)
      .maybeSingle();
    if (!af) return;

    // Anti auto-indicação: afiliado não pode atribuir o próprio cadastro.
    if (
      af.email &&
      user.email &&
      af.email.toLowerCase() === user.email.toLowerCase()
    ) {
      return;
    }

    await admin
      .from("family_accounts")
      .update({
        afiliado_id: af.id,
        ref_codigo: ref,
        atribuido_em: new Date().toISOString(),
      })
      .eq("id", family.id)
      .is("afiliado_id", null);
  } catch {
    // best-effort — atribuição nunca pode quebrar o onboarding
  }
}

// ============================================================
// Atribuição de UTM — lê o cookie kolo_utm (setado por <UtmCapture/> nas telas
// de cadastro) e grava a origem do anúncio na família, uma única vez. Espelha
// atribuirAfiliado. Best-effort: nunca trava o onboarding.
// ============================================================

export async function atribuirUtm(): Promise<void> {
  try {
    const { supabase, family } = await requireFamily();

    const { data: fam } = await supabase
      .from("family_accounts")
      .select("utm_atribuido_em")
      .eq("id", family.id)
      .maybeSingle();
    if (fam?.utm_atribuido_em) return; // já atribuído

    const raw = (await cookies()).get("kolo_utm")?.value;
    if (!raw) return;

    let utm: Record<string, unknown>;
    try {
      utm = JSON.parse(decodeURIComponent(raw));
    } catch {
      return; // cookie corrompido
    }

    const val = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
    const source = val(utm.utm_source);
    if (!source) return; // sem origem, nada a atribuir

    const admin = createServiceRoleClient();
    await admin
      .from("family_accounts")
      .update({
        utm_source: source,
        utm_medium: val(utm.utm_medium),
        utm_campaign: val(utm.utm_campaign),
        utm_content: val(utm.utm_content),
        utm_term: val(utm.utm_term),
        utm_atribuido_em: new Date().toISOString(),
      })
      .eq("id", family.id)
      .is("utm_atribuido_em", null);
  } catch {
    // best-effort — atribuição nunca pode quebrar o onboarding
  }
}

// ============================================================
// Tela 1 — dados da mãe + WhatsApp
// ============================================================

const tela1Schema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto"),
  data_nascimento_mae: dataNascimentoSchema(16, 100, "Idade deve estar entre 16 e 100 anos"),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "WhatsApp deve estar no formato +DDIDDDNNNNNNNNN"),
  // avó/avô são papéis distintos (gênero implícito); "outro" traz o grau livre.
  papel: z.enum(["mae", "pai", "avo", "avoh", "outro"]),
  papel_outro: z.string().trim().optional(),
  // Só vem preenchido quando "outro" e a palavra não revela o gênero.
  genero_responsavel: z.enum(["masculino", "feminino", "neutro"]).optional(),
}).refine(
  (d) => d.papel !== "outro" || (d.papel_outro && d.papel_outro.length >= 2),
  { path: ["papel_outro"], message: "Diga qual é o grau de parentesco" },
);

export type Tela1Input = z.infer<typeof tela1Schema>;

export async function saveTela1(raw: Tela1Input) {
  const data = tela1Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  // Grau livre só em "outro"; o gênero é inferido da palavra (descricaoCuidador)
  // e só guardamos a escolha explícita quando a palavra foi ambígua.
  const ehOutro = data.papel === "outro";
  const { error: errProfile } = await supabase.from("family_profiles").upsert({
    family_account_id: family.id,
    nome_mae: capitalizarNome(data.nome_mae),
    data_nascimento_mae: dataBrParaIso(data.data_nascimento_mae),
    papel: data.papel,
    papel_outro: ehOutro ? data.papel_outro! : null,
    genero_responsavel: ehOutro ? (data.genero_responsavel ?? null) : null,
  });
  if (errProfile) throw new Error(`Erro ao salvar perfil: ${errProfile.message}`);

  // Impede duas famílias com o mesmo WhatsApp (senão a Ayla responde pra
  // família errada). Compara pela chave normalizada (9º dígito/país). Usa
  // service-role pra enxergar além da própria família (RLS esconderia as
  // outras). É a proteção principal; o índice único no banco é o backstop.
  const chaveNova = chaveTelefoneBR(data.whatsapp_e164);
  if (chaveNova) {
    const admin = createServiceRoleClient();
    const { data: outras } = await admin
      .from("family_accounts")
      .select("id, whatsapp_e164")
      .not("whatsapp_e164", "is", null)
      .neq("id", family.id);
    const conflito = (outras ?? []).some(
      (f) => chaveTelefoneBR(f.whatsapp_e164 as string) === chaveNova,
    );
    if (conflito) {
      throw new Error(
        "Esse número de WhatsApp já está em uso por outra conta. Use o número que você usa no WhatsApp, ou fale com o suporte se achar que é um engano.",
      );
    }
  }

  const { error: errWhats } = await supabase
    .from("family_accounts")
    .update({ whatsapp_e164: data.whatsapp_e164 })
    .eq("id", family.id);
  if (errWhats) {
    // 23505 = unique_violation do índice family_accounts_whatsapp_unico.
    if (errWhats.code === "23505") {
      throw new Error(
        "Esse número de WhatsApp já está em uso por outra conta. Use o número que você usa no WhatsApp, ou fale com o suporte se achar que é um engano.",
      );
    }
    throw new Error(`Erro ao salvar WhatsApp: ${errWhats.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 2));
}

// ============================================================
// Tela 2 — membros atípicos (1+)
// ============================================================

const membroSchema = z
  .object({
    id: z.string().uuid().optional(),
    nome: z.string().trim().min(2, "Nome muito curto"),
    data_nascimento: dataNascimentoSchema(0, 120, "Data de nascimento inválida"),
    diagnosticos: z
      .array(z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"]))
      .min(1, "Escolha ao menos um diagnóstico"),
    diagnostico_outro: z.string().trim().optional(),
    hipoteses: z
      .array(z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro"]))
      .optional()
      .default([]),
    genero: z.enum(["feminino", "masculino"]),
  })
  .refine(
    (m) =>
      !m.diagnosticos.includes("Outro") ||
      (m.diagnostico_outro && m.diagnostico_outro.trim().length >= 2),
    { path: ["diagnostico_outro"], message: "Detalhe qual é o outro diagnóstico" },
  );

const tela2Schema = z.object({
  membros: z.array(membroSchema).min(1, "Cadastre pelo menos 1 criança"),
});

export type Tela2Input = z.infer<typeof tela2Schema>;

type MembroForm = z.infer<typeof membroSchema>;

// Colunas do membro derivadas do form (sem family_account_id — comum a
// insert e update). diagnosticos_formais carrega a lista completa; perfil
// guarda o principal pra compatibilidade.
function camposMembro(m: MembroForm) {
  const sel = {
    diagnosticos: m.diagnosticos,
    outro: m.diagnostico_outro ?? null,
    hipoteses: m.hipoteses ?? [],
  };
  return {
    nome: capitalizarNome(m.nome),
    data_nascimento: dataBrParaIso(m.data_nascimento),
    perfil: perfilPrimario(m.diagnosticos),
    diagnosticos_formais: buildDiagnosticosFormais(sel),
    genero: m.genero,
  };
}

export async function saveTela2(raw: Tela2Input) {
  const data = tela2Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  const novos = data.membros.filter((m) => !m.id);
  const existentes = data.membros.filter((m) => m.id);

  if (novos.length > 0) {
    const { error } = await supabase
      .from("membros_atipicos")
      .insert(novos.map((m) => ({ family_account_id: family.id, ...camposMembro(m) })));
    if (error) throw new Error(`Erro ao cadastrar criança(s): ${error.message}`);
  }

  for (const m of existentes) {
    const { error } = await supabase
      .from("membros_atipicos")
      .update(camposMembro(m))
      .eq("id", m.id!)
      .eq("family_account_id", family.id);
    if (error) throw new Error(`Erro ao atualizar criança: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 3));

  // Retorna a lista canônica do banco — wizard usa esses ids no step 4.
  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil, genero, diagnosticos_formais")
    .eq("family_account_id", family.id)
    .order("created_at", { ascending: true });

  return (membros ?? []).map((m) => {
    const row = m as {
      id: string;
      nome: string;
      data_nascimento: string;
      perfil: string;
      genero: "masculino" | "feminino" | "neutro" | null;
      diagnosticos_formais: unknown;
    };
    const sel = parseDiagnosticosFormais(row.diagnosticos_formais, row.perfil);
    return {
      id: row.id,
      nome: row.nome,
      data_nascimento: row.data_nascimento,
      perfil: row.perfil,
      genero: row.genero,
      diagnosticos: sel.diagnosticos,
      diagnostico_outro: sel.outro,
      hipoteses: sel.hipoteses,
    };
  });
}

export async function removeMembro(membroId: string) {
  const { supabase, family } = await requireFamily();
  await supabase
    .from("membros_atipicos")
    .delete()
    .eq("id", membroId)
    .eq("family_account_id", family.id);
  revalidatePath("/onboarding");
}

// ============================================================
// Tela 3 — contexto familiar (Kolo Vivo Camada 2)
// ============================================================

const tela3Schema = z.object({
  quem_mora: z.array(z.string().trim().min(1)).max(8).default([]),
  quem_mora_outro: z.string().trim().max(200).optional(),
  tem_irmaos: z.enum(["sim", "nao"]),
  irmaos: z
    .array(
      z.object({
        nome: z.string().trim().min(2, "Nome muito curto"),
        data_nascimento: dataNascimentoSchema(0, 120, "Data de nascimento inválida"),
        brinca_junto: z.enum(["sim", "asvezes", "nao"]),
      }),
    )
    .default([]),
  observacao: z.string().trim().optional(),
});

export type Tela3Input = z.infer<typeof tela3Schema>;

export async function saveTela3(raw: Tela3Input) {
  const data = tela3Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  const irmaos =
    data.tem_irmaos === "sim"
      ? data.irmaos.map((i) => ({
          nome: capitalizarNome(i.nome),
          data_nascimento: dataBrParaIso(i.data_nascimento),
          brinca_junto: i.brinca_junto,
        }))
      : [];

  // Guarda irmãos (estruturado, com data de nascimento p/ idade dinâmica) +
  // nota livre opcional dentro de composicao. rotina/recursos/dinamica ficam
  // pra detalhamento futuro — omitidos no upsert pra preservar o que já houver.
  const composicao: Record<string, unknown> = { irmaos };
  if (data.quem_mora.length > 0) composicao.quem_mora = data.quem_mora;
  if (data.quem_mora_outro) composicao.quem_mora_outro = data.quem_mora_outro;
  if (data.observacao) composicao.texto = data.observacao;

  const temAlgo =
    irmaos.length > 0 ||
    data.quem_mora.length > 0 ||
    Boolean(data.quem_mora_outro) ||
    Boolean(data.observacao);
  const { error } = await supabase.from("perfil_vivo_familia").upsert({
    family_account_id: family.id,
    composicao,
    completude_pct: temAlgo ? 50 : 0,
  });
  if (error) throw new Error(`Erro ao salvar contexto: ${error.message}`);

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 4));
}

// ============================================================
// Tela 4 — quick Kolo Vivo (3 desafios + 3 interesses + 1 conquista por membro)
// ============================================================

const quickKoloSchema = z.object({
  membro_id: z.string().uuid(),
  // desafios = "Tema: o que acontece" (até 3). interesses = chips marcados +
  // o campo aberto, então pode passar de 3 — sem limite apertado aqui.
  desafios: z.array(z.string().trim()).max(5),
  interesses: z.array(z.string().trim()).max(30),
  conquista: z.string().trim().optional(),
  rotina: z.string().trim().optional(),
});

const tela4Schema = z.object({
  porMembro: z.array(quickKoloSchema).min(1),
});

export type Tela4Input = z.infer<typeof tela4Schema>;

// Tema do desafio (Passo 4) → domínio do Kolo Vivo (categorias_extras), pra
// cada desafio aparecer no card certo e a Ayla ler por domínio.
const TEMA_PARA_DOMINIO: Record<string, string> = {
  "Comunicação": "comunicacao",
  "Foco": "foco",
  "Socialização": "socializacao",
  "Autonomia": "autonomia",
  "Gestão de emoções": "emocional",
  "Alimentação": "nutricional",
};

// Domínios que viram card na tela do Kolo Vivo (pra calcular completude).
const DOMINIO_KEYS = [
  "sensorial", "nutricional", "comunicacao", "emocional", "foco",
  "sono", "socializacao", "motor", "rotina",
  "autonomia", "aprendizado", "imitacao", "tela_midia", "escola", "saude_geral",
];

export async function saveTela4(raw: Tela4Input) {
  const data = tela4Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  for (const item of data.porMembro) {
    const interesses = item.interesses.filter(Boolean);

    // Distribui cada desafio "Tema: o que acontece" no domínio correspondente.
    const extras: Record<string, unknown> = {};
    const porDominio: Record<string, string[]> = {};
    for (const d of item.desafios.filter(Boolean)) {
      const i = d.indexOf(": ");
      const tema = i >= 0 ? d.slice(0, i) : "";
      const texto = (i >= 0 ? d.slice(i + 2) : d).trim();
      const dominio = TEMA_PARA_DOMINIO[tema];
      if (dominio && texto) (porDominio[dominio] ??= []).push(texto);
    }
    for (const [k, arr] of Object.entries(porDominio)) extras[k] = { texto: arr.join(". ") };
    // Interesses viram os hiperfocos do hero (lidos de preferencias.temas).
    if (interesses.length) extras.preferencias = { temas: interesses };
    if (item.rotina) extras.rotina = { texto: item.rotina };

    const preenchidos = Object.keys(extras).filter((k) => DOMINIO_KEYS.includes(k)).length;

    const { error } = await supabase.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: item.membro_id,
        family_account_id: family.id,
        // como_e mantém os interesses pra Ayla (campo legado que ela já lê).
        como_e: interesses.length ? { interesses } : {},
        essencial: item.conquista ? { conquista_inicial: item.conquista } : {},
        categorias_extras: extras,
        completude_pct: Math.round((preenchidos / DOMINIO_KEYS.length) * 100),
      },
      { onConflict: "membro_atipico_id" },
    );
    if (error) throw new Error(`Erro ao salvar primeiros sinais: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 5));
}

// ============================================================
// Tela 5 — termos + opt-in Ayla
// ============================================================

const tela5Schema = z.object({
  aceitou_termos: z.literal(true, { message: "É preciso aceitar os termos" }),
  optin_ayla: z.boolean(),
});

export type Tela5Input = z.infer<typeof tela5Schema>;

export async function saveTela5(raw: Tela5Input) {
  const data = tela5Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  if (data.optin_ayla) {
    const { error } = await supabase
      .from("ayla_preferences")
      .update({ desativada: false, consentimento_em: new Date().toISOString() })
      .eq("family_account_id", family.id);
    if (error) throw new Error(`Erro ao salvar consentimento da Ayla: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 6));
}

// ============================================================
// Tela 6 — confirmação + escolha de início (fundiu a antiga /boas-vindas)
// ============================================================

// Janelas de WhatsApp → horario_preferido (a tela de chegada virou o Passo 6).
const JANELAS_HORARIO = {
  manha: { inicio: "08:00", fim: "10:00" },
  meio_dia: { inicio: "12:00", fim: "14:00" },
  tarde: { inicio: "15:00", fim: "17:00" },
  noite: { inicio: "19:00", fim: "21:00" },
} as const;

export type JanelaOnboarding = keyof typeof JANELAS_HORARIO;

export async function completeOnboarding(opts?: { janela?: JanelaOnboarding | null }) {
  const { supabase, family } = await requireFamily();
  const { error } = await supabase
    .from("family_accounts")
    .update({
      onboarding_completed: true,
      onboarding_step: 7,
      // Marca a chegada como vista — a /boas-vindas não aparece mais (fundida aqui).
      boas_vindas_vista_at: new Date().toISOString(),
    })
    .eq("id", family.id);
  if (error) throw new Error(`Erro ao concluir onboarding: ${error.message}`);

  // Horário preferido do WhatsApp (só quem autorizou a Ayla escolhe no Passo 6).
  if (opts?.janela && JANELAS_HORARIO[opts.janela]) {
    const j = JANELAS_HORARIO[opts.janela];
    const { error: errPref } = await supabase
      .from("ayla_preferences")
      .upsert(
        {
          family_account_id: family.id,
          horario_preferido_inicio: j.inicio,
          horario_preferido_fim: j.fim,
        },
        { onConflict: "family_account_id" },
      );
    if (errPref) throw new Error(`Erro ao salvar horário: ${errPref.message}`);
  }

  // Dispara a primeira mensagem da Ayla na hora — best-effort.
  // sendBoasVindas já respeita consentimento (LGPD), pausa e idempotência.
  // Usa service-role porque o orchestrator escreve em ayla_send_log
  // (admin-only) e ayla_messages outbound (sem policy de insert para
  // usuário comum). Se Z-API falhar, o erro fica em ayla_send_log e o
  // usuário continua o fluxo normalmente.
  try {
    console.log("[onboarding] → sendBoasVindas family.id =", family.id);
    const admin = createServiceRoleClient();
    const { sendBoasVindas } = await import("@/lib/ayla/orchestrator");
    const r = await sendBoasVindas(admin, family.id);
    console.log("[onboarding] ← sendBoasVindas result:", r);
  } catch (err) {
    console.error("[onboarding] sendBoasVindas threw:", err);
  }

  revalidatePath("/onboarding");
  revalidatePath("/painel");
  revalidatePath("/");
}
