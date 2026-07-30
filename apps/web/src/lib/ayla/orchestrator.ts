import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocalISO, idadeAnos } from "@/lib/idade";
import { chaveTelefoneBR } from "@/lib/telefone";
import { enviarTexto, type InboundWhatsApp } from "./whatsappSender";
import { podeEnviarProativa } from "./rules";
import { parseInbound, detectarComando } from "./parser";
import {
  membroCampoStorage,
  MEMBRO_CAMPOS_TODOS,
  MEMBRO_CAMPO_LABEL,
} from "@/lib/kolo-vivo/campos";
import {
  subcamposDe,
  parsearSubcampos,
  serializarSubcampos,
} from "@/lib/kolo-vivo/subcampos";
import { detectarConflitoCrossCampo } from "./conflito-kolo-vivo";
import { rotearFatoSubcampo } from "./incorporar-subcampo";
import { gerarRespostaAyla, type RespostaParams } from "./responder";
import { descricaoCuidador, type CuidadorDescrito, type Genero } from "./pronomes";
import { gerarSugestaoRepertorio } from "./repertorio";
import { decidirDedup } from "./dedup-kolo-vivo";
import { decidirDedupDiario } from "./dedup-diario";
import {
  limparNomeAusente,
  templateBoasVindas,
  templateBoasVindasComDesafio,
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
import { traduzirProativa } from "./traduzir";
import { montarPonteWhatsApp, gerarMagicLink, montarPlanoFimDeSemana } from "./ponte";
import { aguardarTurnoDaMae, descartarTurnoPendente } from "./lote-inbound";
import { pedeUmPlano } from "@/lib/ia/pedido-plano";
import {
  rotinaConversaPendente,
  conduzirRotina,
  pedeRotina,
  pedeRotinaDeUmDia,
  pedirRotinaDoDia,
  pedeEditarRotina,
  editarRotina,
} from "./rotina-guiada";
import { classificarIntencao } from "./intent";
import { criarLinkAcesso, pedeAcessoAoApp } from "@/lib/auth/acesso-link";
import {
  criancaPendente,
  resolverCriancaPendente,
  templateConviteCriancaEspecifica,
} from "./crianca-especifica";
import { extrairESalvarEventos } from "./eventos";
import { assinaturaLiberada } from "@/lib/auth/assinatura";
import { classificarAreasDiario } from "@/lib/ia/classificar-area";
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

  // Desafio que a pessoa marcou no cadastro → boas-vindas PERSONALIZADA (cita o
  // problema + pergunta fácil + oferece áudio), pra puxar a resposta no WhatsApp
  // e cair no plano guiado. Sem desafio → template comum.
  let desafioTop: string | null = null;
  try {
    const { data: pv } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroFoco.id)
      .maybeSingle();
    const extras = pv?.categorias_extras as { desafios_onboarding?: string[] } | null;
    desafioTop = extras?.desafios_onboarding?.[0] ?? null;
  } catch {
    /* sem desafio, usa a template comum */
  }

  const texto = desafioTop
    ? templateBoasVindasComDesafio({
        nomeMae: ctx.nomeMae,
        nomeMembro: membroFoco.nome,
        genero: membroFoco.genero,
        desafio: desafioTop,
      })
    : await templateBoasVindas(supabase, {
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
// PROATIVA: convite pra definir UMA criança específica
// ============================================================

/** Quantas vezes a Ayla convida antes de deixar em paz, e o intervalo. */
const CONVITE_MAX = 3;
const CONVITE_INTERVALO_DIAS = 3;

/**
 * O campo do nome veio com recado em vez de nome ("Cuido de Várias Crianças.
 * Sou Terapeuta!")? Então nenhuma proativa de engajamento faz sentido — a Ayla
 * explica como funciona e convida a pessoa a escolher UMA criança (nome +
 * idade), inclusive uma que ela atenda ou um caso simulado.
 *
 * Devolve null quando NÃO há pendência (a rotina normal segue), ou o resultado
 * do envio/bloqueio quando há. Convida no máximo CONVITE_MAX vezes, a cada
 * CONVITE_INTERVALO_DIAS — se ela não quer responder, a Ayla não insiste.
 */
async function sendConviteCriancaEspecifica(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date,
): Promise<EnvioResultado | null> {
  const pendente = await criancaPendente(supabase, familyAccountId);
  if (!pendente) return null;

  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "crianca_especifica",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const { data: jaEnviados } = await supabase
    .from("ayla_messages")
    .select("created_at")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "crianca_especifica")
    .order("created_at", { ascending: false });
  const convites = jaEnviados ?? [];
  if (convites.length >= CONVITE_MAX) {
    return { enviada: false, motivo: "Já convidou 3x a definir a criança — não insiste." };
  }
  const ultimo = convites[0]?.created_at as string | undefined;
  if (ultimo) {
    const dias = (agora.getTime() - new Date(ultimo).getTime()) / (24 * 60 * 60 * 1000);
    if (dias < CONVITE_INTERVALO_DIAS) {
      return { enviada: false, motivo: `Convite enviado há ${dias.toFixed(1)} dia(s) — aguardando.` };
    }
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  return await enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: pendente.membroId,
    phone: ctx.whatsapp_e164,
    texto: templateConviteCriancaEspecifica({ nomeMae: ctx.nomeMae, motivo: pendente.motivo }),
    category: "proativa",
    tipo: "crianca_especifica",
    meta: { motivo: pendente.motivo, nome_cru: pendente.nomeCru, tentativa: convites.length + 1 },
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
  // Antes de qualquer engajamento: existe uma criança específica pra falar? Se o
  // campo do nome veio com recado, a Ayla PERCEBE e conduz — explica como ela
  // funciona e convida a escolher uma criança (nome + idade). Vai no lugar da
  // rotina do dia, no mesmo horário que já roda.
  const convite = await sendConviteCriancaEspecifica(supabase, familyAccountId, agora);
  if (convite) return convite;

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
// PROATIVA: Recuperação pós-plano — reabre a conversa que morreu
// ============================================================

/**
 * Quem recebeu um plano e ficou no vácuo: a Ayla reabre a conversa, pergunta se
 * foi ÚTIL (deu direção), oferece continuar o tema, e traz o link caso o PDF não
 * tenha chegado. NÃO cobra execução ("testou?") — o plano pode ser só inspiração.
 * Base do toque de 3 min e do disparo one-off de recuperação. Idempotente (24h).
 */
export async function sendRecuperacaoPlano(
  supabase: SupabaseClient,
  familyAccountId: string,
  plano: { id: string; tema: string | null; membro_atipico_id: string | null },
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "recuperacao_plano",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  // Idempotência: no máx 1 recuperação por família a cada 24h.
  const desde = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: ja } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .eq("tipo", "recuperacao_plano")
    .gte("created_at", desde)
    .limit(1);
  if ((ja?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Recuperação já enviada nas últimas 24h." };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const membro = plano.membro_atipico_id
    ? ctx.membros.find((m) => m.id === plano.membro_atipico_id)
    : null;
  const tema = (plano.tema ?? "").trim();
  const refTema = tema ? ` sobre ${tema}` : "";
  const refMembro = membro?.nome ? ` pra ${membro.nome}` : "";
  const link = await gerarMagicLink(supabase, {
    familyId: familyAccountId,
    next: `/planos/${plano.id}`,
  });
  const linhaLink = link ? `\n\n(Se não tiver chegado, é só abrir aqui 👉 ${link})` : "";
  const texto = `Oi, ${ctx.nomeMae} 🌿 Montei o plano estratégico${refTema}${refMembro} hoje. Conseguiu abrir? Me conta: você gostou? Acha que vai ajudar no dia a dia de vocês? Se tiver algo que não encaixou, a gente ajusta — e se quiser, seguimos conversando sobre isso sem pressa. 💛${linhaLink}`;

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: plano.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "recuperacao_plano",
    meta: { plano_id: plano.id },
  });
}

/**
 * Recuperação pós-ROTINA VISUAL — espelha a do plano.
 *
 * Receber a rotina em cartões ilustrados é o outro momento que ENCANTA (Sérgio,
 * 29/07) — e o encanto se perde se ela abre sozinha e a conversa morre. Ainda
 * por cima os cartões demoram a ser gerados: quando ficam prontos, a mãe já
 * saiu do WhatsApp. Este toque traz ela de volta pra ver o resultado.
 */
export async function sendRecuperacaoRotina(
  supabase: SupabaseClient,
  familyAccountId: string,
  rotina: { id: string; nome: string | null; membro_atipico_id: string | null },
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "recuperacao_rotina",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  // Idempotência 24h — e não empilha com a recuperação do plano no mesmo dia
  // (duas cobranças de feedback seguidas viram chateação).
  const desde = new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: ja } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyAccountId)
    .in("tipo", ["recuperacao_rotina", "recuperacao_plano"])
    .gte("created_at", desde)
    .limit(1);
  if ((ja?.length ?? 0) > 0) {
    return { enviada: false, motivo: "Já pedi feedback de material nas últimas 24h." };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const membro = rotina.membro_atipico_id
    ? ctx.membros.find((m) => m.id === rotina.membro_atipico_id)
    : null;
  const refNome = (rotina.nome ?? "").trim();
  const refRotina = refNome ? ` "${refNome}"` : "";
  const refMembro = membro?.nome ? ` d${membro.nome.endsWith("a") ? "a" : "o"} ${membro.nome}` : "";
  const link = await gerarMagicLink(supabase, {
    familyId: familyAccountId,
    next: `/ludico/rotinas/${rotina.id}`,
  });
  const linhaLink = link ? `\n\n(Pra abrir os cartões: ${link})` : "";
  const texto = `Oi, ${ctx.nomeMae} 🌿 A rotina${refRotina}${refMembro} ficou pronta. Conseguiu ver os cartões? Me conta o que você achou — e se ficou com a cara ${membro?.nome ? `d${membro.nome.endsWith("a") ? "a" : "o"} ${membro.nome}` : "dele(a)"}. Se algum não ficou bom, a gente refaz rapidinho. 💛${linhaLink}`;

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: rotina.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "recuperacao_rotina",
    meta: { rotina_id: rotina.id },
  });
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

/** Sinais FORTES de que quem escreve é uma criança / não é o titular (número
 * errado no cadastro). Conservador de propósito — falso-positivo só gera um
 * alerta pra admin, nunca bloqueio automático. */
function pareceCrianca(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  return (
    /\bsou (uma |um )?crian[çc]a\b/.test(t) ||
    /\bsou (uma |um )?menin[ao]\b/.test(t) ||
    /\bpeguei o (celular|telefone|cel)\b/.test(t) ||
    /\bcelular (do|da) (meu|minha)\b/.test(t)
  );
}

/**
 * A Ayla reativa só entrega o SERVIÇO pra trial-válido / assinante / admin —
 * igual à web (requireActiveWrite). Admin/staff (controle_acessos.ativo) nunca
 * é bloqueado. Expirado recebe um convite gentil pra assinar (não o serviço).
 */
async function aylaServicoLiberado(supabase: SupabaseClient, familyId: string): Promise<boolean> {
  const { data: fam } = await supabase
    .from("family_accounts")
    .select("user_id")
    .eq("id", familyId)
    .maybeSingle();
  if (fam?.user_id) {
    const { data: acesso } = await supabase
      .from("controle_acessos")
      .select("ativo")
      .eq("user_id", fam.user_id as string)
      .maybeSingle();
    if (acesso?.ativo) return true;
  }
  const { data: sub } = await supabase
    .from("subscription_accesses")
    .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
    .eq("family_account_id", familyId)
    .maybeSingle();
  return assinaturaLiberada(sub);
}

/**
 * Criança citada PELO NOME na mensagem atual (famílias 2+). Tem prioridade sobre
 * a "criança da conversa" — se a mãe diz "a Manu", é a Manu, mesmo que a conversa
 * anterior fosse de outro filho (bug Manu→Mario ao trocar de assunto).
 */
function membroMencionado(
  texto: string,
  membros: Array<{ id: string; nome?: string | null }>,
): string | null {
  const t = (texto ?? "").toLowerCase();
  for (const m of membros) {
    const primeiro = (m.nome ?? "").trim().split(/\s+/)[0]?.toLowerCase();
    if (primeiro && primeiro.length >= 3) {
      const re = new RegExp(`\\b${primeiro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(t)) return m.id;
    }
  }
  return null;
}

/**
 * Qual criança a conversa está tratando AGORA (famílias 2+). Pega o último
 * membro identificado nas mensagens recentes (2h) — pra o plano/rotina não
 * cair no `membros[0]` e trocar de filho no meio (bug Manu→Mario). Null = sem
 * pista recente (aí o handler usa o default).
 */
async function criancaDaConversa(supabase: SupabaseClient, familyId: string): Promise<string | null> {
  const desde = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("ayla_messages")
    .select("membro_atipico_id")
    .eq("family_account_id", familyId)
    .not("membro_atipico_id", "is", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.membro_atipico_id as string | null) ?? null;
}

function temConteudo(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 1;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(temConteudo);
  return Boolean(v);
}

/**
 * Lacunas do perfil por domínio — o que já tem × o que falta. Dá pra a Ayla
 * "perfil no centro": perguntar só o pertinente, sem repetir, e saber o que
 * ainda falta pra montar um relatório. Devolve uma frase curta pro prompt.
 */
async function carregarLacunasKoloVivo(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<string> {
  if (!membroId) return "";
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const linha = (data ?? {}) as Record<string, unknown>;
    const extras = (linha.categorias_extras ?? {}) as Record<string, unknown>;
    const preenchidos: string[] = [];
    const faltando: string[] = [];
    for (const campo of MEMBRO_CAMPOS_TODOS) {
      const v = membroCampoStorage(campo) === "toplevel" ? linha[campo] : extras[campo];
      (temConteudo(v) ? preenchidos : faltando).push(MEMBRO_CAMPO_LABEL[campo] ?? campo);
    }
    const partes: string[] = [];
    if (preenchidos.length) partes.push(`JÁ TEM no perfil: ${preenchidos.join(", ")}`);
    if (faltando.length) partes.push(`AINDA FALTA (pergunte só se vier a propósito): ${faltando.join(", ")}`);
    return partes.join(". ");
  } catch {
    return "";
  }
}

/** Já convidou essa família pra assinar nas últimas 12h? (dedup do convite) */
async function convidouAssinarRecente(supabase: SupabaseClient, familyId: string): Promise<boolean> {
  const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "outbound")
    .eq("tipo", "assinatura_nudge")
    .gte("created_at", desde)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Avisa a admin (WhatsApp) que um número parece errado/criança, com o número e
 * o link pro Admin. Dedup: no máx 1 alerta por família a cada 24h. */
async function alertarNaoTitular(
  supabase: SupabaseClient,
  familyId: string,
  phone: string,
  texto: string,
): Promise<void> {
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: ja } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .eq("texto", "[alerta-nao-titular]")
      .gte("created_at", desde)
      .limit(1);
    if ((ja?.length ?? 0) > 0) return;

    const alerta = process.env.ALERTA_WHATSAPP || "+5511994770067";
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const msg = `⚠️ Kolo: parece que uma criança ou número errado está conversando com a Ayla.\nNúmero: ${phone}\nDisse: "${texto.slice(0, 80)}"\nConfira e bloqueie se precisar:\n${base}/admin/familias`;
    await enviarTexto({ phoneE164: alerta, texto: msg });
    await supabase.from("ayla_messages").insert({
      family_account_id: familyId,
      direcao: "outbound",
      texto: "[alerta-nao-titular]",
      tipo: "campanha_operacional",
    });
  } catch (e) {
    console.warn("[ayla] alerta não-titular falhou:", e instanceof Error ? e.message : e);
  }
}

export async function processInbound(
  supabase: SupabaseClient,
  inboundRecebido: InboundWhatsApp,
): Promise<{ tratada: boolean; familia?: string; resposta?: EnvioResultado }> {
  // `let` porque o CONTROLE DE TURNO (mais abaixo) troca o texto pelo lote — as
  // mensagens que a mãe mandou em sequência viram uma fala só. Todo o resto da
  // função segue lendo `inbound` normalmente, sem saber se veio 1 ou 4 balões.
  let inbound = inboundRecebido;
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

  // 1a. BLOQUEIO: se a Ayla foi desativada/bloqueada pra essa família (opt-out
  // "sair", ou bloqueio manual do admin — ex.: criança/não-titular usando o
  // número), NÃO responde a nada. Antes o reativo ignorava isso e continuava
  // respondendo (inclusive pra quem pediu "sair").
  const { data: pref } = await supabase
    .from("ayla_preferences")
    .select("desativada, consentimento_em")
    .eq("family_account_id", family.id)
    .maybeSingle();
  // Bloqueada DE VERDADE = desativada E já tinha consentido (opt-out "sair" ou
  // bloqueio manual do admin). `desativada` + SEM consentimento é só o padrão do
  // cadastro (LGPD, "ainda não consentiu") — NÃO bloqueia o reativo.
  if (pref?.desativada && pref?.consentimento_em) {
    console.warn(`[ayla] inbound de família BLOQUEADA (opt-out/manual), ignorado: ${family.id}`);
    return { tratada: false, familia: family.id };
  }

  // 1a-alerta. CRIANÇA / NÚMERO ERRADO: sinal forte de que quem escreve não é o
  // titular. NÃO responde (evita o loop que aconteceu com a Isis) e AVISA a admin
  // no WhatsApp com o número + link pro Admin, pra ela revisar e bloquear.
  if (pareceCrianca(inbound.texto)) {
    console.warn(`[ayla] possível criança/não-titular: ${inbound.phoneE164} (family ${family.id})`);
    await alertarNaoTitular(supabase, family.id, inbound.phoneE164, inbound.texto);
    return { tratada: false, familia: family.id };
  }

  // 1b. Há uma oferta de fim de semana esperando resposta? (calcular ANTES
  // de persistir o inbound atual, pra "primeira resposta" ser detectada).
  const ofertaFds = await ofertaFimDeSemanaPendente(
    supabase,
    family.id,
    inbound.recebidaEm,
  );

  const rotinaConversa = await rotinaConversaPendente(supabase, family.id, inbound.recebidaEm);

  // 2. Persiste inbound — E usa como TRAVA DE IDEMPOTÊNCIA. A Z-API entrega o
  // mesmo webhook mais de uma vez (at-least-once); o índice único em
  // zaap_message_id faz o segundo insert virar no-op → paramos aqui, evitando
  // gerar plano/resposta em duplicata (o bug dos 2 PDFs iguais).
  const baseInbound = {
    family_account_id: family.id,
    direcao: "inbound",
    texto: inbound.texto,
    midia_url: inbound.midiaUrl ?? null,
    midia_tipo: inbound.midiaTipo ?? null,
    recebida_em: inbound.recebidaEm.toISOString(),
  };
  if (inbound.messageId) {
    const { data: claim, error: claimErr } = await supabase
      .from("ayla_messages")
      .upsert(
        { ...baseInbound, zaap_message_id: inbound.messageId },
        { onConflict: "zaap_message_id", ignoreDuplicates: true },
      )
      .select("id");
    if (claimErr) {
      // Falha inesperada (ex.: coluna ainda não migrada) — NÃO trava a Ayla:
      // insere normal e segue (sem dedup nesse caso).
      console.error("[ayla] claim de idempotência falhou, seguindo:", claimErr.message);
      await supabase.from("ayla_messages").insert(baseInbound);
    } else if (!claim || claim.length === 0) {
      console.warn(
        `[ayla] inbound duplicado ignorado (messageId ${inbound.messageId})`,
      );
      return { tratada: false, familia: family.id };
    }
  } else {
    // Sem id (payload raro) — não dá pra deduplicar; insere normal.
    await supabase.from("ayla_messages").insert(baseInbound);
  }

  // 3. Comando? — antes do parser IA, mais rápido (PAUSAR/SAIR valem mesmo em
  // abordagem). Fica ANTES do controle de turno de propósito: comando é
  // autocontido e tem que valer na hora, sem esperar silêncio nenhum.
  const cmd = detectarComando(inbound.texto);
  if (cmd) {
    const resp = await processarComando(supabase, family.id, cmd);
    await descartarTurnoPendente(supabase, family.id);
    return { tratada: true, familia: family.id, resposta: resp };
  }

  // 3a. CONTROLE DE TURNO — a partir daqui, UMA resposta por fala da mãe.
  // Ela manda 3, 4 mensagens seguidas; sem isto rodavam 3, 4 Aylas em paralelo,
  // cada uma cega às outras (a mesma pergunta 3× no mesmo minuto, resposta
  // acolhendo conquista que não existia). Esta execução espera o silêncio e,
  // se chegou mensagem nova, CEDE A VEZ — quem chegou depois responde por
  // todas. Ver lib/ayla/lote-inbound.ts.
  const turno = await aguardarTurnoDaMae(supabase, {
    familyId: family.id,
    textoAtual: inbound.texto,
  });
  if (!turno) return { tratada: false, familia: family.id };
  if (turno.quantidade > 1) {
    // O resto da função (parser, responder, ponte) passa a ver a fala inteira.
    inbound = { ...inbound, texto: turno.texto };
  }

  // 3b. CRM Fase B: se o lead está em ABORDAGEM manual, a Ayla NÃO responde —
  // registra a resposta na thread do CRM, marca "aguardando você" e avisa a
  // Karina no celular. Ela responde pelo CRM. (Encerrar a abordagem devolve o
  // controle pra Ayla.)
  {
    const { data: crm } = await supabase
      .from("crm_leads")
      .select("em_abordagem")
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (crm?.em_abordagem) {
      await supabase.from("crm_mensagens").insert({
        family_account_id: family.id,
        direcao: "recebida",
        texto: inbound.texto,
      });
      await supabase
        .from("crm_leads")
        .update({ aguardando_resposta: true, updated_at: new Date().toISOString() })
        .eq("family_account_id", family.id);
      try {
        const { notificarRespostaLead } = await import("@/lib/admin/notificacoes");
        await notificarRespostaLead(supabase, family.id, inbound.texto);
      } catch (e) {
        console.warn("[crm] aviso de resposta ao lead falhou:", e instanceof Error ? e.message : e);
      }
      return { tratada: true, familia: family.id };
    }
  }

  // 2b. ASSINATURA (GATE): a Ayla reativa só entrega o serviço pra trial-válido /
  // assinante / admin — igual à web. Expirado (não-admin) recebe um convite pra
  // assinar (magic link) em vez do serviço. NUNCA fica em silêncio: a 1ª vez é o
  // convite completo; se já convidou nas últimas 12h, manda um lembrete CURTO
  // (não spamma, mas não deixa no vácuo). Comandos (sair/pausar) seguem acima.
  //
  // ⚠️ ORDEM IMPORTA: este gate roda ANTES de qualquer handler que GERA
  // entregável (plano de fim de semana, rotina/PDF, plano via ponte). Se ficar
  // depois de um deles, o entregável vaza de graça pra trial vencido — foi o que
  // aconteceu no caso Camile/Gramado: uma oferta de fim de semana pendente fazia
  // o passo 3a montar o roteiro+PDF antes de o gate ser checado. Só COMANDOS e o
  // fluxo de ABORDAGEM do CRM (lead ainda não-assinante) podem vir acima daqui.
  if (!(await aylaServicoLiberado(supabase, family.id))) {
    const ctxA = await loadFamiliaParaEnvio(supabase, family.id);
    if (ctxA) {
      const link = await gerarMagicLink(supabase, { familyId: family.id, next: "/assinatura" });
      const jaConvidou = await convidouAssinarRecente(supabase, family.id);
      const texto = jaConvidou
        ? `🌿 Pra gente continuar, é só assinar aqui:\n${link}`
        : `Oi, ${ctxA.nomeMae}! Eu adoraria seguir te ajudando 🌿 Mas seu período grátis acabou. Pra a gente continuar — estratégias, rotina, tudo o que você já conhece — é só assinar aqui:\n${link}\n\nO que você me contou fica tudo guardado. 💛`;
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: null,
        phone: ctxA.whatsapp_e164,
        texto,
        category: "reativa",
        tipo: "assinatura_nudge",
      });
      return { tratada: true, familia: family.id, resposta: resp };
    }
    return { tratada: true, familia: family.id };
  }

  // 3a. Resposta à oferta de fim de semana (Fase 5): se não for recusa,
  // monta o roteiro leve a partir do que ela contou e manda o link. Roda DEPOIS
  // do gate de assinatura (acima) — trial vencido nunca chega aqui, então o
  // roteiro/PDF não vaza de graça (caso Camile/Gramado).
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

  // 3b-acesso. "Não consigo entrar", "esqueci a senha", "o link não abre" →
  // a Ayla RESOLVE na hora: manda um link de acesso novo (token nosso, 7 dias,
  // não mata os outros). Vem cedo no fluxo porque, trancada fora, nada mais que
  // ela pedir vai funcionar — foi o que aconteceu com a mãe que passou dois dias
  // sem acesso enquanto brigava com a escola (22–26/07).
  if (pedeAcessoAoApp(inbound.texto)) {
    const ctxA = await loadFamiliaParaEnvio(supabase, family.id);
    const link = await criarLinkAcesso(supabase, {
      familyId: family.id,
      next: "/painel",
      criadoPor: "ayla",
    });
    if (ctxA && link) {
      const texto = [
        "Ah, isso eu resolvo agora 💛 Toca aqui que você entra direto, *sem senha*:",
        link,
        "",
        "Esse link vale por 24 horas (é por segurança). Se expirar, me manda “quero entrar” de novo que eu te mando outro na hora.",
        "E se quiser criar uma senha sua, é em *Configurações → Conta*.",
      ].join("\n");
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: null,
        phone: ctxA.whatsapp_e164,
        texto,
        category: "reativa",
        tipo: "resposta_registro",
      });
      return { tratada: true, familia: family.id, resposta: resp };
    }
  }

  // 3b-crianca. A Ayla pediu pra ela escolher UMA criança (nome + idade) e essa
  // é a resposta? Grava e segue a conversa — auto-incorporação, sem formulário.
  // Vem ANTES do classificador: "Lucas, 5 anos" não é rotina nem plano, e sem
  // criança definida nada mais faz sentido.
  {
    const pendente = await criancaPendente(supabase, family.id);
    if (pendente) {
      const msg = await resolverCriancaPendente(supabase, { pendente, texto: inbound.texto });
      if (msg) {
        const ctxC = await loadFamiliaParaEnvio(supabase, family.id);
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: pendente.membroId,
          phone: ctxC?.whatsapp_e164 ?? inbound.phoneE164,
          texto: msg,
          category: "reativa",
          tipo: "resposta_registro",
        });
        return { tratada: true, familia: family.id, resposta: resp };
      }
      // Não deu nome ainda: segue a conversa normal (a Ayla responde o que ela
      // trouxe; as vars de nome ficam vazias em vez de citar o recado).
    }
  }

  // INTENÇÃO por IA (entende o que a mãe quer, não só palavra-chave). Sinal
  // PRIMÁRIO do roteamento abaixo; os `pede*` de regex ficam como reforço (OR).
  // Só roda aqui (mensagem livre que precisa de rumo) — comandos/registro já
  // trataram antes. Se uma conversa de rotina está em curso, nem precisa (o
  // estado `rotinaConversa` conduz).
  const intent = rotinaConversa ? "outro" : await classificarIntencao({ texto: inbound.texto });

  // Criança que a conversa trata AGORA (2+ filhos) — pra rotina/plano seguirem
  // o filho certo e não caírem no membros[0] (bug Manu→Mario).
  const membroConversa = await criancaDaConversa(supabase, family.id);

  // 3c-rotina-ver. "Traga a rotina de hoje/terça" — só quando NÃO está montando
  // uma agora (senão o pedido é parte da conversa). Acha o dia, gera se faltar e
  // manda o link certo.
  if (!rotinaConversa && (intent === "rotina_ver" || pedeRotinaDeUmDia(inbound.texto))) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const membroId = (ctxR?.membros ? membroMencionado(inbound.texto, ctxR.membros) : null) ?? membroConversa ?? ctxR?.membros[0]?.id ?? null;
    if (ctxR && membroId) {
      const msg = await pedirRotinaDoDia(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        texto: inbound.texto,
        timezone: null,
      });
      if (msg) {
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: membroId,
          phone: ctxR.whatsapp_e164,
          texto: msg,
          category: "reativa",
          tipo: "resposta_registro",
        });
        return { tratada: true, familia: family.id, resposta: resp };
      }
    }
  }

  // 3c-rotina-editar. "faltou o lanche na terça", "tira o vôlei", "muda a rotina
  // de hoje" → ajusta a rotina existente (só quando NÃO está montando uma agora).
  if (!rotinaConversa && (intent === "rotina_editar" || pedeEditarRotina(inbound.texto))) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const membroId = (ctxR?.membros ? membroMencionado(inbound.texto, ctxR.membros) : null) ?? membroConversa ?? ctxR?.membros[0]?.id ?? null;
    if (ctxR && membroId) {
      const msg = await editarRotina(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        texto: inbound.texto,
        timezone: null,
        phoneE164: ctxR.whatsapp_e164,
      });
      if (msg) {
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: membroId,
          phone: ctxR.whatsapp_e164,
          texto: msg,
          category: "reativa",
          tipo: "resposta_registro",
        });
        return { tratada: true, familia: family.id, resposta: resp };
      }
    }
  }

  // 3c-rotina. Fluxo CONDUZIDO de ROTINA (antes do plano — pedido mais específico).
  // A Ayla conduz a conversa (escopo dia×semana → sequência → transições → tema)
  // e, quando tem o suficiente, monta + manda PDF + link. Enquanto não, faz a
  // próxima pergunta (tipo="rotina_conversa"). Estado inferido do histórico.
  if (rotinaConversa || intent === "rotina_criar" || pedeRotina(inbound.texto)) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const membroId = (ctxR?.membros ? membroMencionado(inbound.texto, ctxR.membros) : null) ?? rotinaConversa?.membroId ?? membroConversa ?? ctxR?.membros[0]?.id ?? null;
    if (ctxR && membroId) {
      const r = await conduzirRotina(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        contexto: inbound.texto,
        phoneE164: ctxR.whatsapp_e164,
      });
      if (r) {
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: membroId,
          phone: ctxR.whatsapp_e164,
          texto: r.mensagem,
          category: "reativa",
          tipo: r.pronto ? "resposta_registro" : "rotina_conversa",
        });
        return { tratada: true, familia: family.id, resposta: resp };
      }
    }
  }

  // 3c. Plano: NÃO usamos mais o fluxo guiado de 2 passos (perguntar "como está
  // hoje?" e só depois gerar). Ele deixava a mãe no SILÊNCIO (a única resposta era
  // o plano pesado; se demorava/travava, ela não recebia nada) e a pergunta era um
  // template que não soava como a Ayla. O pedido de plano agora segue pro fluxo
  // normal: a Ayla responde RICO na hora (com o Core) e a ponte (montarPonteWhatsApp,
  // mais abaixo) entrega o plano + PDF como follow-up — com o balão "já já te
  // respondo" cobrindo a espera. Restaura o comportamento bom de 20/07.
  // (Retirado 24/07 — regressão vista em teste real da Karina: pergunta genérica
  // + "não respondeu" no passo 2.)

  // 3b. "Sim" curto → confirma a última sugestão pendente da Ayla pro Kolo Vivo.
  // Se não houver nada pendente, segue pro parser (pode ser "sim" a outra coisa).
  if (ehAfirmacaoCurta(inbound.texto)) {
    const aplicada = await confirmarSugestaoPendente(supabase, family.id);
    if (aplicada) {
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: aplicada.membro_atipico_id,
        phone: inbound.phoneE164,
        texto: `Pronto, guardei no Perfil${aplicada.nomeMembro ? ` do ${aplicada.nomeMembro}` : ""}: "${aplicada.texto}". 🌿`,
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
  const ultimoMembroId = (ultimoCheckin?.[0]?.membro_atipico_id as string | null) ?? null;

  // Histórico da conversa PRO PARSER: respostas curtas ("letra f", "adora dançar")
  // só viram fato se ele entender o contexto. Sem isso o perfil não aprende numa
  // conversa de verdade (só no fluxo "pergunta do dia → 1 resposta").
  const historicoParser = await carregarHistorico(supabase, family.id, inbound.texto);

  const parsed = await parseInbound(
    {
      texto: inbound.texto,
      membros: ctx.membros,
      ultimoMembroFoco: ultimoNome ?? null,
      historico: historicoParser,
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

  // Nome citado EXPLICITAMENTE na mensagem — vence o palpite do parser (que às
  // vezes "gruda" no membro da conversa anterior). É o sinal mais confiável.
  const textoLower = inbound.texto.toLowerCase();
  const membroPorNome = ctx.membros.find(
    (m) => m.nome && textoLower.includes(m.nome.toLowerCase()),
  );
  // O nome escrito é autoridade: corrige o palpite do parser pra TUDO (registro
  // e contexto), evitando filar conteúdo no membro errado.
  if (membroPorNome) {
    parsed.membro_atipico_id = membroPorNome.id;
    parsed.confianca_identificacao = Math.max(parsed.confianca_identificacao, 90);
  }

  // Referência por GÊNERO (quando o nome NÃO foi escrito): "minha filha" /
  // "mi hija" / "my daughter" (ou filho/hijo/son) já diz o gênero. Se só há UM
  // membro desse gênero, sabemos de quem ela fala — não precisa perguntar
  // "qual filho?". Cobre PT/ES/EN. ("son" só com artigo/possessivo, pra não
  // colidir com o verbo espanhol "son" = "são".)
  const generoReferido = (texto: string): "masculino" | "feminino" | null => {
    const t = texto.toLowerCase();
    const fem = /\b(filha|hija|daughter)\b/.test(t);
    const masc =
      /\b(filho|hijo)\b/.test(t) || /\b(my|a|the|our|his|her)\s+son\b/.test(t);
    if (fem && !masc) return "feminino";
    if (masc && !fem) return "masculino";
    return null;
  };
  const genRef = membroPorNome ? null : generoReferido(inbound.texto);
  const membrosDoGenero = genRef
    ? ctx.membros.filter((m) => m.genero === genRef)
    : [];
  const membroPorGenero = membrosDoGenero.length === 1 ? membrosDoGenero[0] : null;
  if (membroPorGenero) {
    parsed.membro_atipico_id = membroPorGenero.id;
    parsed.confianca_identificacao = Math.max(parsed.confianca_identificacao, 85);
  }

  // Família 2+ membros + há conteúdo mas não sabemos de quem → a Ayla pergunta
  // QUEM. NÃO pergunta se o nome está escrito na mensagem nem se o gênero já
  // aponta um único membro (aí já sabemos).
  const precisaEscolherMembro =
    ctx.membros.length >= 2 &&
    !membroPorNome &&
    !membroPorGenero &&
    (parsed.confianca_identificacao < 70 || !parsed.membro_atipico_id) &&
    temAlgoPraRegistrar
      ? { nomes: ctx.membros.map((m) => m.nome) }
      : null;

  // Registrar nos bastidores (check-in + diário + sugestão) quando há conteúdo
  // e sabemos de quem é. ADIADO pra DEPOIS da resposta: essas gravações fazem
  // 2-4 chamadas de IA que NÃO entram no texto que a mãe lê — rodá-las antes só
  // atrasava a resposta. Marca aqui, executa no fim (invisível pra mãe).
  const deveRegistrar = Boolean(
    temAlgoPraRegistrar && parsed.membro_atipico_id && !precisaEscolherMembro,
  );

  // Foco pra CONTEXTO da conversa (perfil + Kolo Vivo). Numa PERGUNTA ("o que
  // sabe da X?") o parser volta null — por isso a prioridade aqui é: nome
  // escrito na mensagem > palpite do parser > último membro da conversa
  // (fixação) > único membro. NÃO registra nada — só carrega o perfil.
  const membroContextoId =
    membroPorNome?.id ??
    membroPorGenero?.id ??
    parsed.membro_atipico_id ??
    ultimoMembroId ??
    (ctx.membros.length === 1 ? ctx.membros[0].id : null);

  const membroFoco = membroContextoId
    ? (ctx.membros.find((m) => m.id === membroContextoId) ?? null)
    : null;
  const nomeMembro = membroFoco?.nome ?? null;
  const idadeFoco = idadeAnos(membroFoco?.data_nascimento ?? null);
  // Loaders independentes em paralelo (antes eram 3 idas ao banco em fila,
  // logo antes da chamada mais cara — a voz). O magic link do Lúdico (só
  // criança) vem junto, pra Ayla mandar se pedirem história/rotina/desenho.
  const ehCrianca = idadeFoco != null && idadeFoco <= 12;
  const [
    koloVivoResumo,
    koloVivoLacunas,
    estrategiasRecentes,
    historico,
    linkHistoria,
    linkRotina,
    linkDesenho,
    linkAvatar,
    linkRelatorio,
  ] = await Promise.all([
    carregarKoloVivoResumo(supabase, membroContextoId),
    carregarLacunasKoloVivo(supabase, membroContextoId),
    carregarEstrategiasRecentes(supabase, family.id),
    carregarHistorico(supabase, family.id, inbound.texto),
    ehCrianca ? gerarMagicLink(supabase, { familyId: family.id, next: "/historias/criar" }) : Promise.resolve(null),
    ehCrianca
      ? gerarMagicLink(supabase, { familyId: family.id, next: "/ludico/rotinas/semana" })
      : Promise.resolve(null),
    ehCrianca ? gerarMagicLink(supabase, { familyId: family.id, next: "/ludico/desenhos" }) : Promise.resolve(null),
    ehCrianca
      ? gerarMagicLink(supabase, { familyId: family.id, next: "/configuracoes/avatar" })
      : Promise.resolve(null),
    ehCrianca ? gerarMagicLink(supabase, { familyId: family.id, next: "/evolucao/relatorio" }) : Promise.resolve(null),
  ]);
  const linksLudico = ehCrianca
    ? { historia: linkHistoria, rotina: linkRotina, desenho: linkDesenho, avatar: linkAvatar, relatorio: linkRelatorio }
    : null;

  const resp = await enviarRespostaEmChunks(supabase, {
    family_account_id: family.id,
    membro_atipico_id: membroContextoId,
    phone: ctx.whatsapp_e164,
    tipo: precisaEscolherMembro ? "clarificacao_identificacao" : "resposta_registro",
    params: {
      nomeMae: ctx.nomeMae,
      cuidador: ctx.cuidador,
      nomeMembro,
      idadeMembro: idadeFoco,
      perfilMembro: membroFoco?.perfil ?? null,
      generoMembro: membroFoco?.genero ?? null,
      koloVivoResumo,
      koloVivoLacunas,
      estrategiasRecentes,
      historico,
      linksLudico,
      mensagem: inbound.texto,
      imagemUrl: inbound.midiaTipo === "image" ? (inbound.midiaUrl ?? null) : null,
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

  // Agora que a mãe JÁ recebeu a resposta, grava o registro nos bastidores
  // (check-in/diário/Kolo Vivo — as chamadas de IA que tiramos da frente).
  // Best-effort: nunca quebra o retorno.
  if (deveRegistrar) {
    try {
      await persistirRegistro(supabase, family.id, parsed);
    } catch (e) {
      console.warn(
        "[ayla] persistirRegistro (adiado) falhou:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Linha do tempo (Livro Vivo): registra eventos importantes mencionados
  // (troca de professora, mudança, medicação, terapia…). Best-effort, só com
  // gatilho — a resposta já foi enviada acima.
  await extrairESalvarEventos(supabase, family.id, membroContextoId, inbound.texto, historicoParser);

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

  // A pessoa pediu um plano? Então a Ayla NÃO escreve o plano no chat — dá uma
  // resposta curta e o sistema entrega o plano (PDF + link). Vale tanto pro pedido
  // EXPLÍCITO quanto pro "sim" curto logo depois de a Ayla OFERECER um plano (1c).
  const querPlano =
    pedeUmPlano(args.params.mensagem) ||
    (ehAfirmacaoCurta(args.params.mensagem) &&
      (await ofertouPlanoRecente(supabase, args.family_account_id)));
  args.params.querPlano = querPlano;

  // Resposta LENTA (pedido de plano): manda um balão breve de acolhimento na
  // hora — o Z-API não deixa mostrar "digitando" sozinho, então o balãozinho
  // (com delayTyping) enche o silêncio e mostra que a Ayla está com ela
  // enquanto o plano é montado. Só no caso lento, pra não poluir trocas rápidas.
  if (querPlano) {
    const fillers = [
      "Deixa eu pensar nisso com você 🌿 já já te respondo.",
      "Tô aqui — me dá um segundinho pra montar isso direito 🌿",
      "Boa. Deixa eu olhar isso com carinho, já te mando.",
    ];
    try {
      await enviarTexto({
        phoneE164: args.phone,
        texto: fillers[args.params.mensagem.length % fillers.length],
        delaySegundos: 2,
      });
    } catch {
      /* filler nunca quebra a resposta */
    }
  }

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
  console.log(
    `[ayla:ponte] avaliando — tipo=${args.tipo} enviada=${enviada} querPlano=${querPlano} temDesafio=${Boolean(args.params.sinais.desafio)}`,
  );
  if (enviada && args.tipo === "resposta_registro") {
    const nudge = await montarPonteWhatsApp(supabase, {
      familyId: args.family_account_id,
      membroAtipicoId: args.membro_atipico_id,
      mensagem: args.params.mensagem,
      temDesafio: Boolean(args.params.sinais.desafio),
      phoneE164: args.phone,
      // Pedido explícito de plano: fura o dedup/intenção e entrega na hora.
      forcar: querPlano,
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

  // 2. Diário (Camada A + B se confianca_camada_adulto >= 70). Com DEDUP:
  //    numa mesma conversa a mãe detalha o MESMO episódio em várias mensagens —
  //    em vez de duplicar, consolidamos no registro de hoje (Haiku decide se é
  //    o mesmo evento e devolve a versão mais rica). Mesmo padrão do Kolo Vivo.
  if (conquista || p.desafio || p.observacao_livre) {
    const temCamadaB = p.confianca_camada_adulto >= 70;
    const quemEstava = temCamadaB ? p.quem_estava : null;
    const estadoAdulto = temCamadaB ? p.estado_adulto : null;
    const reacaoAdulto = temCamadaB ? p.reacao_adulto : null;

    const { data: hojeRows } = await supabase
      .from("diarios")
      .select(
        "id, conquista, desafio, observacao_livre, possivel_gatilho, quem_estava, estado_adulto, reacao_adulto",
      )
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", p.membro_atipico_id)
      .eq("data", hojeLocalISO())
      .eq("origem", "ayla")
      .order("created_at", { ascending: true })
      .limit(8);
    const existentes = hojeRows ?? [];

    // Etiqueta por área (o texto já vem limpo do parser → não repolir).
    const areaWa = await classificarAreasDiario(
      { conquista, desafio: p.desafio, polir: false },
      { supabase, family_account_id: familyId },
    );

    let mergedId: string | null = null;
    if (existentes.length > 0) {
      const decisao = await decidirDedupDiario(
        {
          novo: {
            conquista,
            desafio: p.desafio,
            observacao: p.observacao_livre,
            gatilho: p.possivel_gatilho,
          },
          existentes: existentes.map((r) => ({
            conquista: (r.conquista as string | null) ?? null,
            desafio: (r.desafio as string | null) ?? null,
            observacao: (r.observacao_livre as string | null) ?? null,
            gatilho: (r.possivel_gatilho as string | null) ?? null,
          })),
        },
        { supabase, family_account_id: familyId, feature: "ayla_dedup_diario" },
      );

      if (decisao.acao === "merge") {
        const alvo = existentes[decisao.alvo];
        // Camada B: mantém a que já existia; se não tinha e a nova trouxe, preenche.
        const qe = (alvo.quem_estava as string | null) ?? quemEstava;
        const ea = (alvo.estado_adulto as string | null) ?? estadoAdulto;
        const ra = (alvo.reacao_adulto as string | null) ?? reacaoAdulto;
        await supabase
          .from("diarios")
          .update({
            conquista: decisao.conquista,
            desafio: decisao.desafio,
            observacao_livre: decisao.observacao,
            possivel_gatilho: decisao.gatilho,
            conquista_area: areaWa.conquistaArea,
            desafio_area: areaWa.desafioArea,
            quem_estava: qe,
            estado_adulto: ea,
            reacao_adulto: ra,
            incompleto:
              Boolean(qe || ea || ra) === false &&
              Boolean(decisao.conquista || decisao.desafio),
          })
          .eq("id", alvo.id as string);
        mergedId = alvo.id as string;
      }
    }

    if (!mergedId) {
      await supabase.from("diarios").insert({
        family_account_id: familyId,
        membro_atipico_id: p.membro_atipico_id,
        data: hojeLocalISO(),
        conquista,
        desafio: p.desafio,
        observacao_livre: p.observacao_livre,
        possivel_gatilho: p.possivel_gatilho,
        conquista_area: areaWa.conquistaArea,
        desafio_area: areaWa.desafioArea,
        quem_estava: quemEstava,
        estado_adulto: estadoAdulto,
        reacao_adulto: reacaoAdulto,
        origem: "ayla",
        incompleto:
          Boolean(quemEstava || estadoAdulto || reacaoAdulto) === false &&
          Boolean(conquista || p.desafio),
      });
    }
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

  // 3. Sugestão de Kolo Vivo — AUTO-INCORPORAÇÃO ORGANIZADA.
  //    Decidido em 2026-05-26: info nova entra automática sem aprovação humana.
  //    Domínio COM sub-campos (Sensorial, Emocional…): o fato é ROTEADO pro
  //    sub-campo certo (Sons, Gatilhos…) e integrado ali — nada de empilhar
  //    frase solta em "Outras observações". Domínio de texto livre: dedup
  //    semântico consolida. A linha em sugestao_perfil_vivos vira log de
  //    auditoria (aprovada se aplicou, rejeitada se skip, pendente se campo
  //    desconhecido).
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
      const subcampos = subcamposDe(campo);

      let aplicou = false;
      let operacaoLog: "adicionar" | "reescrever" | "skip" = "skip";
      let textoAplicado: string | null = null;
      let textoParaConflito = "";

      if (subcampos) {
        // Domínio com sub-campos: roteia o fato pro campo certo (Sons,
        // Gatilhos, O que ajuda…) e integra ali — em vez de empilhar frase
        // solta em "Outras observações". É o que mantém o perfil organizado.
        const valoresAtuais = parsearSubcampos(subcampos, textoAtual);
        const r = await rotearFatoSubcampo(
          { subcampos, valoresAtuais, fato: p.texto_kolo_vivo_sugerido },
          { supabase, family_account_id: familyId, feature: "ayla_rotear_kv" },
        );
        if (!r.skip && r.campoSub && r.valor.trim()) {
          const novoTexto = serializarSubcampos(subcampos, {
            ...valoresAtuais,
            [r.campoSub]: r.valor.trim(),
          });
          aplicou = await aplicarSugestaoNoMembro(
            supabase,
            familyId,
            p.membro_atipico_id,
            campo,
            novoTexto,
            "reescrever",
          );
          operacaoLog = "reescrever";
          textoAplicado = novoTexto;
          textoParaConflito = r.valor.trim();
        }
      } else {
        // Domínio de texto livre: dedup semântico consolida velho + novo.
        const decisao = await decidirDedup(
          { campo, textoSugerido: p.texto_kolo_vivo_sugerido, textoAtual },
          { supabase, family_account_id: familyId, feature: "ayla_dedup" },
        );
        if (decisao.operacao !== "skip" && decisao.texto.trim()) {
          aplicou = await aplicarSugestaoNoMembro(
            supabase,
            familyId,
            p.membro_atipico_id,
            campo,
            decisao.texto,
            decisao.operacao,
          );
          textoAplicado = decisao.texto;
          textoParaConflito = decisao.texto;
        }
        operacaoLog = decisao.operacao;
      }

      // Conflito cross-campo: o fato novo contradiz ALGUMA outra área? Só
      // sinaliza (não reescreve) pra mãe revisar. Roda quando algo foi aplicado.
      if (aplicou) {
        await sinalizarConflitoCrossCampo(
          supabase,
          familyId,
          p.membro_atipico_id,
          campo,
          textoParaConflito,
          rowAtual,
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
          operacao: operacaoLog,
          texto_aplicado: textoAplicado,
        },
        status:
          operacaoLog === "skip" ? "rejeitada" : aplicou ? "aprovada" : "pendente",
        decidido_em: operacaoLog === "skip" || aplicou ? agora : null,
      });
    }
  }
}

/**
 * Detecta contradição entre o campo recém-atualizado e as OUTRAS áreas do
 * Kolo Vivo. Se houver, registra um aviso em `categorias_extras.conflitos`
 * pra mãe revisar (dedup por par de campos) — NÃO reescreve nada. Falha
 * silenciosa: conflito é um bônus, nunca pode quebrar a incorporação.
 */
async function sinalizarConflitoCrossCampo(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  campo: string,
  textoNovo: string,
  rowAtual: Record<string, unknown> | null | undefined,
): Promise<void> {
  try {
    const outros = MEMBRO_CAMPOS_TODOS.filter((c) => c !== campo).map((c) => ({
      campo: c,
      label: MEMBRO_CAMPO_LABEL[c] ?? c,
      texto: lerTextoAtualDaSecao(rowAtual, c),
    }));

    const conflito = await detectarConflitoCrossCampo(
      {
        campoNovo: campo,
        labelNovo: MEMBRO_CAMPO_LABEL[campo] ?? campo,
        textoNovo,
        outros,
      },
      { supabase, family_account_id: familyId, feature: "ayla_conflito_kv" },
    );
    if (!conflito) return;

    const chave = [campo, conflito.campo].sort().join("|");

    // Re-lê categorias_extras (a aplicação acabou de mexer nela) e anexa o
    // aviso, deduplicando por par de campos pra não repetir o mesmo conflito.
    const { data: row } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const extras = { ...((row?.categorias_extras as Record<string, unknown>) ?? {}) };
    const conflitos = Array.isArray(extras.conflitos) ? [...extras.conflitos] : [];
    const jaAberto = conflitos.some(
      (c) =>
        c &&
        typeof c === "object" &&
        (c as { chave?: string }).chave === chave &&
        (c as { status?: string }).status === "aberto",
    );
    if (jaAberto) return;

    conflitos.push({
      chave,
      campos: [campo, conflito.campo],
      descricao: conflito.descricao,
      data: hojeLocalISO(),
      status: "aberto",
    });
    extras.conflitos = conflitos.slice(-20);

    await supabase
      .from("perfil_vivo_membro")
      .update({ categorias_extras: extras })
      .eq("membro_atipico_id", membroId)
      .eq("family_account_id", familyId);
  } catch (e) {
    console.warn("[conflito-kv] falha ao sinalizar:", e instanceof Error ? e.message : e);
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
  // Jeitos igualmente comuns de dizer sim que ficavam de fora — e um "sim" que
  // não é reconhecido faz a mãe pedir e não receber nada.
  "pode ser", "pode montar", "pode mandar", "manda sim", "manda ai", "me manda",
  "quero muito", "gostaria", "por favor", "sim por favor", "sim quero",
  "vamos", "bora", "bora la", "aceito", "otimo", "legal", "show", "top",
  "seria otimo", "adoraria", "com certeza", "certeza", "faz", "faz sim",
  "monta", "monta sim", "quero ver", "vamos la", "uhum", "aham",
]);

/** A Ayla ofereceu um plano na última mensagem? Pra um "sim" curto logo depois
 *  virar pedido de plano (auto-oferta, 1c). Marca por texto na última outbound. */
/** Frases que caracterizam uma OFERTA de plano feita pela Ayla. Inclui a
 *  nomenclatura nova ("plano estratégico com atividades"), que existe pra a mãe
 *  não confundir o material com plano de ASSINATURA. */
const REGEX_OFERTA_PLANO =
  /monte(i)? um plano|montar (um |esse |o )?plano|junte.*plano|plano (completo|estrat[ée]gico)|um plano (completo|estrat[ée]gico|com|pra|sobre)/;

async function ofertouPlanoRecente(supabase: SupabaseClient, familyId: string): Promise<boolean> {
  const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // Olha as ÚLTIMAS mensagens, não só a última. A Ayla responde em vários
  // balões e costuma continuar falando depois de oferecer; com limit(1) o "sim"
  // da mãe já chegava tarde demais e a oferta evaporava. Também cobre o caso
  // real: ela pergunta o preço, a Ayla esclarece, e só então ela aceita.
  const { data } = await supabase
    .from("ayla_messages")
    .select("texto")
    .eq("family_account_id", familyId)
    .eq("direcao", "outbound")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data ?? []).some((m) =>
    REGEX_OFERTA_PLANO.test(((m.texto as string | null) ?? "").toLowerCase()),
  );
}

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
    nomeMae: profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "",
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
  // Idioma da família: todo texto proativo/template é gerado em PT; se a
  // família é es/en, traduz AQUI (choke point único) antes de enviar. PT não
  // passa pela tradução — zero custo/latência. A conversa reativa não usa esta
  // função (já sai no idioma de quem escreve).
  // Nome ausente deixa cicatriz ("Oi, 🌿", "Tô com você, ."). Vários textos
  // proativos são montados à mão aqui no orchestrator, fora do fill() dos
  // templates — então a limpeza mora também neste choke point.
  let texto = limparNomeAusente(params.texto);
  const idioma = await idiomaDaFamilia(supabase, params.family_account_id);
  if (idioma !== "pt") texto = limparNomeAusente(await traduzirProativa(texto, idioma));

  let resultado: EnvioResultado;
  let providerResp: unknown = null;
  let erro: string | null = null;

  try {
    const r = await enviarTexto({ phoneE164: params.phone, texto });
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
      texto,
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
      texto,
      enviada_em: new Date().toISOString(),
    });

    await supabase
      .from("ayla_preferences")
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq("family_account_id", params.family_account_id);
  }

  return resultado;
}

/** Idioma da família (pt/es/en) por id — pra traduzir as proativas no envio. */
async function idiomaDaFamilia(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<"pt" | "es" | "en"> {
  try {
    const { data } = await supabase
      .from("family_accounts")
      .select("idioma")
      .eq("id", familyAccountId)
      .maybeSingle();
    const v = data?.idioma as string | undefined;
    return v === "es" || v === "en" ? v : "pt";
  } catch {
    return "pt";
  }
}

/**
 * Idioma da família (pt/es/en) pelo telefone do WhatsApp — usado no webhook
 * pra dar a dica de idioma certa ao Whisper ANTES de transcrever o áudio.
 * Casa pela chave normalizada (mesmo critério de processInbound).
 */
export async function idiomaPorTelefone(
  supabase: SupabaseClient,
  phoneE164: string,
): Promise<"pt" | "es" | "en"> {
  try {
    const chave = chaveTelefoneBR(phoneE164);
    const { data } = await supabase
      .from("family_accounts")
      .select("whatsapp_e164, idioma")
      .not("whatsapp_e164", "is", null);
    const f = (data ?? []).find(
      (r) => chaveTelefoneBR(r.whatsapp_e164 as string) === chave,
    );
    const v = f?.idioma as string | undefined;
    return v === "es" || v === "en" ? v : "pt";
  } catch {
    return "pt";
  }
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
