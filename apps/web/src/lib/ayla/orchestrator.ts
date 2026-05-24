import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocalISO } from "@/lib/idade";
import { enviarTexto, type InboundWhatsApp } from "./whatsappSender";
import { podeEnviarProativa } from "./rules";
import { parseInbound, detectarComando } from "./parser";
import { gerarRespostaAyla, type RespostaParams } from "./responder";
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

  const texto = await templateRotinaDiaria(supabase, {
    nomeMae: ctx.nomeMae,
    nomeMembro: membroFoco.nome,
    seed: `${familyAccountId}-${agora.toDateString()}`,
  });

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: membroFoco.id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "rotina",
  });
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
  // 1. Identifica família pelo número
  const phoneSemMais = inbound.phoneE164.replace(/^\+/, "");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, whatsapp_e164")
    .or(`whatsapp_e164.eq.${inbound.phoneE164},whatsapp_e164.eq.+${phoneSemMais}`)
    .maybeSingle();
  if (!family) {
    // Mensagem de número desconhecido — registra mas não responde
    return { tratada: false };
  }

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

  const parsed = await parseInbound({
    texto: inbound.texto,
    membros: ctx.membros,
    ultimoMembroFoco: ultimoNome ?? null,
  });

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

  const nomeMembro = parsed.membro_atipico_id
    ? (ctx.membros.find((m) => m.id === parsed.membro_atipico_id)?.nome ?? null)
    : null;
  const koloVivoResumo = await carregarKoloVivoResumo(supabase, parsed.membro_atipico_id);
  const historico = await carregarHistorico(supabase, family.id, inbound.texto);

  const resp = await enviarRespostaEmChunks(supabase, {
    family_account_id: family.id,
    membro_atipico_id: parsed.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    tipo: precisaEscolherMembro ? "clarificacao_identificacao" : "resposta_registro",
    params: {
      nomeMae: ctx.nomeMae,
      nomeMembro,
      koloVivoResumo,
      historico,
      mensagem: inbound.texto,
      sinais: {
        conquista: parsed.conquista,
        desafio: parsed.desafio,
        emocao_mae: parsed.emocao_mae,
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

  const textoCompleto = await gerarRespostaAyla(args.params, async (par) => {
    // 1º parágrafo: pouco "digitando" (chega logo). Próximos: ritmo natural.
    const delay = primeiro ? 1 : Math.min(Math.max(Math.round(par.length / 35), 1), 4);
    primeiro = false;
    try {
      const r = await enviarTexto({ phoneE164: args.phone, texto: par, delaySegundos: delay });
      providerResp = r.raw;
      messageId = r.messageId;
    } catch (e) {
      erro = e instanceof Error ? e.message : "falha no envio";
    }
  });

  const enviada = erro == null;

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
// Persistência de registro derivado do parser
// ============================================================

async function persistirRegistro(
  supabase: SupabaseClient,
  familyId: string,
  p: ParserResult,
): Promise<void> {
  if (!p.membro_atipico_id) return;

  // 1. Daily check-in
  await supabase.from("ayla_daily_checkins").upsert(
    {
      family_account_id: familyId,
      membro_atipico_id: p.membro_atipico_id,
      date: hojeLocalISO(),
      conquista_extraida: p.conquista,
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
  if (p.conquista || p.desafio || p.observacao_livre) {
    const incompleto =
      Boolean(p.estado_adulto || p.reacao_adulto || p.quem_estava) === false &&
      Boolean(p.conquista || p.desafio); // Tem evento mas sem Camada B

    await supabase.from("diarios").insert({
      family_account_id: familyId,
      membro_atipico_id: p.membro_atipico_id,
      data: hojeLocalISO(),
      conquista: p.conquista,
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

  // 3. Sugestão de Kolo Vivo
  if (p.sugestao_kolo_vivo && p.texto_kolo_vivo_sugerido) {
    await supabase.from("sugestao_perfil_vivos").insert({
      family_account_id: familyId,
      membro_atipico_id: p.membro_atipico_id,
      camada: "camada1",
      campo: p.campo_kolo_vivo_sugerido ?? "como_e",
      texto_sugerido: p.texto_kolo_vivo_sugerido,
      origem: "ayla",
      origem_detalhe: { confianca: p.confianca },
    });
  }
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

const CAMPOS_MEMBRO = ["essencial", "como_e", "corpo_rotina", "desafios_regulacao", "sensorial"];
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
    if (!CAMPOS_MEMBRO.includes(sug.campo)) return null;
    const { data: atual } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
      .eq("membro_atipico_id", sug.membro_atipico_id)
      .maybeSingle();
    const secaoAtual = (atual as Record<string, SecaoJson> | null)?.[sug.campo] ?? {};
    const novoTexto = appendFato(secaoAtual?.texto ?? "", sug.texto_sugerido);
    const { error } = await supabase.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: sug.membro_atipico_id,
        family_account_id: familyId,
        [sug.campo]: { ...secaoAtual, texto: novoTexto, atualizado_em: now },
      },
      { onConflict: "membro_atipico_id" },
    );
    if (error) return null;
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
  membros: Array<{ id: string; nome: string }>;
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
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyAccountId)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyAccountId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!family || !family.whatsapp_e164) return null;
  return {
    family_account_id: familyAccountId,
    whatsapp_e164: family.whatsapp_e164,
    nomeMae: profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "oi",
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
    payload: { phone: params.phone, texto: params.texto },
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
    .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
    .eq("membro_atipico_id", membroId)
    .maybeSingle();
  if (!data) return "";
  const labels: Record<string, string> = {
    essencial: "O essencial",
    como_e: "Como é / interesses",
    corpo_rotina: "Corpo e rotina",
    desafios_regulacao: "Desafios e regulação",
    sensorial: "Sensorial",
  };
  const linhas: string[] = [];
  for (const [campo, label] of Object.entries(labels)) {
    const texto = ((data as Record<string, { texto?: string } | null>)[campo]?.texto ?? "").trim();
    if (texto) linhas.push(`${label}: ${texto}`);
  }
  return linhas.join("\n");
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
