"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { respond, respondAsOutputType } from "@/lib/ia/engine";
import { gerarSecoesPlanoMultiCall, PlanoIncompletoError } from "@/lib/ia/plano";
import { gerarTituloConversa } from "@/lib/ia/titulo";
import { trackFeature } from "@/lib/analytics/track";
import { extrairAtualizacoes, type PropostaAtualizacao } from "@/lib/ia/atualizar";
import { extrairESalvarEventos } from "@/lib/ayla/eventos";
import {
  MEMBRO_CAMPOS_TOPLEVEL,
  MEMBRO_CAMPOS_EXTRAS,
} from "@/lib/kolo-vivo/campos";
import { aplicarPropostaNoPerfil } from "@/lib/kolo-vivo/aplicar";
import { idadeAnos, hojeLocalISO } from "@/lib/idade";
import { requireActiveWrite, SubscriptionBlockedError } from "@/lib/auth/require-active-write";
import { resolveFamily } from "@/lib/auth/current-family";

/**
 * Em background (after()), gera um título curto e bem-escrito pra conversa e
 * substitui o placeholder cru. Graceful: se a IA falhar, o placeholder fica.
 */
function agendarTituloConversa(familyId: string, conversaId: string, texto: string) {
  after(async () => {
    try {
      const admin = createServiceRoleClient();
      const titulo = await gerarTituloConversa(admin, familyId, texto);
      if (titulo) {
        await admin.from("conversas").update({ titulo }).eq("id", conversaId);
      }
    } catch {
      // título é cosmético — nunca derruba o fluxo da conversa
    }
  });
}

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
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
    agendarTituloConversa(family.id, conversaIdFinal, texto);
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
): Promise<{ conversaId: string } | { erro: string; assinatura?: boolean }> {
  const { membroAtipicoId, texto } = criarConversaSchema.parse(input);
  const { supabase, family } = await requireFamily();
  // Assinatura: em vez de dar throw (o Next MASCARA a mensagem de server action
  // que sobe sem tratamento → vira "Server Components render error" genérico),
  // devolvemos um sinal pra UI mostrar "quer assinar?" + botão pra /assinatura.
  try {
    await requireActiveWrite(family.id);
  } catch (e) {
    if (e instanceof SubscriptionBlockedError) return { erro: e.message, assinatura: true };
    throw e;
  }

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

  agendarTituloConversa(family.id, nova.id as string, texto);
  after(() =>
    trackFeature({ familyId: family.id, evento: "conversa_mensagem", detalhe: { nova: true } }),
  );

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

    after(() =>
      trackFeature({ familyId: family.id, evento: "conversa_mensagem", detalhe: { nova: false } }),
    );
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

    const membroAtipicoId = conversa.membro_atipico_id as string | null;

    // Cria o plano VAZIO na hora (secoes=[]) e devolve o id em <1s. A geração
    // pesada (Sonnet) roda em segundo plano (after) e preenche via UPDATE; a
    // tela /planos/[id] mostra "montando…" e atualiza sozinha quando fica
    // pronto. Sem espera travada no clique, sem risco de timeout no usuário.
    const { data: row, error: insErr } = await supabase
      .from("planos")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroAtipicoId,
        conversa_id: conversaId,
        titulo: "Montando seu plano…",
        secoes: [],
        origem: "estrategias",
      })
      .select("id")
      .single();
    if (insErr || !row) {
      return { ok: false, error: `Não consegui iniciar o plano: ${insErr?.message}` };
    }
    const planoId = row.id as string;
    after(() =>
      trackFeature({ familyId: family.id, evento: "plano_solicitado", detalhe: { origem: "estrategias" } }),
    );

    after(async () => {
      const admin = createServiceRoleClient();
      try {
        const { titulo, tema, secoes } = await gerarSecoesPlanoMultiCall({
          supabase: admin,
          familyId: family.id,
          membroAtipicoId,
          desafio,
        });
        await admin.from("planos").update({ titulo, tema, secoes }).eq("id", planoId);
      } catch (e) {
        console.error("[plano.after]", e);
        // Plano incompleto não é "erro genérico": as seções práticas não vieram
        // e a gente preferiu não entregar pela metade. Vale dizer isso.
        const incompleto = e instanceof PlanoIncompletoError;
        await admin
          .from("planos")
          .update({
            titulo: "Não consegui montar o plano",
            secoes: [
              {
                tipo: "__erro__",
                titulo: "",
                conteudo_markdown: incompleto
                  ? "A parte prática do plano — o que fazer no dia a dia — não veio desta vez, e eu não quis te entregar pela metade. Peça de novo nas Estratégias: costuma sair completo na segunda tentativa."
                  : "Tive um problema ao montar este plano. Volte às Estratégias e tente gerar de novo em instantes.",
              },
            ],
          })
          .eq("id", planoId);
      }
    });

    revalidatePath("/planos");
    return { ok: true, planoId };
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
        subcampo: z.string().trim().nullable().optional(),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

// `appendFato`, `aplicarTextoCampo` e a escrita no perfil saíram daqui pra
// lib/kolo-vivo/aplicar.ts — a MESMA lógica agora serve o botão e o aprendizado
// automático da web (antes o automático não existia; ver lib/ia/aprender.ts).

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

    // Aplicador compartilhado (lib/kolo-vivo/aplicar.ts) — a mesma escrita que o
    // aprendizado automático da web usa. A lógica de merge não mudou.
    const aplicado = await aplicarPropostaNoPerfil(supabase, {
      familyId: family.id,
      membroId,
      itens: data.koloVivo,
      // A pessoa clicou "Guardar no Perfil": e relato do cuidador, e o clique
      // e uma confirmacao explicita - por isso `confirmed`, e nao `reported`.
      fatos: {
        proveniencia: {
          sourceType: "caregiver_report",
          channel: "web",
          conversationId: data.conversaId ?? null,
        },
      },
    });
    if (aplicado.erro) {
      return { ok: false, error: `Falha ao salvar no Perfil: ${aplicado.erro}` };
    }
    if (aplicado.itensMembro > 0) {
      partes.push(
        `${aplicado.itensMembro} ${aplicado.itensMembro === 1 ? "item" : "itens"} no Perfil`,
      );

      // Linha do tempo (Livro Vivo): a WEB também alimenta a Evolução/relatório —
      // se um fato confirmado for uma evolução, grava um marco DATADO (mesmo
      // extrator do WhatsApp). Em after() + service-role: não trava o "confirmar"
      // e é bônus (nunca quebra o salvamento).
      const fatosConfirmados = aplicado.fatosMembro.join("\n");
      after(async () => {
        try {
          await extrairESalvarEventos(
            createServiceRoleClient(),
            family.id,
            membroId,
            fatosConfirmados,
          );
        } catch {
          /* linha do tempo é bônus */
        }
      });
    }
    if (aplicado.itensFamilia > 0) {
      partes.push(
        `${aplicado.itensFamilia} ${aplicado.itensFamilia === 1 ? "item" : "itens"} no Perfil da família`,
      );
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
      .select(
        "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
      )
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    if (pvm) {
      // Toplevel legados.
      for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
        const resumo = resumoCampo((pvm as Record<string, unknown>)[campo]);
        if (resumo) linhas.push(`[criança/${campo}] ${resumo}`);
      }
      // Domínios novos (categorias_extras) — sem isto, o extrator não enxerga
      // o que já existe nesses domínios e acaba propondo duplicado.
      const extras = (pvm.categorias_extras as Record<string, unknown> | null) ?? {};
      for (const campo of MEMBRO_CAMPOS_EXTRAS) {
        const resumo = resumoCampo(extras[campo]);
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
