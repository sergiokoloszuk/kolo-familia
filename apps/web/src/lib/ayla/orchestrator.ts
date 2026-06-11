import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocalISO, idadeAnos } from "@/lib/idade";
import { chaveTelefoneBR } from "@/lib/telefone";
import { enviarTexto, type InboundWhatsApp } from "./whatsappSender";
import { podeEnviarProativa } from "./rules";
import { parseInbound, detectarComando } from "./parser";
import { membroCampoStorage } from "@/lib/kolo-vivo/campos";
import { gerarRespostaAyla, type RespostaParams } from "./responder";
import { descricaoCuidador, type CuidadorDescrito, type Genero } from "./pronomes";
import { gerarSugestaoRepertorio } from "./repertorio";
import { decidirDedup } from "./dedup-kolo-vivo";
import {
  templateBoasVindas,
  templateRotinaDiaria,
  templateEngajamento,
  templateComandoAjuda,
  templateComandoPausada,
  templateComandoHorarioMudado,
  templateComandoSair,
  templateTrial,
  templateEmocionalStreak,
  templateInsight,
} from "./messageTemplates";
import { gerarMensagemEspontanea } from "./mensagemEspontanea";
import { montarPonteWhatsApp, gerarMagicLink, montarPlanoFimDeSemana } from "./ponte";
import type { AylaTipoProativa, AylaTipoReativa, ParserResult } from "./types";

/**
 * Orchestrator da Ayla — PRD §12.4. Os dois pontos de entrada:
 *
 *   - sendRotinaDiaria(supabase, familyId): chamado pelo cron diário
 *   - processInbound(supabase, inbound): chamado pelo webhook quando
 *     uma mensagem é recebida
 *
 * Esta camada:
 *   1. Aplica as regras de não-colisão (rules.ts)
 *   2. Despacha pra Z-API via whatsappSender
 *   3. Persiste em ayla_messages (todos os turnos, in/out)
 *   4. Atualiza ayla_daily_checkins quando inbound vira registro
 *   5. Cria sugestao_perfil_vivos quando parser sugere
 *   6. Cria diarios quando parser tem confiança suficiente
 */

export type EnvioResultado =
  | { enviada: true; messageId: string }
  | { enviada: false; motivo: string };

// ============================================================
// PROATIVA: Boas-vindas — primeira mensagem após onboarding
// ============================================================

export async function sendBoasVindas(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  console.log("[ayla:boas_vindas] start family=", familyAccountId);
  // Consentimento + não desativada + não pausada + limite diário —
  // todas as regras universais. Como é a primeira mensagem, não há
  // conflito com comercial/engajamento.
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "boas_vindas",
  );
  console.log("[ayla:boas_vindas] gate podeEnviarProativa =", podeRes);
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  // Idempotência: se já enviou boas-vindas pra essa família, não repete.
  const { data: jaEnviada } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "boas_vindas")
    .eq("direcao", "outbound")
    .limit(1);
  console.log("[ayla:boas_vindas] gate idempotencia rows=", jaEnviada?.length ?? 0);
  if ((jaEnviada?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Boas-vindas já enviada." };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  console.log("[ayla:boas_vindas] ctx loaded:", ctx ? {
    whatsapp: ctx.whatsapp_e164,
    nomeMae: ctx.nomeMae,
    membros: ctx.membros.length,
  } : null);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };
  if (ctx.membros.length === 0) {
    return { enviada: false, motivo: "Sem membros atípicos cadastrados." };
  }

  const membroFoco = ctx.membros[0];
  const texto = await templateBoasVindas(supabase, {
    nomeMae: ctx.nomeMae,
    nomeMembro: membroFoco.nome,
    genero: membroFoco.genero,
    seed: `${familyAccountId}-boas-vindas`,
  });

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco.id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "boas_vindas",
  });
}

// ============================================================
// PROATIVA: Rotina diária
// ============================================================

export async function sendRotinaDiaria(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "rotina",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };
  if (ctx.membros.length === 0) {
    return { enviada: false, motivo: "Sem membros atípicos cadastrados." };
  }

  // Já enviou rotina hoje? — idempotência por dia
  const inicio = startOfDay(agora);
  const { data: rotinasHoje } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "rotina")
    .gte("created_at", inicio.toISOString())
    .limit(1);
  if ((rotinasHoje?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Rotina já enviada hoje." };
  }

  // Round-robin entre membros: usa data + lista pra escolher
  const idx = Math.abs(hashSeed(`${familyAccountId}-${agora.toDateString()}`)) % ctx.membros.length;
  const membroFoco = ctx.membros[idx];

  // Tenta a Ayla-IA primeiro (3 intenções: acolhimento, voce_sabia,
  // completar_perfil). Se a chamada falhar (rede, modelo, vazio), cai no
  // templateRotinaDiaria estático — rede de segurança preservada.
  let texto: string;
  let intent: string;
  try {
    const ai = await gerarMensagemEspontanea(supabase, {
      familyId: familyAccountId,
      agora,
      membroFocoId: membroFoco.id,
    });
    texto = ai.texto;
    intent = `ai:${ai.intent}`;
  } catch (e) {
    console.warn(
      "[ayla:rotina] gerador IA falhou, caindo no template estático:",
      e instanceof Error ? e.message : e,
    );
    texto = await templateRotinaDiaria(supabase, {
      nomeMae: ctx.nomeMae,
      nomeMembro: membroFoco.nome,
      genero: membroFoco.genero,
      seed: `${familyAccountId}-${agora.toDateString()}`,
    });
    intent = "fallback:template";
  }

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco.id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "rotina",
    meta: { intent },
  });
}

// ============================================================
// PROATIVA: Follow-up de plano (Fase 4 — ciclo de aprendizado)
// ============================================================

/**
 * Alguns dias depois de um plano, a Ayla pergunta se a mãe testou e como
 * foi — com um magic-link que abre o plano no app, onde ela marca o
 * resultado num toque (captura confiável; sem depender de texto livre).
 * O que ela responde lá realimenta os próximos planos.
 *
 * Respeita todas as regras de proativa (janela, cap diário, consentimento).
 * Idempotência por plano: marca `seguimento_enviado_em` ao enviar.
 */
export async function sendPlanoSeguimento(
  supabase: SupabaseClient,
  familyAccountId: string,
  plano: { id: string; tema: string | null; membro_atipico_id: string | null },
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "plano_seguimento",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const link = await gerarMagicLink(supabase, {
    familyId: familyAccountId,
    next: `/planos/${plano.id}`,
  });
  if (!link) return { enviada: false, motivo: "Não consegui gerar o link do plano." };

  const membro = plano.membro_atipico_id
    ? ctx.membros.find((m) => m.id === plano.membro_atipico_id)
    : null;
  const tema = (plano.tema ?? "").trim();
  const refTema = tema ? ` sobre ${tema}` : "";
  const refMembro = membro?.nome ? ` pra ${membro.nome}` : "";
  const texto = `Oi, ${ctx.nomeMae}! Lembra do plano${refTema} que montei${refMembro}? Você chegou a testar? Me conta rapidinho como foi — assim eu deixo os próximos cada vez mais certeiros. É só tocar aqui, você já entra direto:\n${link}`;

  const r = await enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: plano.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "plano_seguimento",
    meta: { plano_id: plano.id },
  });

  if (r.enviada) {
    await supabase
      .from("planos")
      .update({ seguimento_enviado_em: agora.toISOString() })
      .eq("id", plano.id);
  }
  return r;
}

// ============================================================
// PROATIVA: Oferta de plano de fim de semana (Fase 5)
// ============================================================

/**
 * Sexta-feira: a Ayla pergunta se a mãe quer um roteiro leve pro fim de
 * semana e convida a contar o que já tá no radar + o que queria que
 * rolasse. A geração em si acontece quando ela responde (ver o gancho no
 * processInbound → montarPlanoFimDeSemana). Idempotente por dia.
 */
export async function sendOfertaFimDeSemana(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "fim_de_semana",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };
  if (ctx.membros.length === 0) {
    return { enviada: false, motivo: "Sem membros atípicos cadastrados." };
  }

  // Idempotência: no máx 1 oferta de fim de semana por dia.
  const inicio = startOfDay(agora);
  const { data: jaHoje } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "fim_de_semana")
    .gte("created_at", inicio.toISOString())
    .limit(1);
  if ((jaHoje?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Oferta de fim de semana já enviada hoje." };
  }

  // Round-robin entre membros (igual à rotina), pra famílias 2+.
  const idx =
    Math.abs(hashSeed(`${familyAccountId}-fds-${agora.toDateString()}`)) % ctx.membros.length;
  const membroFoco = ctx.membros[idx];

  const texto = `Sexta chegou 🌿 Quer que eu monte um roteiro leve pro fim de semana${membroFoco.nome ? ` com ${membroFoco.nome}` : ""}? Sem grade rígida — só algumas ideias pra encaixar no que rolar. Me conta o que já tá no radar (passeio, casa, nada planejado?) e o que você queria que acontecesse. Ou responde "pode ser" que eu já mando uma sugestão.`;

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco.id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "fim_de_semana",
  });
}

/**
 * Há uma oferta de fim de semana esperando resposta? True quando: existe
 * uma oferta `fim_de_semana` nas últimas 48h, a mãe AINDA não respondeu a
 * ela (nenhum inbound depois) e nenhum plano de fim de semana foi gerado
 * desde então. Calcular ANTES de persistir o inbound atual.
 */
async function ofertaFimDeSemanaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: ofertas } = await supabase
    .from("ayla_messages")
    .select("created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("tipo", "fim_de_semana")
    .eq("direcao", "outbound")
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const oferta = ofertas?.[0];
  if (!oferta) return null;

  const ofertaEm = oferta.created_at as string;

  const { data: respostas } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "inbound")
    .gt("created_at", ofertaEm)
    .limit(1);
  if ((respostas?.length ?? 0) > 0) return null;

  const { data: planos } = await supabase
    .from("planos")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("origem", "fim_de_semana")
    .gte("created_at", ofertaEm)
    .limit(1);
  if ((planos?.length ?? 0) > 0) return null;

  return { membroId: (oferta.membro_atipico_id as string | null) ?? null };
}

/** Resposta curta e claramente negativa à oferta de fim de semana. */
function ehRecusaFimDeSemana(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (t.length > 40) return false; // resposta longa = ela contou algo → gerar
  return /\b(nao|agora nao|hoje nao|nao quero|nao da|nao precisa|depois|talvez depois|fica pra proxima|deixa pra depois)\b/.test(
    t,
  );
}

// ============================================================
// PROATIVA: Engajamento por inatividade
// ============================================================

export async function sendEngajamento(
  supabase: SupabaseClient,
  familyAccountId: string,
  diasInativos: number,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const tipo: AylaTipoProativa =
    diasInativos >= 5 ? "engajamento_5dias" : "engajamento_2dias";

  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    tipo,
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const membroFoco = ctx.membros[0];
  const texto = await templateEngajamento(supabase, {
    diasInativos,
    nomeMae: ctx.nomeMae,
    nomeMembro: membroFoco?.nome ?? "seu filho/sua filha",
    genero: membroFoco?.genero ?? null,
    seed: `${familyAccountId}-eng-${diasInativos}`,
  });

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco?.id ?? null,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo,
  });
}

// ============================================================
// PROATIVA: Trial D-3 e D-0
// ============================================================

export async function sendTrial(
  supabase: SupabaseClient,
  familyAccountId: string,
  diasRestantes: 3 | 0,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const tipo: AylaTipoProativa = diasRestantes === 3 ? "trial_d3" : "trial_d0";

  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    tipo,
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const texto = await templateTrial(supabase, {
    diasRestantes,
    nomeMae: ctx.nomeMae,
    seed: `${familyAccountId}-trial-${diasRestantes}`,
  });

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: null,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo,
  });
}

// ============================================================
// PROATIVA: Emocional streak 7 dias
// ============================================================

export async function sendEmocionalStreak(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "emocional_streak",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const membroFoco = ctx.membros[0];
  const texto = await templateEmocionalStreak(supabase, {
    nomeMae: ctx.nomeMae,
    nomeMembro: membroFoco?.nome ?? "seu filho/sua filha",
    genero: membroFoco?.genero ?? null,
    seed: `${familyAccountId}-streak-${agora.toDateString()}`,
  });

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco?.id ?? null,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "emocional_streak",
  });
}

// ============================================================
// PROATIVA: Insight (lê próximo pendente de ayla_insights)
// ============================================================

export async function sendProximoInsight(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "insight",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const { data: insight } = await supabase
    .from("ayla_insights")
    .select("id, mensagem_proposta, membro_atipico_id")
    .eq("family_account_id", familyAccountId)
    .eq("enviado", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!insight || !insight.mensagem_proposta) {
    return { enviada: false, motivo: "Nenhum insight pendente." };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const resp = await enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: insight.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    texto: templateInsight(insight.mensagem_proposta),
    category: "proativa",
    tipo: "insight",
  });

  if (resp.enviada) {
    await supabase
      .from("ayla_insights")
      .update({ enviado: true, enviado_em: agora.toISOString() })
      .eq("id", insight.id);
  }
  return resp;
}

// ============================================================
// PROATIVA: Expansão de repertório — Fatia 3.3b
//
// 1×/semana, propõe UMA experiência nova adjacente aos interesses da
// criança. Respeita todas as regras da Ayla (consentimento, pausa, limite
// 2/dia, silêncio>10d) + cadência semanal + nunca repete o que ela recusou.
// ============================================================

export async function sendRepertorioSugestao(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "repertorio_sugestao",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  // Cadência: no máximo 1 sugestão de repertório a cada 7 dias.
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: recente } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "repertorio_sugestao")
    .gte("created_at", seteDiasAtras.toISOString())
    .limit(1);
  if ((recente?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Sugestão de repertório já enviada esta semana." };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };
  if (ctx.membros.length === 0) {
    return { enviada: false, motivo: "Sem membros atípicos cadastrados." };
  }

  // Round-robin por semana entre os membros.
  const semana = Math.floor(agora.getTime() / (7 * 24 * 60 * 60 * 1000));
  const membroFoco = ctx.membros[Math.abs(hashSeed(`${familyAccountId}-${semana}`)) % ctx.membros.length];

  const { data: perfil } = await supabase
    .from("perfil_vivo_membro")
    .select("categorias_extras")
    .eq("membro_atipico_id", membroFoco.id)
    .maybeSingle();

  const pref =
    ((perfil?.categorias_extras as { preferencias?: Record<string, unknown> } | null)
      ?.preferencias as Record<string, unknown>) ?? {};
  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

  const interesses = [
    ...lista(pref.temas),
    ...lista(pref.midia),
    ...lista(pref.materiais),
  ];
  if (interesses.length === 0) {
    return { enviada: false, motivo: "Sem interesses cadastrados pra sugerir." };
  }
  const evitar = lista(pref.evitar);
  const jaTentados = Array.isArray(pref.experimentos)
    ? pref.experimentos
        .map((e) => (e && typeof e === "object" ? (e as { item?: unknown }).item : null))
        .filter((x): x is string => typeof x === "string")
    : [];

  const texto = await gerarSugestaoRepertorio(
    {
      nomeMae: ctx.nomeMae,
      nomeMembro: membroFoco.nome,
      idadeMembro: idadeAnos(membroFoco.data_nascimento ?? null),
      perfilMembro: membroFoco.perfil ?? null,
      interesses,
      evitar,
      jaTentados,
    },
    { supabase, family_account_id: familyAccountId, feature: "ayla_repertorio" },
  );

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco.id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "repertorio_sugestao",
  });
}

// ============================================================
// PROATIVA: Campanha administrativa — PRD §7.13 + §12.5
//
// Aplica todas as regras da Ayla (consentimento, pausa, limite 2/dia,
// silêncio>10d, anti-colisão comercial-pós-crise) + opt-out por categoria.
// "operacional" é comunicado obrigatório (sem opt-out, mas ainda respeita
// consentimento + pausa + silêncio total).
// ============================================================

export type CampanhaCategoria =
  | "informacional"
  | "promocional"
  | "avaliacao"
  | "operacional";

export async function sendCampanha(
  supabase: SupabaseClient,
  params: {
    family_account_id: string;
    campanha_id: string;
    categoria: CampanhaCategoria;
    conteudo_whatsapp: string;
  },
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const tipo: AylaTipoProativa = (`campanha_${params.categoria}` as AylaTipoProativa);

  // 1. Opt-out por categoria (operacional é exceção — comunicado obrigatório)
  if (params.categoria !== "operacional") {
    const { data: optout } = await supabase
      .from("categorias_optout")
      .select("id")
      .eq("family_account_id", params.family_account_id)
      .eq("categoria", params.categoria)
      .maybeSingle();
    if (optout) {
      return {
        enviada: false,
        motivo: `Família optou-out de '${params.categoria}'.`,
      };
    }
  }

  // 2. Regras Ayla (consentimento, pausa, 2/dia, silêncio total, comercial-pós-crise)
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: params.family_account_id, agora },
    tipo,
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  // 3. Carrega contato
  const ctx = await loadFamiliaParaEnvio(supabase, params.family_account_id);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  return enviarEPersistir(supabase, {
    family_account_id: params.family_account_id,
    membro_atipico_id: null,
    phone: ctx.whatsapp_e164,
    texto: params.conteudo_whatsapp,
    category: "proativa",
    tipo,
  });
}

// ============================================================
// REATIVA: processa mensagem recebida (webhook)
// ============================================================

export async function processInbound(
  supabase: SupabaseClient,
  inbound: InboundWhatsApp,
): Promise<{ tratada: boolean; familia?: string; resposta?: EnvioResultado }> {
  // 1. Identifica família pelo número — casamento TOLERANTE (BR tem a
  // pegadinha do 9º dígito + variações de formato/país). Comparamos por
  // uma chave normalizada em vez de igualdade exata.
  const chaveIn = chaveTelefoneBR(inbound.phoneE164);
  const { data: familias } = await supabase
    .from("family_accounts")
    .select("id, whatsapp_e164")
    .not("whatsapp_e164", "is", null);
  const family = (familias ?? []).find(
    (f) => chaveTelefoneBR(f.whatsapp_e164 as string) === chaveIn,
  );
  if (!family) {
    // Número não reconhecido — loga pra dar pra diagnosticar (antes sumia).
    console.warn(
      `[ayla] inbound de número não cadastrado: ${inbound.phoneE164} (chave ${chaveIn})`,
    );
    return { tratada: false };
  }

  // 1b. Há uma oferta de fim de semana esperando resposta? (calcular ANTES
  // de persistir o inbound atual, pra "primeira resposta" ser detectada).
  const ofertaFds = await ofertaFimDeSemanaPendente(
    supabase,
    family.id,
    inbound.recebidaEm,
  );

  // 2. Persiste inbound
  await supabase.from("ayla_messages").insert({
    family_account_id: family.id,
    direcao: "inbound",
    texto: inbound.texto,
    midia_url: inbound.midiaUrl ?? null,
    midia_tipo: inbound.midiaTipo ?? null,
    recebida_em: inbound.recebidaEm.toISOString(),
  });

  // 3. Comando? — antes do parser IA, mais rápido
  const cmd = detectarComando(inbound.texto);
  if (cmd) {
    const resp = await processarComando(supabase, family.id, cmd);
    return { tratada: true, familia: family.id, resposta: resp };
  }

  // 3a. Resposta à oferta de fim de semana (Fase 5): se não for recusa,
  // monta o roteiro leve a partir do que ela contou e manda o link.
  if (ofertaFds && !ehRecusaFimDeSemana(inbound.texto)) {
    const ctxFds = await loadFamiliaParaEnvio(supabase, family.id);
    if (ctxFds) {
      const membroId = ofertaFds.membroId ?? ctxFds.membros[0]?.id ?? null;
      const membroNome = membroId
        ? (ctxFds.membros.find((m) => m.id === membroId)?.nome ?? null)
        : null;
      const msg = await montarPlanoFimDeSemana(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        contexto: inbound.texto,
        nomeMembro: membroNome,
        phoneE164: ctxFds.whatsapp_e164,
      });
      if (msg) {
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: membroId,
          phone: ctxFds.whatsapp_e164,
          texto: msg,
          category: "reativa",
          tipo: "resposta_registro",
        });
        return { tratada: true, familia: family.id, resposta: resp };
      }
      // Falhou gerar → cai no fluxo normal (a Ayla ainda responde algo).
    }
  }

  // 3b. "Sim" curto → confirma a última sugestão pendente da Ayla pro Kolo Vivo.
  // Se não houver nada pendente, segue pro parser (pode ser "sim" a outra coisa).
  if (ehAfirmacaoCurta(inbound.texto)) {
    const aplicada = await confirmarSugestaoPendente(supabase, family.id);
    if (aplicada) {
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: aplicada.membro_atipico_id,
        phone: inbound.phoneE164,
        texto: `Pronto, guardei no Kolo Vivo${aplicada.nomeMembro ? ` do ${aplicada.nomeMembro}` : ""}: "${aplicada.texto}". 🌿`,
        category: "reativa",
        tipo: "confirmacao_sugestao",
      });
      return { tratada: true, familia: family.id, resposta: resp };
    }
  }

  // 4. Parser IA
  const ctx = await loadFamiliaParaEnvio(supabase, family.id);
  if (!ctx) return { tratada: true, familia: family.id };

  // Último membro foco (pra desambiguar pronome em famílias 2+)
  const { data: ultimoCheckin } = await supabase
    .from("ayla_daily_checkins")
    .select("membro_atipico_id, membros_atipicos(nome)")
    .eq("family_account_id", family.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const ultimoNome = ultimoCheckin?.[0]
    ? Array.isArray(ultimoCheckin[0].membros_atipicos)
      ? ultimoCheckin[0].membros_atipicos[0]?.nome
      : (ultimoCheckin[0].membros_atipicos as { nome: string } | null)?.nome
    : null;

  const parsed = await parseInbound(
    {
      texto: inbound.texto,
      membros: ctx.membros,
      ultimoMembroFoco: ultimoNome ?? null,
    },
    { supabase, family_account_id: family.id, feature: "ayla_parser" },
  );

  // Família com 1 membro: se o parser não cravou quem é, é o único possível.
  if (ctx.membros.length === 1 && !parsed.membro_atipico_id) {
    parsed.membro_atipico_id = ctx.membros[0].id;
    parsed.confianca_identificacao = 100;
  }

  // 5. Decide o caminho

  const temAlgoPraRegistrar = Boolean(
    parsed.conquista ||
      parsed.desafio ||
      parsed.observacao_livre ||
      (parsed.sugestao_kolo_vivo && parsed.texto_kolo_vivo_sugerido),
  );

  // Família 2+ membros + há conteúdo mas não sabemos de quem → a Ayla pergunta
  // QUEM (de forma natural), e não registramos até saber.
  const precisaEscolherMembro =
    ctx.membros.length >= 2 &&
    (parsed.confianca_identificacao < 70 || !parsed.membro_atipico_id) &&
    temAlgoPraRegistrar
      ? { nomes: ctx.membros.map((m) => m.nome) }
      : null;

  // Registra nos bastidores (check-in + diário + sugestão) quando há conteúdo
  // e sabemos de quem é. Invisível pra mãe — a fala vem da voz da Ayla.
  if (temAlgoPraRegistrar && parsed.membro_atipico_id && !precisaEscolherMembro) {
    await persistirRegistro(supabase, family.id, parsed);
  }

  // Foco pra CONTEXTO da conversa (perfil + Kolo Vivo). O parser só crava o
  // membro quando há evento a registrar; numa PERGUNTA ("o que sabe da X?")
  // ele volta null. Então, se não cravou, casa pelo nome citado na mensagem
  // (e, em último caso, usa o único membro). Isso NÃO registra nada — só
  // permite a Ayla puxar o perfil de quem a mãe perguntou.
  const textoLower = inbound.texto.toLowerCase();
  const membroPorNome = ctx.membros.find(
    (m) => m.nome && textoLower.includes(m.nome.toLowerCase()),
  );
  const membroContextoId =
    parsed.membro_atipico_id ??
    membroPorNome?.id ??
    (ctx.membros.length === 1 ? ctx.membros[0].id : null);

  const membroFoco = membroContextoId
    ? (ctx.membros.find((m) => m.id === membroContextoId) ?? null)
    : null;
  const nomeMembro = membroFoco?.nome ?? null;
  const koloVivoResumo = await carregarKoloVivoResumo(supabase, membroContextoId);
  const estrategiasRecentes = await carregarEstrategiasRecentes(supabase, family.id);
  const historico = await carregarHistorico(supabase, family.id, inbound.texto);

  const resp = await enviarRespostaEmChunks(supabase, {
    family_account_id: family.id,
    membro_atipico_id: membroContextoId,
    phone: ctx.whatsapp_e164,
    tipo: precisaEscolherMembro ? "clarificacao_identificacao" : "resposta_registro",
    params: {
      nomeMae: ctx.nomeMae,
      cuidador: ctx.cuidador,
      nomeMembro,
      idadeMembro: idadeAnos(membroFoco?.data_nascimento ?? null),
      perfilMembro: membroFoco?.perfil ?? null,
      generoMembro: membroFoco?.genero ?? null,
      koloVivoResumo,
      estrategiasRecentes,
      historico,
      mensagem: inbound.texto,
      sinais: {
        conquista: parsed.conquista,
        desafio: parsed.desafio,
        emocao_mae: parsed.emocao_mae,
        experimentou: parsed.experimentou ?? null,
        temSugestaoKoloVivo: Boolean(
          parsed.sugestao_kolo_vivo && parsed.texto_kolo_vivo_sugerido,
        ),
      },
      precisaEscolherMembro,
    },
  });
  return { tratada: true, familia: family.id, resposta: resp };
}

/**
 * Gera a resposta da Ayla em streaming e manda cada parágrafo no WhatsApp
 * assim que fica pronto (primeira parte chega rápido, efeito de "digitando").
 * Persiste UM registro com o texto completo, pra histórico/“sim” coerentes.
 */
async function enviarRespostaEmChunks(
  supabase: SupabaseClient,
  args: {
    family_account_id: string;
    membro_atipico_id: string | null;
    phone: string;
    tipo: AylaTipoReativa;
    params: RespostaParams;
  },
): Promise<EnvioResultado> {
  let providerResp: unknown = null;
  let messageId = "unknown";
  let erro: string | null = null;
  let primeiro = true;

  let textoCompleto = await gerarRespostaAyla(
    args.params,
    async (par) => {
      // "Digitando..." visível antes de cada bolha; tempo ~proporcional ao
      // tamanho do trecho, pra parecer alguém escrevendo de verdade.
      const delay = primeiro ? 2 : Math.min(Math.max(Math.round(par.length / 25), 2), 6);
      primeiro = false;
      try {
        const r = await enviarTexto({ phoneE164: args.phone, texto: par, delaySegundos: delay });
        providerResp = r.raw;
        messageId = r.messageId;
      } catch (e) {
        erro = e instanceof Error ? e.message : "falha no envio";
      }
    },
    { supabase, family_account_id: args.family_account_id, feature: "ayla_responder" },
  );

  const enviada = erro == null;

  // Ponte WhatsApp → app (Fase 3): num desafio de verdade, manda um
  // magic-link que abre o plano completo no app, já logado. Numa crise /
  // desabafo / dúvida (ou clarificação de membro) não manda — a própria
  // ponte filtra por intenção. Falha silenciosa: nunca quebra a resposta.
  if (enviada && args.tipo === "resposta_registro") {
    const nudge = await montarPonteWhatsApp(supabase, {
      familyId: args.family_account_id,
      membroAtipicoId: args.membro_atipico_id,
      mensagem: args.params.mensagem,
      temDesafio: Boolean(args.params.sinais.desafio),
      phoneE164: args.phone,
    });
    if (nudge) {
      try {
        await enviarTexto({ phoneE164: args.phone, texto: nudge, delaySegundos: 3 });
        textoCompleto = `${textoCompleto}\n\n${nudge}`;
      } catch (e) {
        console.warn(
          "[ayla:ponte] falha ao enviar link no WhatsApp:",
          e instanceof Error ? e.message : e,
        );
      }
    }
  }

  await supabase.from("ayla_send_log").insert({
    family_account_id: args.family_account_id,
    template_key: args.tipo,
    payload: { phone: args.phone, texto: textoCompleto },
    resposta_provider: providerResp as Record<string, unknown> | null,
    status: enviada ? "enviada" : "falha",
    erro,
  });

  if (enviada) {
    await supabase.from("ayla_messages").insert({
      family_account_id: args.family_account_id,
      membro_atipico_id: args.membro_atipico_id,
      direcao: "outbound",
      category: "reativa",
      tipo: args.tipo,
      texto: textoCompleto,
      enviada_em: new Date().toISOString(),
    });
    await supabase
      .from("ayla_preferences")
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq("family_account_id", args.family_account_id);
    return { enviada: true, messageId };
  }
  return { enviada: false, motivo: erro ?? "falha" };
}

// ============================================================
// Comandos
// ============================================================

import type { Comando } from "./types";

async function processarComando(
  supabase: SupabaseClient,
  familyId: string,
  cmd: Comando,
): Promise<EnvioResultado> {
  const ctx = await loadFamiliaParaEnvio(supabase, familyId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  let texto: string;

  switch (cmd.tipo) {
    case "ajuda":
      texto = await templateComandoAjuda(supabase);
      break;
    case "pausar": {
      const ate = new Date();
      ate.setDate(ate.getDate() + cmd.dias);
      await supabase
        .from("ayla_preferences")
        .update({ pausada_ate: ate.toISOString().slice(0, 10) })
        .eq("family_account_id", familyId);
      texto = await templateComandoPausada(supabase, cmd.dias);
      break;
    }
    case "mudar_horario": {
      const [h, m] = cmd.hora.split(":");
      await supabase
        .from("ayla_preferences")
        .update({
          horario_preferido_inicio: `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`,
        })
        .eq("family_account_id", familyId);
      texto = await templateComandoHorarioMudado(supabase, cmd.hora);
      break;
    }
    case "sair":
      await supabase
        .from("ayla_preferences")
        .update({ desativada: true })
        .eq("family_account_id", familyId);
      texto = await templateComandoSair(supabase);
      break;
  }

  return enviarEPersistir(supabase, {
    family_account_id: familyId,
    membro_atipico_id: null,
    phone: ctx.whatsapp_e164,
    texto,
    category: "reativa",
    tipo: "resposta_comando",
  });
}

// ============================================================
// Aplicação direta de sugestão de Kolo Vivo no membro
// (auto-incorporação — Sérgio 2026-05-26: sem aprovação humana)
// ============================================================

/**
 * Aplica um fato no campo correto do `perfil_vivo_membro` (toplevel ou
 * categorias_extras, decidido por membroCampoStorage). Devolve true se o
 * upsert deu certo.
 *
 * `operacao`:
 *  - "adicionar" (default): appendFato — anexa, dedupando por substring.
 *  - "reescrever": substitui o texto da seção pelo `texto` recebido
 *    (usado pelo dedup semântico quando o fato sobrepõe/refina o existente).
 *
 * Usado tanto pela auto-incorporação (persistirRegistro) quanto pelo
 * fluxo legado "sim" no WhatsApp (confirmarSugestaoPendente).
 */
async function aplicarSugestaoNoMembro(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  campo: string,
  texto: string,
  operacao: "adicionar" | "reescrever" = "adicionar",
): Promise<boolean> {
  const storage = membroCampoStorage(campo);
  if (storage === null) return false;

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select(
      "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
    )
    .eq("membro_atipico_id", membroId)
    .maybeSingle();

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (storage === "toplevel") {
    const secaoAtual = (atual as Record<string, SecaoJson> | null)?.[campo] ?? {};
    const novoTexto =
      operacao === "reescrever"
        ? texto.trim()
        : appendFato(secaoAtual?.texto ?? "", texto);
    patch = { [campo]: { ...secaoAtual, texto: novoTexto, atualizado_em: now } };
  } else {
    const extras = {
      ...((atual?.categorias_extras as Record<string, unknown>) ?? {}),
    };
    const secaoAtual = (extras[campo] as SecaoJson) ?? {};
    const novoTexto =
      operacao === "reescrever"
        ? texto.trim()
        : appendFato(secaoAtual?.texto ?? "", texto);
    extras[campo] = { ...secaoAtual, texto: novoTexto, atualizado_em: now };
    patch = { categorias_extras: extras };
  }

  const { error } = await supabase.from("perfil_vivo_membro").upsert(
    {
      membro_atipico_id: membroId,
      family_account_id: familyId,
      ...patch,
    },
    { onConflict: "membro_atipico_id" },
  );
  return !error;
}

/** Lê o texto atual de uma seção, considerando toplevel vs categorias_extras. */
function lerTextoAtualDaSecao(
  row: Record<string, unknown> | null | undefined,
  campo: string,
): string {
  if (!row) return "";
  const storage = membroCampoStorage(campo);
  if (storage === "toplevel") {
    const sec = row[campo] as SecaoJson;
    return sec?.texto?.trim() ?? "";
  }
  if (storage === "extras") {
    const extras = (row.categorias_extras as Record<string, unknown>) ?? {};
    const sec = extras[campo] as SecaoJson;
    return sec?.texto?.trim() ?? "";
  }
  return "";
}

// ============================================================
// Persistência de registro derivado do parser
// ============================================================

async function persistirRegistro(
  supabase: SupabaseClient,
  familyId: string,
  p: ParserResult,
): Promise<void> {
  if (!p.membro_atipico_id) return;

  // Tentar algo novo já é conquista: se a mãe contou um experimento e não
  // veio conquista explícita, celebramos a tentativa em si (Fatia 3.3).
  const conquista =
    p.conquista ?? (p.experimentou ? `Experimentou ${p.experimentou}` : null);

  // 1. Daily check-in
  await supabase.from("ayla_daily_checkins").upsert(
    {
      family_account_id: familyId,
      membro_atipico_id: p.membro_atipico_id,
      date: hojeLocalISO(),
      conquista_extraida: conquista,
      desafio_extraido: p.desafio,
      emocao_mae: p.emocao_mae,
      possivel_gatilho: p.possivel_gatilho,
      observacao_livre: p.observacao_livre,
      respondeu: true,
      respondeu_em: new Date().toISOString(),
      confianca_parser: p.confianca,
    },
    { onConflict: "family_account_id,membro_atipico_id,date" },
  );

  // 2. Diário (Camada A + B se confianca_camada_adulto >= 70)
  if (conquista || p.desafio || p.observacao_livre) {
    const incompleto =
      Boolean(p.estado_adulto || p.reacao_adulto || p.quem_estava) === false &&
      Boolean(conquista || p.desafio); // Tem evento mas sem Camada B

    await supabase.from("diarios").insert({
      family_account_id: familyId,
      membro_atipico_id: p.membro_atipico_id,
      data: hojeLocalISO(),
      conquista,
      desafio: p.desafio,
      observacao_livre: p.observacao_livre,
      possivel_gatilho: p.possivel_gatilho,
      quem_estava: p.confianca_camada_adulto >= 70 ? p.quem_estava : null,
      estado_adulto: p.confianca_camada_adulto >= 70 ? p.estado_adulto : null,
      reacao_adulto: p.confianca_camada_adulto >= 70 ? p.reacao_adulto : null,
      origem: "ayla",
      incompleto,
    });
  }

  // 2b. Memória de repertório: o que experimentou e como foi (Fatia 3.3).
  if (p.experimentou) {
    await registrarExperimento(
      supabase,
      p.membro_atipico_id,
      familyId,
      p.experimentou,
      p.experimentou_resultado ?? "neutro",
    );
  }

  // 3. Sugestão de Kolo Vivo — AUTO-INCORPORAÇÃO com DEDUP SEMÂNTICO.
  //    Decidido em 2026-05-26: info nova entra automática sem aprovação humana.
  //    O Haiku compara o fato novo com o texto atual da seção e decide entre
  //    adicionar / reescrever / skip — evita duplicar paráfrase. A linha em
  //    sugestao_perfil_vivos vira log de auditoria (status=aprovada se
  //    aplicou, rejeitada se skip, pendente se campo desconhecido).
  if (p.sugestao_kolo_vivo && p.texto_kolo_vivo_sugerido) {
    const campo = p.campo_kolo_vivo_sugerido ?? "como_e";
    const storage = membroCampoStorage(campo);
    const agora = new Date().toISOString();

    if (storage === null) {
      // Campo desconhecido — deixa pendente pra revisão manual via card.
      await supabase.from("sugestao_perfil_vivos").insert({
        family_account_id: familyId,
        membro_atipico_id: p.membro_atipico_id,
        camada: "camada1",
        campo,
        texto_sugerido: p.texto_kolo_vivo_sugerido,
        origem: "ayla",
        origem_detalhe: {
          confianca: p.confianca,
          auto: true,
          motivo: "campo_desconhecido",
        },
        status: "pendente",
      });
    } else {
      const { data: rowAtual } = await supabase
        .from("perfil_vivo_membro")
        .select(
          "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
        )
        .eq("membro_atipico_id", p.membro_atipico_id)
        .maybeSingle();
      const textoAtual = lerTextoAtualDaSecao(rowAtual, campo);

      const decisao = await decidirDedup(
        {
          campo,
          textoSugerido: p.texto_kolo_vivo_sugerido,
          textoAtual,
        },
        { supabase, family_account_id: familyId, feature: "ayla_dedup" },
      );

      let aplicou = false;
      if (decisao.operacao !== "skip" && decisao.texto.trim()) {
        aplicou = await aplicarSugestaoNoMembro(
          supabase,
          familyId,
          p.membro_atipico_id,
          campo,
          decisao.texto,
          decisao.operacao,
        );
      }

      await supabase.from("sugestao_perfil_vivos").insert({
        family_account_id: familyId,
        membro_atipico_id: p.membro_atipico_id,
        camada: "camada1",
        campo,
        texto_sugerido: p.texto_kolo_vivo_sugerido,
        origem: "ayla",
        origem_detalhe: {
          confianca: p.confianca,
          auto: true,
          operacao: decisao.operacao,
          texto_aplicado: decisao.operacao === "skip" ? null : decisao.texto,
        },
        status:
          decisao.operacao === "skip"
            ? "rejeitada"
            : aplicou
              ? "aprovada"
              : "pendente",
        decidido_em:
          decisao.operacao === "skip" || aplicou ? agora : null,
      });
    }
  }
}

/**
 * Guarda a experimentação na memória de repertório do membro, dentro de
 * `categorias_extras.preferencias` (Fatia 3.3):
 * - `experimentos`: histórico { item, resultado, data } (últimos 50).
 * - `evitar`: itens que ela NÃO curtiu — pra Ayla não insistir depois.
 */
async function registrarExperimento(
  supabase: SupabaseClient,
  membroId: string,
  familyId: string,
  item: string,
  resultado: "amou" | "gostou" | "neutro" | "nao_gostou",
): Promise<void> {
  const limpo = item.trim();
  if (!limpo) return;

  const { data } = await supabase
    .from("perfil_vivo_membro")
    .select("categorias_extras")
    .eq("membro_atipico_id", membroId)
    .maybeSingle();

  const extras = { ...((data?.categorias_extras as Record<string, unknown>) ?? {}) };
  const pref = { ...((extras.preferencias as Record<string, unknown>) ?? {}) };

  const experimentos = Array.isArray(pref.experimentos) ? [...pref.experimentos] : [];
  experimentos.push({ item: limpo, resultado, data: hojeLocalISO() });
  pref.experimentos = experimentos.slice(-50);

  if (resultado === "nao_gostou") {
    const evitar = Array.isArray(pref.evitar)
      ? pref.evitar.filter((x): x is string => typeof x === "string")
      : [];
    if (!evitar.some((e) => e.toLowerCase() === limpo.toLowerCase())) {
      evitar.push(limpo);
    }
    pref.evitar = evitar;
  }

  extras.preferencias = pref;

  await supabase
    .from("perfil_vivo_membro")
    .upsert(
      { membro_atipico_id: membroId, family_account_id: familyId, categorias_extras: extras },
      { onConflict: "membro_atipico_id" },
    );
}

// ============================================================
// Confirmação de sugestão pendente ("sim" no WhatsApp)
// ============================================================

const AFIRMACOES = new Set([
  "sim", "s", "simm", "sim sim", "claro", "claro que sim", "pode", "pode sim",
  "sim pode", "isso", "isso mesmo", "isso ai", "quero", "quero sim", "ok",
  "okay", "ta", "ta bom", "adiciona", "adicionar", "pode adicionar",
  "adiciona sim", "manda", "boa", "perfeito", "yes",
]);

/** Mensagem curta que é só um "sim" (sem conteúdo novo pra registrar). */
function ehAfirmacaoCurta(texto: string): boolean {
  const norm = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // tira acentos
    .replace(/[^a-z\s]/g, " ") // tira pontuação/emoji
    .replace(/\s+/g, " ")
    .trim();
  if (!norm) return /^[\u{1F44D}\u{1F642}✅\u{1F44C}]+$/u.test(texto.trim());
  return AFIRMACOES.has(norm);
}

/** Anexa um fato curto ao texto da seção, sem substituir o que já existe. */
function appendFato(prev: string, fato: string): string {
  const p = (prev ?? "").trim();
  const f = fato.trim();
  if (!p) return f;
  if (p.toLowerCase().includes(f.toLowerCase())) return p;
  return `${p}\n${f}`;
}

const CAMPOS_FAMILIA = ["composicao", "rotina", "recursos", "dinamica"];

type SecaoJson = { texto?: string } | null;

/**
 * Aplica a sugestão pendente mais recente da Ayla (últimas 2h) ao Kolo Vivo,
 * anexando ao texto existente, e marca como aprovada. Retorna null se não há
 * nada pendente — aí o "sim" segue pro fluxo normal.
 */
async function confirmarSugestaoPendente(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{ texto: string; membro_atipico_id: string | null; nomeMembro: string | null } | null> {
  const desde = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: sug } = await supabase
    .from("sugestao_perfil_vivos")
    .select("id, membro_atipico_id, camada, campo, texto_sugerido")
    .eq("family_account_id", familyId)
    .eq("origem", "ayla")
    .eq("status", "pendente")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sug) return null;

  const now = new Date().toISOString();

  if (sug.camada === "camada1" && sug.membro_atipico_id) {
    const ok = await aplicarSugestaoNoMembro(
      supabase,
      familyId,
      sug.membro_atipico_id,
      sug.campo,
      sug.texto_sugerido,
    );
    if (!ok) return null;
  } else if (sug.camada === "camada2") {
    if (!CAMPOS_FAMILIA.includes(sug.campo)) return null;
    const { data: atual } = await supabase
      .from("perfil_vivo_familia")
      .select("composicao, rotina, recursos, dinamica")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const secaoAtual = (atual as Record<string, SecaoJson> | null)?.[sug.campo] ?? {};
    const novoTexto = appendFato(secaoAtual?.texto ?? "", sug.texto_sugerido);
    const { error } = await supabase
      .from("perfil_vivo_familia")
      .upsert({ family_account_id: familyId, [sug.campo]: { ...secaoAtual, texto: novoTexto, atualizado_em: now } });
    if (error) return null;
  } else {
    return null;
  }

  await supabase
    .from("sugestao_perfil_vivos")
    .update({ status: "aprovada", decidido_em: now })
    .eq("id", sug.id);

  let nomeMembro: string | null = null;
  if (sug.membro_atipico_id) {
    const { data: m } = await supabase
      .from("membros_atipicos")
      .select("nome")
      .eq("id", sug.membro_atipico_id)
      .maybeSingle();
    nomeMembro = m?.nome ?? null;
  }
  return { texto: sug.texto_sugerido, membro_atipico_id: sug.membro_atipico_id, nomeMembro };
}

// ============================================================
// Helpers
// ============================================================

type FamiliaEnvio = {
  family_account_id: string;
  whatsapp_e164: string;
  nomeMae: string;
  /** Vínculo + gênero do responsável, pra Ayla não presumir "mãe". */
  cuidador: CuidadorDescrito;
  membros: Array<{
    id: string;
    nome: string;
    data_nascimento: string | null;
    perfil: string | null;
    genero: "masculino" | "feminino" | "neutro" | null;
  }>;
};

async function loadFamiliaParaEnvio(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<FamiliaEnvio | null> {
  const [{ data: family }, { data: profile }, { data: membros }] = await Promise.all([
    supabase
      .from("family_accounts")
      .select("id, whatsapp_e164")
      .eq("id", familyAccountId)
      .maybeSingle(),
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar, papel, papel_outro, genero_responsavel")
      .eq("family_account_id", familyAccountId)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, perfil, genero")
      .eq("family_account_id", familyAccountId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!family || !family.whatsapp_e164) return null;
  return {
    family_account_id: familyAccountId,
    whatsapp_e164: family.whatsapp_e164,
    nomeMae: profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "oi",
    cuidador: descricaoCuidador({
      papel: (profile as { papel?: string | null } | null)?.papel ?? null,
      papelOutro: (profile as { papel_outro?: string | null } | null)?.papel_outro ?? null,
      genero: (profile as { genero_responsavel?: Genero } | null)?.genero_responsavel ?? null,
    }),
    membros: membros ?? [],
  };
}

async function enviarEPersistir(
  supabase: SupabaseClient,
  params: {
    family_account_id: string;
    membro_atipico_id: string | null;
    phone: string;
    texto: string;
    category: "proativa" | "reativa";
    tipo: AylaTipoProativa | AylaTipoReativa;
    /** Metadados opcionais que vão pro ayla_send_log.payload.meta (auditoria). */
    meta?: Record<string, unknown>;
  },
): Promise<EnvioResultado> {
  let resultado: EnvioResultado;
  let providerResp: unknown = null;
  let erro: string | null = null;

  try {
    const r = await enviarTexto({ phoneE164: params.phone, texto: params.texto });
    providerResp = r.raw;
    resultado = { enviada: true, messageId: r.messageId };
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha desconhecida";
    resultado = { enviada: false, motivo: erro };
  }

  // Auditoria
  await supabase.from("ayla_send_log").insert({
    family_account_id: params.family_account_id,
    template_key: params.tipo,
    payload: {
      phone: params.phone,
      texto: params.texto,
      ...(params.meta ? { meta: params.meta } : {}),
    },
    resposta_provider: providerResp as Record<string, unknown> | null,
    status: resultado.enviada ? "enviada" : "falha",
    erro,
  });

  // Mensagem (mesmo se falhou, pra deixar rastro)
  if (resultado.enviada) {
    await supabase.from("ayla_messages").insert({
      family_account_id: params.family_account_id,
      membro_atipico_id: params.membro_atipico_id,
      direcao: "outbound",
      category: params.category,
      tipo: params.tipo,
      texto: params.texto,
      enviada_em: new Date().toISOString(),
    });

    await supabase
      .from("ayla_preferences")
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq("family_account_id", params.family_account_id);
  }

  return resultado;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Resumo curto do Kolo Vivo do membro pra ancorar a voz da Ayla. */
async function carregarKoloVivoResumo(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<string> {
  if (!membroId) return "";
  const { data } = await supabase
    .from("perfil_vivo_membro")
    .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
    .eq("membro_atipico_id", membroId)
    .maybeSingle();
  if (!data) return "";
  const row = data as Record<string, unknown>;
  const labels: Record<string, string> = {
    essencial: "O essencial",
    como_e: "Como é / interesses",
    corpo_rotina: "Corpo e rotina",
    desafios_regulacao: "Desafios e regulação",
    sensorial: "Sensorial",
  };
  const linhas: string[] = [];
  for (const [campo, label] of Object.entries(labels)) {
    const resumo = resumoCampoKV(row[campo]);
    if (resumo) linhas.push(`${label}: ${resumo}`);
  }
  // Domínios novos vivem em categorias_extras (onboarding distribui desafios
  // por tema; rotina/etc. também ficam aqui). Sem isso a Ayla "não sabe".
  const extras = row.categorias_extras as Record<string, unknown> | null;
  if (extras && typeof extras === "object") {
    const extrasLabels: Record<string, string> = {
      comunicacao: "Comunicação",
      socializacao: "Socialização",
      motor: "Motor",
      autonomia: "Autonomia",
      foco: "Foco",
      sono: "Sono",
      nutricional: "Alimentação",
      emocional: "Regulação emocional",
      rotina: "Rotina",
    };
    for (const [campo, label] of Object.entries(extrasLabels)) {
      const resumo = resumoCampoKV(extras[campo]);
      if (resumo) linhas.push(`${label}: ${resumo}`);
    }
  }
  return linhas.join("\n");
}

/**
 * Últimas perguntas que a mãe fez nas Estratégias (in-app), pra a Ayla
 * mostrar que acompanha os dois canais — não só o WhatsApp.
 */
async function carregarEstrategiasRecentes(
  supabase: SupabaseClient,
  familyId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("conversas")
    .select("titulo, created_at")
    .eq("family_account_id", familyId)
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? [])
    .map((c) => (typeof c.titulo === "string" ? c.titulo.trim() : ""))
    .filter((t) => t.length > 0);
}

/**
 * Extrai o texto legível de um campo jsonb do Kolo Vivo. Os campos guardam
 * formas diferentes: { texto } (livre), { interesses: [] } e
 * { desafios_iniciais: [] } (onboarding), { conquista_inicial } (essencial).
 * Antes líamos só `.texto` — por isso a Ayla "não sabia" interesses/desafios.
 */
function resumoCampoKV(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const o = json as Record<string, unknown>;
  const partes: string[] = [];
  if (typeof o.texto === "string" && o.texto.trim()) partes.push(o.texto.trim());
  for (const k of ["interesses", "desafios_iniciais"]) {
    const v = o[k];
    if (Array.isArray(v)) {
      const itens = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (itens.length) partes.push(itens.join(", "));
    }
  }
  if (typeof o.conquista_inicial === "string" && o.conquista_inicial.trim()) {
    partes.push(o.conquista_inicial.trim());
  }
  return partes.join(" · ");
}

/** Últimos turnos da conversa (pra Ayla não soar amnésica), sem a msg atual. */
async function carregarHistorico(
  supabase: SupabaseClient,
  familyId: string,
  mensagemAtual: string,
): Promise<Array<{ de: "mae" | "ayla"; texto: string }>> {
  const { data } = await supabase
    .from("ayla_messages")
    .select("direcao, texto, created_at")
    .eq("family_account_id", familyId)
    .order("created_at", { ascending: false })
    .limit(9);
  const turnos = (data ?? [])
    .reverse()
    .filter((m) => typeof m.texto === "string" && m.texto.trim())
    .map((m) => ({
      de: (m.direcao === "inbound" ? "mae" : "ayla") as "mae" | "ayla",
      texto: m.texto as string,
    }));
  // Remove a própria mensagem recém-inserida do fim, pra não duplicar.
  if (turnos.length > 0) {
    const ultimo = turnos[turnos.length - 1];
    if (ultimo.de === "mae" && ultimo.texto.trim() === mensagemAtual.trim()) {
      turnos.pop();
    }
  }
  return turnos.slice(-6);
}
