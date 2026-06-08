"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { respond, respondAsOutputType } from "@/lib/ia/engine";
import { gerarPlano } from "@/lib/ia/plano";
import { extrairAtualizacoes, type PropostaAtualizacao } from "@/lib/ia/atualizar";
import { idadeAnos, hojeLocalISO } from "@/lib/idade";
import { requireActiveWrite } from "@/lib/auth/require-active-write";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");
  return { supabase, user, family };
}

const enviarSchema = z.object({
  conversaId: z.string().uuid().nullable(),
  membroAtipicoId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Mensagem vazia").max(2000),
});

export async function enviarMensagem(input: z.infer<typeof enviarSchema>): Promise<{
  conversaId: string;
}> {
  const { conversaId, membroAtipicoId, texto } = enviarSchema.parse(input);
  const { supabase, family } = await requireFamily();

  // Gate de assinatura — bloqueia escrita em paused/canceled
  await requireActiveWrite(family.id);

  // 1. Cria a conversa se for primeira mensagem
  let conversaIdFinal: string;
  if (conversaId) {
    conversaIdFinal = conversaId;
  } else {
    const { data: nova, error } = await supabase
      .from("conversas")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroAtipicoId,
        titulo: texto.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !nova) throw new Error(`Falha ao criar conversa: ${error?.message}`);
    conversaIdFinal = nova.id as string;
  }

  // 2. Persiste mensagem da mãe
  await supabase.from("mensagens_skill").insert({
    conversa_id: conversaIdFinal,
    family_account_id: family.id,
    papel: "user",
    conteudo: texto,
  });

  // 3. Chama o engine
  const resposta = await respond({
    supabase,
    familyId: family.id,
    membroAtipicoId,
    conversaId: conversaIdFinal,
    userInput: texto,
  });

  // 4. Persiste resposta do assistente
  await supabase.from("mensagens_skill").insert({
    conversa_id: conversaIdFinal,
    family_account_id: family.id,
    papel: "assistant",
    conteudo: resposta.texto,
    skills_acionadas: resposta.skillsAcionadas,
    metadata: { validacao: resposta.validacao, intencao: resposta.intencao },
    tokens_input: resposta.uso.tokens_input,
    tokens_output: resposta.uso.tokens_output,
  });

  revalidatePath("/conversar");
  if (conversaIdFinal !== conversaId) {
    revalidatePath(`/conversar/${conversaIdFinal}`);
  }

  return { conversaId: conversaIdFinal };
}

// ============================================================
// Streaming — cria conversa / adiciona mensagem do usuário (a resposta
// da Kolo vem via /api/conversar/stream).
// ============================================================

const criarConversaSchema = z.object({
  membroAtipicoId: z.string().uuid().nullable(),
  texto: z.string().trim().min(1, "Mensagem vazia").max(2000),
});

export async function criarConversa(
  input: z.infer<typeof criarConversaSchema>,
): Promise<{ conversaId: string }> {
  const { membroAtipicoId, texto } = criarConversaSchema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  const { data: nova, error } = await supabase
    .from("conversas")
    .insert({
      family_account_id: family.id,
      membro_atipico_id: membroAtipicoId,
      titulo: texto.slice(0, 80),
    })
    .select("id")
    .single();
  if (error || !nova) throw new Error(`Falha ao criar conversa: ${error?.message}`);

  await supabase.from("mensagens_skill").insert({
    conversa_id: nova.id,
    family_account_id: family.id,
    papel: "user",
    conteudo: texto,
  });

  return { conversaId: nova.id as string };
}

const adicionarMsgSchema = z.object({
  conversaId: z.string().uuid(),
  texto: z.string().trim().min(1, "Mensagem vazia").max(2000),
});

export async function adicionarMensagemUsuario(
  input: z.infer<typeof adicionarMsgSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { conversaId, texto } = adicionarMsgSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id")
      .eq("id", conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return { ok: false, error: "Conversa não encontrada." };

    const { error } = await supabase.from("mensagens_skill").insert({
      conversa_id: conversaId,
      family_account_id: family.id,
      papel: "user",
      conteudo: texto,
    });
    if (error) return { ok: false, error: `Falha ao enviar: ${error.message}` };

    revalidatePath(`/conversar/${conversaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ============================================================
// Mais ajuda na conversa — gera um output_type sobre o MESMO tema,
// sem o usuário redigitar o problema. Vira uma nova mensagem da Kolo.
// ============================================================

export type AcaoResult = { ok: true } | { ok: false; error: string };

/**
 * Apaga uma conversa da família (cascata leva as mensagens). Ação da
 * própria usuária na lista de conversas anteriores.
 */
export async function deletarConversa(
  input: { conversaId: string },
): Promise<AcaoResult> {
  try {
    const { conversaId } = z.object({ conversaId: z.string().uuid() }).parse(input);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("conversas")
      .delete()
      .eq("id", conversaId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: `Falha ao apagar: ${error.message}` };
    revalidatePath("/estrategias");
    revalidatePath("/conversar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const apoioSchema = z.object({
  conversaId: z.string().uuid(),
  outputTypeKey: z.string().min(1),
});

export async function pedirApoioNaConversa(
  input: z.infer<typeof apoioSchema>,
): Promise<AcaoResult> {
  try {
    const { conversaId, outputTypeKey } = apoioSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, membro_atipico_id")
      .eq("id", conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return { ok: false, error: "Conversa não encontrada." };

    const { data: tipo } = await supabase
      .from("output_types")
      .select("key, label, prompt_template")
      .eq("key", outputTypeKey)
      .eq("ativo", true)
      .maybeSingle();
    if (!tipo) return { ok: false, error: "Tipo de ajuda não encontrado." };

    // Reaproveita o contexto: o "pedido" é o que o adulto já contou na conversa.
    const { data: msgs } = await supabase
      .from("mensagens_skill")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    const pedido =
      (msgs ?? [])
        .filter((m) => m.papel === "user")
        .map((m) => m.conteudo as string)
        .join("\n")
        .slice(0, 1800) || "Sobre o tema desta conversa.";

    const resposta = await respondAsOutputType({
      supabase,
      familyId: family.id,
      membroAtipicoId: conversa.membro_atipico_id as string | null,
      outputType: {
        key: tipo.key,
        label: tipo.label,
        prompt_template: tipo.prompt_template,
      },
      pedido,
    });

    const { error } = await supabase.from("mensagens_skill").insert({
      conversa_id: conversaId,
      family_account_id: family.id,
      papel: "assistant",
      conteudo: resposta.texto,
      skills_acionadas: resposta.skillsAcionadas,
      output_type: tipo.key,
      tokens_input: resposta.uso.tokens_input,
      tokens_output: resposta.uso.tokens_output,
    });
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

    revalidatePath(`/conversar/${conversaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ============================================================
// Plano completo — monta UM plano (por seções) sobre o tema da conversa,
// numa única chamada. Salvo em `planos`; a tela /planos/[id] renderiza.
// ============================================================

export async function criarPlanoDaConversa(
  input: { conversaId: string },
): Promise<{ ok: true; planoId: string } | { ok: false; error: string }> {
  try {
    const { conversaId } = z.object({ conversaId: z.string().uuid() }).parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, membro_atipico_id")
      .eq("id", conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return { ok: false, error: "Conversa não encontrada." };

    const { data: msgs } = await supabase
      .from("mensagens_skill")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    const desafio =
      (msgs ?? [])
        .filter((m) => m.papel === "user")
        .map((m) => m.conteudo as string)
        .join("\n")
        .slice(0, 1800) || "Sobre o tema desta conversa.";

    const plano = await gerarPlano({
      supabase,
      familyId: family.id,
      membroAtipicoId: conversa.membro_atipico_id as string | null,
      desafio,
      conversaId,
    });

    revalidatePath("/planos");
    return { ok: true, planoId: plano.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ============================================================
// Atualizar — a IA propõe o que registrar (Kolo Vivo / conquista /
// desafio). proporAtualizacao só LÊ; confirmarAtualizacao grava o que
// o usuário deixou marcado no preview.
// ============================================================

export type PropostaResult =
  | { ok: true; proposta: PropostaAtualizacao; temMembro: boolean }
  | { ok: false; error: string };

const conversaIdSchema = z.object({ conversaId: z.string().uuid() });

export async function proporAtualizacao(
  input: z.infer<typeof conversaIdSchema>,
): Promise<PropostaResult> {
  try {
    const { conversaId } = conversaIdSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, membro_atipico_id, membros_atipicos(nome, data_nascimento, perfil)")
      .eq("id", conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return { ok: false, error: "Conversa não encontrada." };

    const { data: msgs } = await supabase
      .from("mensagens_skill")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    const transcript = (msgs ?? [])
      .map((m) => `${m.papel === "user" ? "Responsável" : "Kolo"}: ${m.conteudo}`)
      .join("\n\n")
      .slice(0, 8000);

    const rel = conversa.membros_atipicos as
      | { nome: string; data_nascimento: string | null; perfil: string }
      | { nome: string; data_nascimento: string | null; perfil: string }[]
      | null;
    const membroRow = rel ? (Array.isArray(rel) ? rel[0] : rel) : null;
    const membro = membroRow
      ? {
          nome: membroRow.nome,
          idade: idadeAnos(membroRow.data_nascimento),
          perfil: membroRow.perfil,
        }
      : null;

    const koloVivoResumo = await montarKoloVivoResumo(
      supabase,
      family.id,
      conversa.membro_atipico_id as string | null,
    );

    const proposta = await extrairAtualizacoes({ transcript, koloVivoResumo, membro });
    return {
      ok: true,
      proposta,
      temMembro: Boolean(conversa.membro_atipico_id),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const confirmarSchema = z.object({
  conversaId: z.string().uuid(),
  koloVivo: z
    .array(
      z.object({
        camada: z.enum(["camada1", "camada2"]),
        campo: z.string().min(1),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

const MEMBRO_CAMPOS = [
  "essencial",
  "como_e",
  "corpo_rotina",
  "desafios_regulacao",
  "sensorial",
] as const;
const FAMILIA_CAMPOS = ["composicao", "rotina", "recursos", "dinamica"] as const;

/** Anexa um fato curto ao texto da seção, sem substituir o que já existe. */
function appendFato(prev: string, fato: string): string {
  const p = (prev ?? "").trim();
  const f = fato.trim();
  if (!p) return f;
  if (p.toLowerCase().includes(f.toLowerCase())) return p;
  return `${p}\n${f}`;
}

export async function confirmarAtualizacao(
  input: z.infer<typeof confirmarSchema>,
): Promise<{ ok: true; resumo: string } | { ok: false; error: string }> {
  try {
    const data = confirmarSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);

    const { data: conversa } = await supabase
      .from("conversas")
      .select("id, membro_atipico_id")
      .eq("id", data.conversaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!conversa) return { ok: false, error: "Conversa não encontrada." };
    const membroId = conversa.membro_atipico_id as string | null;

    const partes: string[] = [];
    const now = new Date().toISOString();

    const membroItens = data.koloVivo.filter(
      (it) => it.camada === "camada1" && (MEMBRO_CAMPOS as readonly string[]).includes(it.campo),
    );
    const familiaItens = data.koloVivo.filter(
      (it) => it.camada === "camada2" && (FAMILIA_CAMPOS as readonly string[]).includes(it.campo),
    );

    // Kolo Vivo do membro — aplica DIRETO (já foi revisado no preview),
    // anexando ao texto existente em vez de substituir.
    if (membroItens.length > 0 && membroId) {
      const { data: atual } = await supabase
        .from("perfil_vivo_membro")
        .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
        .eq("membro_atipico_id", membroId)
        .maybeSingle();
      const secoes: Record<string, Record<string, unknown>> = {};
      for (const campo of MEMBRO_CAMPOS) {
        secoes[campo] = (atual?.[campo] as Record<string, unknown>) ?? {};
      }
      for (const it of membroItens) {
        const prev = (secoes[it.campo].texto as string) ?? "";
        const novoTexto = it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
        secoes[it.campo] = { ...secoes[it.campo], texto: novoTexto, atualizado_em: now };
      }
      const { error } = await supabase
        .from("perfil_vivo_membro")
        .upsert(
          { membro_atipico_id: membroId, family_account_id: family.id, ...secoes },
          { onConflict: "membro_atipico_id" },
        );
      if (error) return { ok: false, error: `Falha ao salvar no Kolo Vivo: ${error.message}` };
      partes.push(`${membroItens.length} ${membroItens.length === 1 ? "item" : "itens"} no Kolo Vivo`);
    }

    // Kolo Vivo da família — mesma lógica de anexar.
    if (familiaItens.length > 0) {
      const { data: atual } = await supabase
        .from("perfil_vivo_familia")
        .select("composicao, rotina, recursos, dinamica")
        .eq("family_account_id", family.id)
        .maybeSingle();
      const secoes: Record<string, Record<string, unknown>> = {};
      for (const campo of FAMILIA_CAMPOS) {
        secoes[campo] = (atual?.[campo] as Record<string, unknown>) ?? {};
      }
      for (const it of familiaItens) {
        const prev = (secoes[it.campo].texto as string) ?? "";
        const novoTexto = it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
        secoes[it.campo] = { ...secoes[it.campo], texto: novoTexto, atualizado_em: now };
      }
      const { error } = await supabase
        .from("perfil_vivo_familia")
        .upsert({ family_account_id: family.id, ...secoes });
      if (error) return { ok: false, error: `Falha ao salvar no Kolo Vivo da família: ${error.message}` };
      partes.push(`${familiaItens.length} ${familiaItens.length === 1 ? "item" : "itens"} no Kolo Vivo da família`);
    }

    // Conquista/desafio → diário (precisa de criança vinculada).
    if (membroId && (data.conquista || data.desafio)) {
      const { error } = await supabase.from("diarios").insert({
        family_account_id: family.id,
        membro_atipico_id: membroId,
        data: hojeLocalISO(),
        conquista: data.conquista ?? null,
        desafio: data.desafio ?? null,
        origem: "app",
        incompleto: true,
      });
      if (error) return { ok: false, error: `Falha ao registrar no diário: ${error.message}` };
      if (data.conquista) partes.push("conquista registrada");
      if (data.desafio) partes.push("desafio registrado");
    }

    if (partes.length === 0) {
      return { ok: false, error: "Nada selecionado pra registrar." };
    }

    revalidatePath(`/conversar/${data.conversaId}`);
    revalidatePath("/kolo-vivo");
    revalidatePath("/painel");
    return { ok: true, resumo: partes.join(" · ") };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Resumo compacto do Kolo Vivo atual — dado à IA pra ela não re-sugerir o
 * que já está registrado.
 */
async function montarKoloVivoResumo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  membroId: string | null,
): Promise<string> {
  const linhas: string[] = [];

  if (membroId) {
    const { data: pvm } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    if (pvm) {
      for (const campo of [
        "essencial",
        "como_e",
        "corpo_rotina",
        "desafios_regulacao",
        "sensorial",
      ] as const) {
        const resumo = resumoCampo(pvm[campo]);
        if (resumo) linhas.push(`[criança/${campo}] ${resumo}`);
      }
    }
  }

  const { data: pvf } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (pvf) {
    for (const campo of ["composicao", "rotina", "recursos", "dinamica"] as const) {
      const resumo = resumoCampo(pvf[campo]);
      if (resumo) linhas.push(`[família/${campo}] ${resumo}`);
    }
  }

  return linhas.join("\n");
}

function resumoCampo(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.texto === "string" && obj.texto.trim()) return obj.texto.trim();
  // Onboarding rápido grava listas (interesses, desafios_iniciais, etc.).
  const partes: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "atualizado_em") continue;
    if (typeof v === "string" && v.trim()) partes.push(v.trim());
    else if (Array.isArray(v)) partes.push(v.filter((x) => typeof x === "string").join("; "));
  }
  return partes.filter(Boolean).join(" · ");
}
