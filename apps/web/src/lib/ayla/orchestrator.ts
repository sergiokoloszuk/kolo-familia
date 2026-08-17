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
import { blocoDiagnosticoRegistrado } from "@/lib/onboarding/diagnostico";
import { reservarEnvioProativo, proativaIsentaDeCadencia } from "./cadencia";
import { logEvent, logServerError } from "@/lib/log";
import { descricaoCuidador, type CuidadorDescrito, type Genero } from "./pronomes";
import { gerarSugestaoRepertorio } from "./repertorio";
import { decidirDedup } from "./dedup-kolo-vivo";
import { decidirDedupDiario } from "./dedup-diario";
import {
  limparNomeAusente,
  templateBoasVindas,
  templateClarificacaoMembro,
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
import { fechamentoReativoRecente } from "@/lib/trial/jornada";
import { aguardarTurnoDaMae, descartarTurnoPendente } from "./lote-inbound";
import { pedeUmPlano } from "@/lib/ia/pedido-plano";
import { abreFluxoDeArtefato, atoSobreArtefato } from "@/lib/conducao/ato-artefato";
import {
  rotinaConversaPendente,
  pediuRotinaExplicitamente,
  conduzirRotina,
  pedeRotina,
  pedeRotinaDeUmDia,
  pedirRotinaDoDia,
  pedeEditarRotina,
  entregarArtefatoImprimivel,
  lerFeedbackDaRotina,
  editarRotina,
} from "./rotina-guiada";
import { classificarIntencao } from "./intent";
import { carregarCatalogoSkills } from "./catalogo-skills";
import { recuperarBoasPraticas, blocoBoasPraticas } from "@/lib/conhecimento/recuperar";
// FASE 4A NO WHATSAPP (10/08/2026) — os MESMOS módulos que a web usa, chamados
// daqui. Nenhum deles é web-only: `carregarPerfilConsultavel`, `secoesDe` e as
// duas constantes de composição vivem em módulos neutros, exatamente como
// `recuperarBoasPraticas` acima, que o WhatsApp já compartilha desde 06/08.
// O que NÃO se reusa é `lib/ia/context.ts` — aquele é o montador da web, com
// dependências (linhas de `skills`, `mensagens_skill`, diários, check-in) que
// este canal não tem. Montador é de cada canal; inteligência é compartilhada.
import { pilotoQuatroA } from "@/lib/conducao/piloto";
import { carregarPerfilConsultavel } from "@/lib/kolo-vivo/consultar";
import { secoesDe, temMaterial } from "@/lib/conducao/base2";
import { montarRastro, registrarRastroConhecimento } from "@/lib/conhecimento/rastro";
import { dividirEmBolhas, ritmoDasBolhas, TETO_ESPERA_SEGUNDOS } from "./bolhas";
import { paraWhatsApp } from "./apresentacao";
import { semOutrosMembros } from "./membro-escopo";
import { ehFamiliaExperimental, responderExperimental } from "./experimental";
import { atenderDesconhecido } from "./desconhecido";
import { classificarFeedbackRotina } from "./rotina-feedback";
import { pedeArtefatoImprimivel, apontaProRecente } from "./rotina-pdf-rota";
import { resolverMembroAlvo } from "./membro-alvo";
import {
  segurancaAberta,
  mensagemPedeSeguranca,
  textoSegurancaSemAcesso,
  notaDeSeguranca,
  respostaOrientouEmergencia,
  riscoEhAtual,
  segurancaFoiEncaminhada,
} from "./estado-seguranca";
import { primeiroNomeConfiavel, primeiroNomeCriancaConfiavel } from "./crianca-nome";
import { TEMAS } from "@/lib/conducao/temas";
import {
  deveMostrarMenu,
  escolhaDoMenu,
  montarTextoDoMenu,
  TIPO_ENTRADA_GUIADA,
} from "./entrada-guiada-estado";
import { criarLinkAcesso, pedeAcessoAoApp } from "@/lib/auth/acesso-link";
import {
  criancaPendente,
  resolverCriancaPendente,
  templateConviteCriancaEspecifica,
} from "./crianca-especifica";
import { extrairESalvarEventos } from "./eventos";
import { acessoLiberado } from "@/lib/auth/acesso";
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
  /**
   * `enviada: true` = a Z-API ACEITOU (HTTP 200). Não é entrega, não é
   * recebimento e não é leitura — ver `whatsappSender.enviarTexto`. E
   * `messageId` pode ser null: 200 sem id acontece, e inventar um id ("unknown")
   * é pior que assumir que não veio.
   */
  | { enviada: true; messageId: string | null }
  | { enviada: false; motivo: string };

// ============================================================
// PROATIVA: Boas-vindas — primeira mensagem após onboarding
// ============================================================

/** O guia da plataforma. Mesmo vídeo do app — uma URL só no produto. */
const LINK_GUIA_KOLO = "https://www.tella.tv/video/como-usar-a-kolo-familia-guia-completo-gy18";

/**
 * A família CLICOU pra ver o guia no app? Só o clique conta, e vale nas DUAS
 * portas: o card do fim do cadastro e o da Home. Considerar só a Home deixaria
 * de fora justamente quem viu no onboarding e nunca voltou lá.
 *
 * `onboarding_video_exibido` NÃO entra: ele só prova que a tela carregou.
 *
 * Em falha, assume que SIM — mandar o link de novo pra quem já viu incomoda
 * mais do que deixar de mandar pra quem não viu.
 */
async function abriuGuiaNoApp(supabase: SupabaseClient, familyId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_events")
      .select("id")
      .eq("family_account_id", familyId)
      .in("evento", ["home_video_aberto", "onboarding_video_aberto"])
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return true;
  }
}

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
  // A lista INTEIRA. Antes era so o [0]: a familia marcava tres coisas e a Ayla
  // se apresentava falando de uma - parecia que nao tinha lido o cadastro.
  const desafios = await carregarDesafiosOnboarding(supabase, membroFoco.id);

  /**
   * O GUIA EM VÍDEO — segunda chance de onboarding, UMA vez.
   *
   * Quem já abriu o vídeo no app não precisa receber o link de novo. Quem não
   * abriu recebe aqui — e só aqui: a boas-vindas é enviada uma única vez por
   * família (a idempotência acima garante), então "oferecer uma vez" sai de
   * graça, sem coluna nova e sem estado novo.
   *
   * ⚠️ O QUE CADA EVENTO PROVA. `onboarding_video_exibido` só diz que o
   * player esteve na tela — não que ela assistiu. `home_video_aberto` diz que
   * ela CLICOU pra ver. Só o segundo conta como "já teve o vídeo nas mãos";
   * tratar o primeiro como "assistiu" seria inventar um dado que não temos.
   */
  const jaAbriuVideo = await abriuGuiaNoApp(supabase, familyAccountId);

  const texto = desafios.length
    ? templateBoasVindasComDesafio({
        nomeMae: ctx.nomeMae,
        nomeMembro: membroFoco.nome,
        genero: membroFoco.genero,
        desafios,
        linkGuia: jaAbriuVideo ? null : LINK_GUIA_KOLO,
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
  const refMembro = citarCrianca(membro, "para");
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

/**
 * PROATIVA: a sequência ajudou? — UMA vez, e só uma.
 *
 * Irmã de `sendPlanoSeguimento`, e de propósito: a rotina virou artefato tanto
 * quanto o plano (vira linhas, cartões e um PDF que a família cola na parede)
 * e não tinha nenhuma volta. A família montava a sequência e nunca mais se
 * falava nela — nem quando parava de ser necessária.
 *
 * A garantia de "no máximo uma retomada" é `seguimento_enviado_em` (0075),
 * marcado no envio. Quem já contou espontaneamente que funcionou tem
 * `resultado` preenchido e sai da fila antes de chegar aqui — é assim que a
 * mãe não recebe "você chegou a testar?" no dia seguinte a ter dito que deu
 * certo.
 */
export async function sendRotinaSeguimento(
  supabase: SupabaseClient,
  familyAccountId: string,
  rotina: { id: string; nome: string | null; membro_atipico_id: string | null },
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "rotina_seguimento",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };

  const link = await gerarMagicLink(supabase, {
    familyId: familyAccountId,
    next: `/ludico/rotinas/${rotina.id}`,
  });
  // Sem link não se manda: a pergunta pede que ela olhe a sequência, e mandar
  // sem o caminho pra ela vira cobrança.
  if (!link) return { enviada: false, motivo: "Não consegui gerar o link da rotina." };

  const membro = rotina.membro_atipico_id
    ? ctx.membros.find((m) => m.id === rotina.membro_atipico_id)
    : null;
  const nome = (rotina.nome ?? "").trim();
  const refRotina = nome ? ` de ${nome.toLowerCase()}` : "";
  const refMembro = citarCrianca(membro, "de");
  // Pergunta o que MUDOU, não se gostou: é isso que muda a próxima orientação.
  const texto = `Oi, ${ctx.nomeMae}! Vocês chegaram a usar aquela sequência${refRotina}${refMembro}? Queria saber se ela facilitou alguma parte — ou se tem algum trecho que a gente precisa ajustar. É só tocar aqui:
${link}`;

  const r = await enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: rotina.membro_atipico_id,
    phone: ctx.whatsapp_e164,
    texto,
    category: "proativa",
    tipo: "rotina_seguimento",
    meta: { rotina_id: rotina.id },
  });

  if (r.enviada) {
    await supabase
      .from("rotinas")
      .update({ seguimento_enviado_em: agora.toISOString() })
      .eq("id", rotina.id);
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
  const refMembro = citarCrianca(membro, "para");
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
  const refMembro = citarCrianca(membro, "de");
  const link = await gerarMagicLink(supabase, {
    familyId: familyAccountId,
    next: `/ludico/rotinas/${rotina.id}`,
  });
  const linhaLink = link ? `\n\n(Pra abrir os cartões: ${link})` : "";
  // "Gostou?" não devolve nada aproveitável. O que a gente precisa saber é ONDE
  // funcionou e ONDE ainda travou — é isso que preserva o que deu certo e muda
  // só o ponto necessário, e é isso que o campo `transicoes[].funcionou` espera.
  const texto = `Oi, ${ctx.nomeMae} 🌿 Conseguiram usar a rotina${refRotina}${refMembro}? Me conta duas coisas: onde funcionou, e onde ainda travou. O que estiver bom eu mantenho, e a gente mexe só no ponto que precisa. 💛${linhaLink}`;

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

  // ⚠️ CONVIVÊNCIA COM A JORNADA REATIVA (15/08/2026). O pior resultado desta
  // frente seria a família conversar sobre continuar no D6 e receber, logo
  // depois, uma automática perguntando quase a mesma coisa. Se a conversa já
  // cumpriu a função comercial nas últimas horas, a proativa cala — a família
  // que NÃO conversa continua recebendo, que é a razão de a proativa existir.
  if (await fechamentoReativoRecente(supabase, familyAccountId, agora)) {
    console.log(`[ayla:trial] ${tipo} calado — a conversa já fez o fechamento hoje`);
    return { enviada: false, motivo: "fechamento reativo recente" };
  }

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
// CAMPANHA ÚNICA: o vídeo institucional
// ============================================================

/**
 * ESTA FAMÍLIA JÁ RECEBEU O LINK DO GUIA PELO WHATSAPP?
 *
 * A prova sai do PRÓPRIO TEXTO já enviado. O link institucional é literal e
 * único no produto, então procurá-lo em `ayla_messages` responde a pergunta
 * sem coluna nova, sem tabela nova e sem migração — e cobre também quem
 * recebeu pela boas-vindas, que manda o mesmo link por outro caminho.
 *
 * Em falha da consulta devolve `true` (não envia). Repetir para quem já viu
 * incomoda mais do que deixar de mandar para quem não viu.
 */
async function jaRecebeuVideoGuia(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyAccountId)
      .eq("direcao", "outbound")
      .ilike("texto", "%tella.tv/video/como-usar-a-kolo%")
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return true;
  }
}

/**
 * COMO CITAR A CRIANÇA NUMA PROATIVA — nome e concordância, com as duas
 * dúvidas resolvidas no mesmo lugar.
 *
 * ⚠️ POR QUE EXISTE (17/08/2026, caso Paula). As proativas escritas à mão aqui
 * no orquestrador montavam a citação sozinhas, e erravam de dois jeitos:
 *
 *   1. NOME CRU. O campo do nome aceita recado, e `"Meu Filhos"` saiu numa
 *      mensagem como se fosse o nome da criança — noventa segundos antes de
 *      outra mensagem dizer que o nome não tinha vindo no cadastro.
 *   2. GÊNERO ADIVINHADO PELO NOME. Uma delas fazia
 *      `d${nome.endsWith("a") ? "a" : "o"}` — ou seja, decidia o gênero da
 *      criança pela última letra. Todo Nicolas virava menina; todo nome que
 *      não termina em "a" virava menino.
 *
 * A regra: nome só quando É nome (`primeiroNomeCriancaConfiavel`),
 * concordância só quando o gênero está REGISTRADO, e neutro em qualquer
 * dúvida. Nunca bloqueia a mensagem — sem nome utilizável a citação some e a
 * frase segue de pé.
 */
function citarCrianca(
  membro: { nome?: string | null; genero?: string | null } | undefined | null,
  preposicao: "de" | "para",
): string {
  const nome = primeiroNomeCriancaConfiavel(membro?.nome);
  if (!nome) return "";
  if (preposicao === "para") return ` pra ${nome}`;
  // "de" com concordância: "da Manu" / "do Pedro" quando o gênero é dado
  // REGISTRADO; "de Manu" quando não é — correto em português e sem palpite.
  const g = (membro?.genero ?? "").trim().toLowerCase();
  if (g === "feminino") return ` da ${nome}`;
  if (g === "masculino") return ` do ${nome}`;
  return ` de ${nome}`;
}

/**
 * O texto da campanha. É ATIVAÇÃO, não lembrete de trial: nada de preço, nada
 * de "seu teste acaba em X dias", e sem pergunta no fim — se ela responder, a
 * Ayla conversa; se não responder, o vídeo trabalha sozinho.
 *
 * ⚠️ GÊNERO: a frase sobre a evolução é NEUTRA de propósito ("acompanhar a
 * evolução", nunca "a evolução dele"). O nome da criança só entra quando
 * existe, e sem pronome — assim a mensagem não erra o gênero de ninguém,
 * inclusive nas famílias onde o campo não está preenchido.
 */
export function textoVideoGuia(params: {
  nomeMae: string | null;
  nomeMembro: string | null;
}): string {
  const ola = params.nomeMae?.trim() ? `Oi, ${params.nomeMae.trim()} 💛` : "Oi 💛";
  // ⚠️ NOME SÓ QUANDO É NOME (17/08/2026). Aqui saía o campo cru: a família da
  // Paula recebeu "montar histórias do Meu Filhos" e, 90 segundos depois, a
  // mensagem que pede o nome verdadeiro. Sem nome utilizável a frase segue
  // inteira, só sem a citação — a campanha nunca deixa de sair por isso.
  //
  // `nomeMae` NÃO precisa do mesmo tratamento: `loadFamiliaParaEnvio` já o
  // passa por `primeiroNomeConfiavel`. Filtrar de novo seria a segunda fonte.
  const nomeCrianca = primeiroNomeCriancaConfiavel(params.nomeMembro);
  const daCrianca = nomeCrianca ? ` de ${nomeCrianca}` : "";
  const aCrianca = nomeCrianca ? ` sobre ${nomeCrianca}` : "";
  return `${ola}

Quero te mostrar uma coisa rápida que pode ajudar nesses dias de teste.

Gravamos um vídeo curto mostrando a Kolo por dentro: como conversar comigo, criar planos e rotinas visuais, montar histórias${daCrianca}, registrar o que acontece no dia e acompanhar a evolução.

🎥 ${LINK_GUIA_KOLO}

E o mais importante: você não precisa saber qual ferramenta usar. Me conta uma situação que está acontecendo${aCrianca} — por texto ou por áudio, do jeito que for mais fácil — que eu te ajudo a achar um caminho.`;
}

/**
 * Envia a campanha do vídeo institucional para UMA família.
 *
 * Ordem das guardas, e cada uma existe por um motivo:
 *   1. `podeEnviarProativa` — consentimento, desativada, pausada, limite
 *      diário, estado de segurança aberto e cadência. É o funil único.
 *   2. `abriuGuiaNoApp` — quem já CLICOU no vídeo (onboarding ou Home) não
 *      precisa do link. `onboarding_video_exibido` NÃO conta: a página ter
 *      carregado não diz que a pessoa assistiu.
 *   3. `jaRecebeuVideoGuia` — a dedup que faz o cron poder rodar 4× por dia
 *      sem mandar 4 mensagens.
 *
 * A 3 é verificada IMEDIATAMENTE antes do envio, e não só na seleção: entre
 * montar a lista e despachar existe uma janela em que a boas-vindas de uma
 * família nova pode ter mandado o mesmo link.
 */
export async function sendVideoGuia(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<EnvioResultado> {
  const podeRes = await podeEnviarProativa(
    supabase,
    { family_account_id: familyAccountId, agora },
    "video_guia",
  );
  if (!podeRes.permitido) return { enviada: false, motivo: podeRes.motivo };

  if (await abriuGuiaNoApp(supabase, familyAccountId)) {
    return { enviada: false, motivo: "já abriu o vídeo no app" };
  }
  if (await jaRecebeuVideoGuia(supabase, familyAccountId)) {
    return { enviada: false, motivo: "já recebeu o link por WhatsApp" };
  }

  const ctx = await loadFamiliaParaEnvio(supabase, familyAccountId);
  if (!ctx) return { enviada: false, motivo: "Sem contexto da família." };
  if (!ctx.whatsapp_e164) return { enviada: false, motivo: "sem WhatsApp" };

  return enviarEPersistir(supabase, {
    family_account_id: familyAccountId,
    membro_atipico_id: null,
    phone: ctx.whatsapp_e164,
    texto: textoVideoGuia({
      nomeMae: ctx.nomeMae,
      nomeMembro: ctx.membros?.[0]?.nome ?? null,
    }),
    category: "proativa",
    tipo: "video_guia",
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
  // A regra saiu daqui em 10/08/2026 para `lib/auth/acesso.ts`. Ela estava
  // escrita corretamente NESTE portão e em mais dois — e faltando em outros
  // dois, que foi como uma operadora com trial vencido virou atendida-e-nunca-
  // procurada. Cinco cópias, duas envelhecidas. O comportamento aqui não muda.
  return acessoLiberado(supabase, familyId);
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
/**
 * Nasceu uma rotina agora nesta conversa?
 *
 * O sinal de que o "PDF" seco tem referente óbvio. É FATO no banco, não
 * formato de mensagem — foi o formato que quebrou quando a Fase 1 passou a
 * escrever a lista numerada sempre.
 */
async function existeRotinaRecente(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    let q = supabase
      .from("rotinas")
      .select("id")
      .eq("family_account_id", familyId)
      .gte("created_at", desde)
      .limit(1);
    if (membroId) q = q.eq("membro_atipico_id", membroId);
    const { data } = await q;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

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

    // OS DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO — a lista INTEIRA.
    // Antes, `desafios_onboarding` só era lido no [0], e só pra escolher a
    // template de boas-vindas: o resto do que ela contou no cadastro nunca
    // chegava à conversa. A Ayla re-perguntava o que já sabia.
    //
    // Isto é RELATO da família, não diagnóstico e não conclusão da Ayla — o
    // rótulo abaixo diz isso ao modelo, porque a fronteira diagnóstica vale
    // igual: saber que a mãe marcou "sono" não autoriza afirmar nada.
    const desafios = Array.isArray(extras.desafios_onboarding)
      ? (extras.desafios_onboarding as unknown[]).map(String).filter(Boolean)
      : [];
    if (desafios.length) {
      partes.push(
        `NO CADASTRO A FAMÍLIA MARCOU estes desafios (relato dela, NÃO diagnóstico e NÃO conclusão sua): ${desafios.join(", ")} — use pra entender o contexto e pra NÃO re-perguntar; não force o assunto se ela trouxe outro`,
      );
    }

    if (preenchidos.length) partes.push(`JÁ TEM no perfil: ${preenchidos.join(", ")}`);
    if (faltando.length) partes.push(`AINDA FALTA (pergunte só se vier a propósito): ${faltando.join(", ")}`);
    return partes.join(". ");
  } catch {
    return "";
  }
}

/** Marca de reserva do convite — vive em `ayla_send_log`, fora do fluxo de envio. */
const RESERVA_NUDGE = "assinatura_nudge_reserva";
const JANELA_NUDGE_MS = 12 * 60 * 60 * 1000;
/**
 * A reserva olha para trás só o tempo de uma rajada, NÃO as 12h.
 *
 * `ayla_messages` só ganha linha quando o envio de fato sai (ver
 * `enviarEPersistir`), então é ele que sustenta o cooldown — e um envio que
 * falha volta a ser elegível na mensagem seguinte, como deve. Se a reserva
 * também olhasse 12h, uma reserva órfã (o envio falhou depois dela) silenciaria
 * a família por 12h por um convite que nunca chegou.
 */
const JANELA_RAJADA_MS = 2 * 60 * 1000;

/**
 * PODE CONVIDAR ESTA FAMÍLIA PRA ASSINAR AGORA?
 *
 * O nome antigo (`convidouAssinarRecente`) dizia "dedup do convite" e não
 * deduplicava nada: o retorno só escolhia entre o texto longo e o curto, e o
 * envio saía sempre. Toda mensagem que entrava de uma família sem acesso virava
 * um convite.
 *
 * Rochelle (família 7c764314), 23/07/2026: 4 convites em 6 SEGUNDOS (uma rajada de 4 desabafos), e
 * 15 no dia. Onze deles depois de ela já ter pago — porque o acesso só foi
 * gravado 19h depois (isso é outra frente; aqui o que se corrige é a repetição).
 *
 * A checagem tem que sobreviver a invocações simultâneas: numa rajada, as 4
 * leituras podem acontecer antes de qualquer escrita. Por isso o padrão é o
 * mesmo de `reservarEnvioProativo` — RESERVAR primeiro, depois conferir quem
 * chegou antes. A função de lá não serve direto: ela checa segurança, compete
 * contra todas as proativas da janela e aplica isenções de cadência, então o
 * convite bloquearia proativas e seria bloqueado por elas.
 */
export async function reservarConviteAssinatura(
  supabase: SupabaseClient,
  familyId: string,
): Promise<boolean> {
  const agora = Date.now();
  const desde = new Date(agora - JANELA_NUDGE_MS).toISOString();

  // Convite REALMENTE enviado na janela — cobre o histórico e o caso comum.
  const { data: enviados } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "outbound")
    .eq("tipo", "assinatura_nudge")
    .gte("created_at", desde)
    .limit(1);
  if ((enviados?.length ?? 0) > 0) return false;

  try {
    const { data: minha, error } = await supabase
      .from("ayla_send_log")
      .insert({
        family_account_id: familyId,
        template_key: RESERVA_NUDGE,
        status: "enfileirada",
        payload: { reservadoEm: new Date().toISOString() },
      })
      .select("id, created_at")
      .single();
    // Sem reserva não dá pra resolver corrida — envia, que é o comportamento
    // legítimo (família sem acesso). Repetir é menos grave que emudecer.
    if (error || !minha) return true;

    const { data: naJanela } = await supabase
      .from("ayla_send_log")
      .select("id, created_at")
      .eq("family_account_id", familyId)
      .eq("template_key", RESERVA_NUDGE)
      .gte("created_at", new Date(agora - JANELA_RAJADA_MS).toISOString());

    const perdi = (naJanela ?? []).some(
      (o) =>
        o.id !== minha.id &&
        (String(o.created_at) < String(minha.created_at) ||
          (String(o.created_at) === String(minha.created_at) && String(o.id) < String(minha.id))),
    );
    if (perdi) {
      // Some com a própria reserva: ela não virou envio, e deixá-la para trás
      // bloquearia a janela seguinte por um convite que nunca existiu.
      await supabase.from("ayla_send_log").delete().eq("id", minha.id);
      return false;
    }
    return true;
  } catch {
    return true;
  }
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

/**
 * BUSCA A FAMÍLIA PELO TELEFONE — e distingue os três desfechos que antes eram um só.
 *
 * O bug (02/08/2026): a consulta ignorava o `error`. Com o banco instável, `data`
 * vinha `undefined`, virava `[]`, e o chamador concluía "número não cadastrado"
 * para um número que ESTÁ cadastrado. Falha de infraestrutura virava classificação
 * de negócio. O telefone nunca foi o problema: `chaveTelefoneBR` é simétrica e a
 * família casa (verificado em produção, 76 famílias, zero colisão de chave).
 *
 * ⚠️ LACUNA DE PRODUTO, consciente: quando isto devolve `erro`, A MENSAGEM DA
 * FAMÍLIA SE PERDE. Não existe fila durável nem reprocessamento de inbound. E não
 * dá para pedir reentrega à Z-API: o webhook responde 200 dentro de `after()`,
 * ANTES deste código rodar (`app/api/ayla/webhook/route.ts`) — de propósito, porque
 * responder devagar fazia a Z-API reenviar e duplicar respostas. Mudar isso é
 * redesenho, não conserto. Enquanto não houver fila, o melhor possível é o
 * incidente ficar registrado em vez de virar silêncio inexplicado.
 *
 * 💸 DÍVIDA TÉCNICA: carregar TODAS as famílias para achar uma por telefone não
 * escala. Hoje são 76 e o custo é irrelevante; o teto do PostgREST corta em 1000
 * por padrão, e acima disso famílias ficariam invisíveis EM SILÊNCIO — a mesma
 * classe de falha do incidente Thamires. O limite abaixo é explícito e avisa ao
 * encostar. O desenho certo é buscar pelo registro/candidatos de telefone em vez
 * de varrer a tabela; não foi feito agora para não mudar a semântica do casamento.
 */
export const LIMITE_FAMILIAS = 2000;

export type BuscaFamilia =
  | { tipo: "erro"; erro: string }
  | {
      tipo: "ok";
      familia: { id: string; whatsapp_e164: string } | null;
      total: number;
      truncou: boolean;
    };

export async function encontrarFamiliaPorTelefone(
  supabase: SupabaseClient,
  phoneE164: string,
): Promise<BuscaFamilia> {
  const chave = chaveTelefoneBR(phoneE164);
  const { data, error } = await supabase
    .from("family_accounts")
    .select("id, whatsapp_e164")
    .not("whatsapp_e164", "is", null)
    .limit(LIMITE_FAMILIAS);

  // O `error` é a única coisa que distingue "banco falhou" de "ninguém casa".
  if (error) return { tipo: "erro", erro: error.message || "erro desconhecido" };
  // Sem erro e sem data é resposta malformada — tratar como falha, não como vazio.
  if (!data) return { tipo: "erro", erro: "consulta sem erro e sem dados" };

  const linhas = data as Array<{ id: string; whatsapp_e164: string }>;
  const familia =
    linhas.find((f) => chaveTelefoneBR(f.whatsapp_e164) === chave) ?? null;

  return {
    tipo: "ok",
    familia,
    total: linhas.length,
    truncou: linhas.length >= LIMITE_FAMILIAS,
  };
}

/**
 * A RESPOSTA DE UMA CLARIFICAÇÃO RETOMA O PEDIDO QUE A CAUSOU.
 *
 * Guarda-se o texto original no `metadata` da própria pergunta — sem tabela
 * nova, sem migração. Se a última fala da Ayla foi "Mario ou Manu?" e esta
 * mensagem nomeia uma das crianças, devolvemos o pedido inteiro de volta ao
 * roteamento, já com a criança resolvida.
 *
 * Conservador de propósito: só retoma quando a resposta é CURTA e casa com o
 * nome de um membro. "Manu" retoma; "deixa pra lá, me conta outra coisa" não.
 */
async function retomarPedidoAposClarificacao(
  supabase: SupabaseClient,
  familyId: string,
  resposta: string,
): Promise<{ pedido: string; membroId: string; membroNome: string; quandoISO: string } | null> {
  const t = (resposta ?? "").trim();
  if (!t || t.length > 60) return null;
  try {
    const { data: ultima } = await supabase
      .from("ayla_messages")
      .select("created_at, tipo, metadata")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultima || ultima.tipo !== "clarificacao_identificacao") return null;

    const pedido = ((ultima.metadata as Record<string, unknown> | null)?.pedido as string | null) ?? null;
    if (!pedido) return null;
    // Uma pergunta de identificação envelhece: passadas horas, a resposta curta
    // provavelmente é sobre outra coisa.
    const idadeH = (Date.now() - new Date(ultima.created_at as string).getTime()) / 3_600_000;
    if (idadeH > 3) return null;

    const { data: membros } = await supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true);
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const alvo = (membros ?? []).find((m) => {
      const nome = norm(String(m.nome ?? "").trim());
      return nome.length > 1 && norm(t).includes(nome.split(/\s+/)[0]!);
    });
    if (!alvo) return null;

    return {
      pedido,
      membroId: alvo.id as string,
      membroNome: String(alvo.nome ?? ""),
      quandoISO: String(ultima.created_at),
    };
  } catch (e) {
    console.error("[ayla:clarificacao] falha ao retomar:", e instanceof Error ? e.message : e);
    return null;
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
  const busca = await encontrarFamiliaPorTelefone(supabase, inbound.phoneE164);

  if (busca.tipo === "erro") {
    // FALHA DE BANCO — NÃO é "número não cadastrado". Antes o `error` da consulta
    // era descartado: `data` vinha undefined, virava [], o find não achava nada e
    // o código concluía que a pessoa não era cadastrada. Uma instabilidade de
    // banco ficava indistinguível de um desconhecido — foi o que aconteceu em
    // 02/08/2026, com 47s entre o parse e o "não cadastrado", num número que ESTÁ
    // cadastrado. O log agora é inequívoco e a família não é reclassificada.
    console.error(
      `[ayla] FALHA AO CONSULTAR FAMÍLIAS (não é número desconhecido): ${busca.erro} | telefone=${inbound.phoneE164} chave=${chaveIn}`,
    );
    await logServerError("ayla_lookup_familia_falhou", new Error(busca.erro), {
      family_account_id: null,
      payload: { telefone: inbound.phoneE164, chave: chaveIn, texto: inbound.texto.slice(0, 120) },
    }).catch(() => {});
    // ⚠️ A MENSAGEM SE PERDE, e isto é uma lacuna conhecida — ver a nota sobre
    // reentrega em `encontrarFamiliaPorTelefone`. Não há como pedir retry daqui.
    return { tratada: false };
  }

  if (busca.truncou) {
    console.error(
      `[ayla] LIMITE DE FAMÍLIAS ATINGIDO (${busca.total}) — buscas podem falhar em silêncio. Ver dívida técnica em encontrarFamiliaPorTelefone.`,
    );
  }

  const family = busca.familia;
  if (!family) {
    // Aqui sim: a consulta funcionou e nenhuma família casa com este número.
    //
    // ⚠️ ANTES ACABAVA NESTA LINHA, num `console.warn`. A mensagem não era
    // guardada em lugar nenhum (o `return` acontece antes de persistir em
    // `ayla_messages`) e a pessoa levava silêncio absoluto. Agora o contato
    // fica REGISTRADO e ela recebe, uma vez a cada 7 dias, o caminho de
    // entrada. Ver lib/ayla/desconhecido.ts — nada de IA, nada de conversa.
    //
    // O caminho experimental NÃO participa daqui, e é por construção: ele só
    // existe muito abaixo, depois de a família estar identificada. Número
    // desconhecido nunca fala com agente conversacional.
    const atendida = await atenderDesconhecido(supabase, inbound);
    console.warn(
      `[ayla] inbound de número não cadastrado: ${inbound.phoneE164} (chave ${chaveIn})` +
        ` — respondido=${atendida.respondido}${atendida.motivo ? ` (${atendida.motivo})` : ""}`,
    );
    return { tratada: false };
  }

  // 1a. BLOQUEIO: se a Ayla foi desativada/bloqueada pra essa família (opt-out
  // "sair", ou bloqueio manual do admin — ex.: criança/não-titular usando o
  // número), NÃO responde a nada. Antes o reativo ignorava isso e continuava
  // respondendo (inclusive pra quem pediu "sair").
  // ⚠️ AS TRÊS LEITURAS DE ABERTURA, EM PARALELO (13/08/2026, PEND-064).
  //
  // Eram três idas em fila — preferências, oferta de fim de semana e rotina
  // pendente —, e nenhuma depende da outra: as três só precisam de
  // `family.id` e do horário da mensagem. A ~400 ms cada, a fila custava
  // ~1,2 s onde cabia ~0,4 s.
  //
  // ⚠️ OS PORTÕES NÃO MUDARAM DE ORDEM. Continuam sendo avaliados um a um,
  // logo abaixo, na mesma sequência de antes — o que mudou é QUANDO os dados
  // chegam, não quem decide. Numa família bloqueada, as outras duas leituras
  // acontecem à toa: são `select` puros, sem efeito, e o preço é ler duas
  // linhas a mais num caminho raro em vez de 800 ms em todos os outros.
  //
  // `ofertaFds` e `rotinaConversa` continuam calculadas ANTES de o inbound
  // ser persistido — é disso que depende detectar "primeira resposta".
  const [{ data: pref }, ofertaFds, rotinaConversa] = await Promise.all([
    supabase
      .from("ayla_preferences")
      .select("desativada, consentimento_em")
      .eq("family_account_id", family.id)
      .maybeSingle(),
    ofertaFimDeSemanaPendente(supabase, family.id, inbound.recebidaEm),
    rotinaConversaPendente(supabase, family.id, inbound.recebidaEm),
  ]);
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

  /**
   * O HISTÓRICO DO TURNO, LIDO UMA VEZ SÓ (13/08/2026, PEND-064).
   *
   * ⚠️ MEDIDO: a mesma consulta das 9 últimas falas rodava TRÊS VEZES por
   * turno — no classificador de intenção, no parser e nos loaders paralelos.
   * A ~400 ms cada, eram ~800 ms de rede jogados fora em TODO turno.
   *
   * ⚠️ PREGUIÇOSO DE PROPÓSITO: só dispara no primeiro consumidor. Entre este
   * ponto e o parser há uma dúzia de portões que retornam cedo (comando, CRM,
   * assinatura, fim de semana, menu…), e ler adiantado transformaria economia
   * em consulta a mais nesses caminhos.
   *
   * ⚠️ ESCOPO: `const` local desta execução, amarrado a ESTE `family.id`. Não
   * é cache global e não sobrevive ao turno — não há como um turno enxergar o
   * histórico de outra família.
   */
  let historicoBrutoPromise: Promise<LinhaDeHistorico[]> | null = null;
  const historicoDoTurno = () =>
    (historicoBrutoPromise ??= lerHistoricoBruto(supabase, family.id));

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
  // ⚠️ ADOTA O TEXTO DO LOTE SEMPRE QUE ELE TIVER TEXTO — antes era só
  // `quantidade > 1`, e `quantidade` conta textos NÃO VAZIOS, não linhas
  // claimadas. Uma mensagem só-de-mídia (texto vazio) entrando no mesmo lote de
  // uma mensagem de texto devolvia `quantidade === 1`, a condição não passava, e
  // o turno seguia com o texto vazio da mídia — a fala da mãe se perdia. Já
  // valia para foto sem legenda; com vídeo passaria a valer muito mais.
  // Quando o turno é uma mensagem de texto só, `turno.texto` É `inbound.texto`:
  // adotar não muda nada.
  if (turno.texto.trim()) {
    // O resto da função (parser, responder, ponte) passa a ver a fala inteira.
    inbound = { ...inbound, texto: turno.texto };
  }

  // 3c. VÍDEO — a Ayla não assiste, e ficar muda é muito pior do que dizer isso.
  //
  // ⚠️ Até 13/08/2026 o vídeo nem chegava aqui: `parseZapiWebhook` devolvia null
  // e o webhook respondia `{skipped:true}`. A mãe mandava o filho em crise e não
  // recebia nada — nem um "recebi". Silêncio, não recusa.
  //
  // DEPOIS DO LOTE de propósito: vídeo + texto na MESMA rajada (≤3s) é um turno
  // só, e quem responde é o texto. Vídeo sozinho cai aqui. ⚠️ Fora dos 3s são
  // dois turnos — a mãe recebe este recado e depois a resposta ao texto. É o
  // comportamento de hoje para qualquer rajada lenta, e pertence à PEND-058
  // (mediana entre balões = 11,2s); NÃO se resolve alargando a janela.
  //
  // ⚠️ O DONO DESTA DECISÃO É O CÓDIGO, NÃO O MODELO. "Chegou vídeo e não há
  // texto" é estado do que entrou, não interpretação — então nenhuma chamada
  // conversacional acontece neste caminho. E o modelo nunca vê o vídeo nem como
  // imagem: `imagemUrl` exige `midiaTipo === "image"`, igualdade estrita. É o
  // orquestrador não oferecendo o que não existe, em vez de uma proibição em
  // prompt — que competiria com "seja prestativa" e perderia.
  if (inbound.midiaTipo === "video" && !inbound.texto.trim()) {
    console.log(`[ayla] vídeo sem texto — recado honesto (family ${family.id})`);
    const ctxVideo = await loadFamiliaParaEnvio(supabase, family.id);
    const resp = await enviarEPersistir(supabase, {
      family_account_id: family.id,
      membro_atipico_id: null,
      phone: ctxVideo?.whatsapp_e164 ?? inbound.phoneE164,
      texto: TEXTO_VIDEO_SEM_TEXTO,
      category: "reativa",
      tipo: "midia_nao_suportada",
    });
    return { tratada: true, familia: family.id, resposta: resp };
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

    // ── SEGURANÇA VEM ANTES DA COBRANÇA (PEND-071) ───────────────────────
    //
    // ⚠️ O QUE ESTAVA ERRADO. Este gate devolvia `{tratada:true}` em TODOS os
    // ramos, e `segurancaAberta` só é consultada 195 linhas abaixo — portanto
    // inalcançável para quem não passou aqui. Uma mãe com o teste vencido
    // escrevendo no meio de uma crise recebia o convite para assinar, ou, dentro
    // do cooldown de 12h, NADA.
    //
    // A proteção existente não falhou: ela pegou o problema para o qual foi
    // feita (o caso Camile/Gramado, de entregável vazando de graça). O que
    // faltava era a pergunta oposta — não "o que não pode vazar", mas "o que
    // não pode esperar".
    //
    // ⚠️ ISTO NÃO LIBERA O SERVIÇO. Nenhum plano, rotina, estratégia ou
    // orientação passa por aqui: sai um texto fixo de acolhimento e
    // encaminhamento, e o `return` mantém a conversa bloqueada como antes.
    // O convite comercial é SUPRIMIDO neste turno — cobrar no meio de uma
    // crise é pior que o silêncio que estamos corrigindo.
    //
    // Duas portas, e a ordem entre elas é de custo: o estado já aberto é uma
    // consulta que só acontece quando a triagem de texto não pegou nada.
    const emRisco =
      mensagemPedeSeguranca(inbound.texto) ||
      (await segurancaAberta(supabase, family.id, inbound.recebidaEm)).aberta;

    if (emRisco && ctxA?.whatsapp_e164) {
      // ⚠️ SEM COOLDOWN. `reservarConviteAssinatura` governa o convite
      // comercial, não isto. Uma segunda mensagem de risco dentro das 12h tem
      // que ser respondida — era exatamente esse silêncio o pior sintoma.
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: null,
        phone: ctxA.whatsapp_e164,
        texto: textoSegurancaSemAcesso(ctxA.nomeMae),
        category: "reativa",
        // `seguranca` ABRE o estado: os próximos turnos desta família entram
        // por `segurancaAberta` acima, mesmo sem palavra-chave na mensagem.
        tipo: "seguranca",
      });
      return { tratada: true, familia: family.id, resposta: resp };
    }

    if (ctxA) {
      // COOLDOWN REAL: um convite por família a cada 12h. O gate de acesso
      // continua valendo (a conversa não segue sem assinatura) — o que para de
      // acontecer é o convite se repetir a cada mensagem.
      const podeConvidar = await reservarConviteAssinatura(supabase, family.id);
      if (!podeConvidar) {
        console.log(`[ayla:assinatura] convite suprimido pelo cooldown de 12h — família ${family.id}`);
        return { tratada: true, familia: family.id };
      }
      const link = await gerarMagicLink(supabase, { familyId: family.id, next: "/assinatura" });
      // A variante curta ("🌿 Pra gente continuar…") existia para o convite
      // REPETIDO dentro das 12h. Com o cooldown, esse convite não acontece
      // mais — o ramo virou inalcançável, então sai. Nenhuma mensagem que a
      // família recebia deixa de existir: fora da janela, o texto sempre foi
      // este. Se um segundo convite precisar de outra voz, isso é política.
      const texto = `Oi, ${ctxA.nomeMae}! Eu adoraria seguir te ajudando 🌿 Mas seu período grátis acabou. Pra a gente continuar — estratégias, rotina, tudo o que você já conhece — é só assinar aqui:\n${link}\n\nO que você me contou fica tudo guardado. 💛`;
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

  // 3b-acesso. "Não consigo entrar", "esqueci a senha", "o link não abre" →
  // a Ayla RESOLVE na hora: manda um link de acesso novo (token nosso, 7 dias,
  // não mata os outros). Vem cedo no fluxo porque, trancada fora, nada mais que
  // ela pedir vai funcionar — foi o que aconteceu com a mãe que passou dois dias
  // sem acesso enquanto brigava com a escola (22–26/07).
  //
  // ⚠️ SUBIU PARA ANTES DO RAMO EXPERIMENTAL EM 15/08/2026 (Fatia 1 · Opção C).
  // Ele ficava DEPOIS, e o `return` do experimental o pulava inteiro: uma
  // família da allowlist trancada fora do app não recebia o link — recebia uma
  // resposta conversacional sobre estar trancada fora, que é exatamente o que
  // não ajuda. O inventário de 15/08 marcou isso como o único P0.
  //
  // Mover custou nada: `pedeAcessoAoApp` é regex pura sobre o texto de entrada
  // — sem parser, sem LLM, sem consulta, sem estado. Ela só vem depois do gate
  // de assinatura, que continua acima e é o que não pode ser pulado.
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
    // Falhou criar o link → segue o fluxo, e a Ayla ainda responde algo.
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

  // ── SEGURANÇA ABERTA? ───────────────────────────────────────────────────
  // Lido ANTES de qualquer roteamento. Caso real (03/08): uma mãe relatou a
  // tentativa de suicídio da filha, a Ayla acertou o primeiro turno — e voltou
  // a ser conversa comum na mensagem seguinte, organizando a rotina da casa
  // cinco minutos depois. Cada turno reentrava do zero porque não havia estado.
  const seguranca = await segurancaAberta(supabase, family.id, inbound.recebidaEm);
  if (seguranca.aberta) {
    console.log(`[ayla:seguranca] ABERTA desde ${seguranca.desde} (checar=${seguranca.precisaChecar})`);
  }

  // ── A RESPOSTA DE "MARIO OU MANU?" RETOMA O PEDIDO ──────────────────────
  // Karina, 08/08/2026: pediu a rotina do Dia dos Pais com cartões; a Ayla
  // perguntou de qual filha; ela respondeu "Manu" — e o pedido morreu ali.
  // "Manu" não parece pedido de rotina pro classificador, então a mensagem caiu
  // no reativo, que respondeu bonito e NÃO criou artefato nenhum. Nenhuma
  // rotina foi criada; dois turnos depois a Ayla oferecia PDF de rotinas
  // antigas.
  //
  // Mesma invariante do tema: pergunta que a Ayla faz pra concluir o artefato
  // não pode fechar o estado. A retomada devolve o TEXTO ORIGINAL e o
  // roteamento normal decide de novo — sem caso especial, sem segunda máquina
  // de estado. Quem perguntou tem que estar pronto pra ouvir a resposta.
  const retomada = await retomarPedidoAposClarificacao(supabase, family.id, inbound.texto);
  if (retomada) {
    console.log(
      `[ayla:clarificacao] "${inbound.texto}" retoma o pedido de ${retomada.quandoISO} — criança ${retomada.membroNome}`,
    );
    inbound = { ...inbound, texto: retomada.pedido };
  }

  // Criança que a conversa trata AGORA (2+ filhos) — pra rotina/plano seguirem
  // o filho certo e não caírem no membros[0] (bug Manu→Mario).
  const membroConversa = retomada?.membroId ?? (await criancaDaConversa(supabase, family.id));

  // ENTRADA GUIADA — a rampa de quem chega sem saber o que contar.
  //
  // Vem ANTES da classificação de propósito: "oi" não tem o que classificar, e
  // gastar uma chamada de modelo para descobrir isso é desperdício. Situação
  // concreta não passa por aqui (ver `ehEntradaVaga`), então quem já contou o
  // que está acontecendo continua sendo atendida na hora.
  const desafiosOnboarding = await carregarDesafiosOnboarding(supabase, membroConversa);
  if (
    !rotinaConversa &&
    (await deveMostrarMenu(supabase, {
      familyId: family.id,
      texto: inbound.texto,
      membroId: membroConversa,
    }))
  ) {
    const ctxMenu = await loadFamiliaParaEnvio(supabase, family.id);
    if (ctxMenu) {
      const bruto = ctxMenu.membros.find((m) => m.id === membroConversa)?.nome ?? "";
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: membroConversa,
        phone: ctxMenu.whatsapp_e164,
        texto: montarTextoDoMenu({
          desafiosOnboarding,
          nomeMae: primeiroNomeConfiavel(ctxMenu.nomeMae) || null,
          // O mesmo detector do nome da criança: o campo aceita recado, e um
          // recado inteiro no lugar do nome já saiu para família real.
          nomeCrianca: primeiroNomeConfiavel(bruto) || null,
        }),
        category: "reativa",
        tipo: TIPO_ENTRADA_GUIADA,
      });
      return { tratada: true, familia: family.id, resposta: resp };
    }
  }

  // A MÃE RESPONDEU O NÚMERO. O tema sai do menu que ela VIU, não de uma
  // adivinhação do modelo sobre o que "2" quer dizer — e a skill correspondente
  // vai junto, porque a chave do tema é a mesma chave da skill.
  const escolha = rotinaConversa
    ? null
    : await escolhaDoMenu(supabase, family.id, inbound.texto);

  // INTENÇÃO + TEMA por IA (entende o que a mãe quer e sobre o que, não só
  // palavra-chave). Sinal PRIMÁRIO do roteamento abaixo; os `pede*` de regex
  // ficam como reforço (OR). Só roda aqui (mensagem livre que precisa de rumo)
  // — comandos/registro já trataram antes. Se uma conversa de rotina está em
  // curso, nem precisa (o estado `rotinaConversa` conduz).
  //
  // CONTINUIDADE DO TEMA sem persistir nada: o carregador do tema é a própria
  // conversa. As duas últimas falas dizem em que assunto vocês estavam, e os
  // desafios do cadastro dizem de onde ele provavelmente nasceu. Foi a decisão
  // consciente de 02/08 — sem coluna, sem migração; se a derivação se mostrar
  // insuficiente no uso real, aí se discute persistir, com evidência.
  const turnoClassificado = rotinaConversa
    ? { intencao: "outro" as const, tema: null, aceite: null, skills: [] as string[] }
    : await classificarIntencao({
        texto: inbound.texto,
        // ⚠️ 15/08/2026 · O CLASSIFICADOR SAI DA INVISIBILIDADE. Ele rodava em
        // todo turno e não aparecia em nenhuma das 6.000 chamadas registradas
        // em `api_calls` — custo e latência dele simplesmente não existiam.
        // Passar estes dois faz o turno virar linha; não muda decisão nenhuma.
        supabase,
        familyId: family.id,
        ...(await ultimasFalas(supabase, family.id, inbound.texto, await historicoDoTurno())),
        temasOnboarding: await carregarDesafiosOnboarding(supabase, membroConversa),
        // QUAL REPERTÓRIO CONSULTAR — decidido na MESMA chamada que já classifica
        // intenção e tema. Zero chamada de LLM a mais: o campo é o quarto de uma
        // linha que já vinha com três. Só entram as skills `ativo=true`.
        catalogoSkills: await carregarCatalogoSkills(supabase),
      });
  const intent = turnoClassificado.intencao;
  // A escolha do menu MANDA no tema: ela é explícita, o classificador é
  // inferência. Duas fontes para a mesma decisão sempre divergem, e aqui a
  // dona é a família.
  const temaAtivo = escolha?.chaves[0] ?? turnoClassificado.tema;
  if (escolha && escolha.chaves.length > 0 && turnoClassificado.skills.length === 0) {
    // Sem isto, "2" chegaria à recuperação sem skill nenhuma e a resposta
    // sairia sem repertório — o elo que esta fatia precisava ligar.
    turnoClassificado.skills.push(...escolha.chaves.slice(0, 2));
  }
  // O QUE ELA ACEITOU. "sim" não carrega conteúdo — sem referente resolvido, o
  // modelo reconstrói o turno a partir da conversa inteira. Foi assim que um
  // "Sim. Vamos montar uma história." virou uma resposta sobre diagnóstico
  // (04/08/2026): a fronteira barrou duas vezes e o piso foi ao ar.
  const aceite = turnoClassificado.aceite;

  /**
   * AMBÍGUO PERGUNTA — não chuta. Reusa `templateClarificacaoMembro` e o tipo
   * `clarificacao_identificacao` que já existiam pra o parser: a peça estava
   * pronta e só não era chamada no caminho da rotina.
   */
  const perguntarQualCrianca = async (
    sb: SupabaseClient,
    fam: { id: string },
    ctxR: { whatsapp_e164: string } | null,
    candidatos: Array<{ id: string; nome?: string | null }>,
  ) => {
    const nomes = candidatos.map((c) => ({ nome: (c.nome ?? "").trim() })).filter((c) => c.nome);
    const texto = await templateClarificacaoMembro(sb, { membros: nomes });
    const resp = ctxR
      ? await enviarEPersistir(sb, {
          family_account_id: fam.id,
          membro_atipico_id: null,
          phone: ctxR.whatsapp_e164,
          texto,
          category: "reativa",
          tipo: "clarificacao_identificacao",
          // O PEDIDO VIAJA COM A PERGUNTA. Sem isto, a resposta ("Manu") chega
          // sozinha e o pedido de rotina que a originou se perde — foi o que
          // aconteceu com a Karina em 08/08/2026.
          metadataMensagem: { pedido: inbound.texto },
        })
      : undefined;
    return { tratada: true as const, familia: fam.id, resposta: resp ?? undefined };
  };

  /**
   * De quem é este pedido de rotina? Uma decisão só, com a política de
   * `membro-alvo.ts`. Devolve null quando é AMBÍGUO — e aí o handler pergunta
   * em vez de chutar.
   *
   * O `?? ctxR.membros[0]?.id` que existia aqui foi o que pôs a rotina da
   * consulta médica da Manu dentro do Mario: a mãe escreveu "levar ELA no
   * médico", a regex de nome não achou nada, e a cadeia caiu no irmão.
   */
  const alvoDaRotina = (
    ctxR: { membros: Array<{ id: string; nome?: string | null; genero?: Genero }> } | null,
    contexto: string | null,
  ): { membroId: string | null; ambiguo: Array<{ id: string; nome?: string | null }> | null } => {
    if (!ctxR?.membros?.length) return { membroId: null, ambiguo: null };
    const r = resolverMembroAlvo({
      texto: inbound.texto,
      membros: ctxR.membros,
      membroContexto: contexto,
    });
    if (r.tipo === "resolvido") return { membroId: r.membroId, ambiguo: null };
    if (r.tipo === "ambiguo") return { membroId: null, ambiguo: r.candidatos };
    return { membroId: null, ambiguo: null };
  };

  // 3c-rotina-ver. "Traga a rotina de hoje/terça" — só quando NÃO está montando
  // uma agora (senão o pedido é parte da conversa). Acha o dia, gera se faltar e
  // manda o link certo.
  if (!seguranca.aberta && !rotinaConversa && (intent === "rotina_ver" || pedeRotinaDeUmDia(inbound.texto))) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const alvo = alvoDaRotina(ctxR, membroConversa);
    if (alvo.ambiguo) return await perguntarQualCrianca(supabase, family, ctxR, alvo.ambiguo);
    const membroId = alvo.membroId;
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
  // Entra também por FEEDBACK ("já faz sozinho", "não funcionou até o jantar"):
  // a família não pede edição com essas palavras, mas é edição que ela precisa.
  // `lerFeedbackDaRotina` exige âncora no quadro daquele membro antes de mexer.
  const ehFeedbackDeRotina =
    !seguranca.aberta && !rotinaConversa && classificarFeedbackRotina(inbound.texto) !== null;
  // ⚠️ ESTE É O PORTÃO DO CASO ANA/GEOVANNA (11/08/2026, PEND-044). "Não achei
  // uma rotina pra ajustar 🌿" nasce em `editarRotina`, e quem abriu a porta foi
  // `pedeEditarRotina` — não o portão de criar, corrigido em ad59254.
  //
  // MEDIDO nas funções reais: `pedeEditarRotina` abre para 4 de 6 usos
  // CONCEITUAIS de "mudar a rotina" ("qdo muda a rotina ela fica mal", "ele não
  // aceita mudar a rotina") e para apenas 2 dos 8 pedidos legítimos de edição —
  // os outros 6 entram por `intent === "rotina_editar"` ou pelo feedback. Ou
  // seja: como gatilho isolado ele erra mais do que acerta.
  //
  // O ato de EDITAR passa a ser exigido só dele. `intent === "rotina_editar"` e
  // `ehFeedbackDeRotina` ficam intocados de propósito: o feedback real ("já faz
  // sozinho", "não funcionou até o jantar") é `ambiguo` para o classificador —
  // é edição pela NECESSIDADE, não pelo ato —, e exigir o ato ali mataria o
  // caminho inteiro.
  const pedidoDeEditarRotina =
    pedeEditarRotina(inbound.texto) && atoSobreArtefato(inbound.texto) === "editar";
  if (
    !seguranca.aberta &&
    !rotinaConversa &&
    (intent === "rotina_editar" || pedidoDeEditarRotina || ehFeedbackDeRotina)
  ) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const alvo = alvoDaRotina(ctxR, membroConversa);
    if (alvo.ambiguo) return await perguntarQualCrianca(supabase, family, ctxR, alvo.ambiguo);
    const membroId = alvo.membroId;
    if (ctxR && membroId) {
      // O membro vem de `alvoDaRotina`, então a rotina lida e o resultado
      // gravado são SEMPRE do filho em foco — feedback de um não mexe no outro.
      const feedback = await lerFeedbackDaRotina(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        texto: inbound.texto,
      });
      // Leitura de feedback sem âncora no quadro: não é edição. `msg` volta
      // null e o fluxo cai na conversa normal, logo abaixo — mesmo caminho de
      // quando o editor reconhece que a mensagem não pedia mudança.
      const semAncora =
        ehFeedbackDeRotina && !feedback && intent !== "rotina_editar" && !pedeEditarRotina(inbound.texto);
      const msg = semAncora ? null : await editarRotina(supabase, {
        familyId: family.id,
        membroAtipicoId: membroId,
        texto: inbound.texto,
        timezone: null,
        phoneE164: ctxR.whatsapp_e164,
        feedback,
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
  // `pedeRotina` exige a PALAVRA "rotina" — e "quero organizar a tarde da Manu"
  // não a tem. Medido em 03/08/2026: essa frase dá false no detector E "outro"
  // no classificador, ou seja, o pedido mais explícito que existe não entrava no
  // ── PDF / CARTÕES: ANTES do construtor, e isso é obrigatório ──────────
  // "Eu já mandei e você montou a rotina. Só preciso do PDF" contém a palavra
  // ROTINA, e `pedeRotina` casa com ela. Registrada depois do gate abaixo,
  // esta rota nunca veria a mensagem: o construtor captura, pede a sequência
  // de novo e duplica o artefato — foi exatamente o que aconteceu com a
  // Rosângela em 07/08/2026. A ordem aqui É a correção.
  // ⚠️ E A CONVERSA GANHA DO BANCO. Se o pedido aponta pro que a Ayla ACABOU
  // de construir ("cartões disso", "um novo pra amanhã", ou simplesmente uma
  // sequência numerada no turno anterior), esta rota SAI DA FRENTE: o alvo não
  // está salvo, e perguntar "qual das rotinas antigas?" é o que fez a mãe da
  // Manu repetir o que ela mesma tinha acabado de dizer (07/08/2026).
  const { data: ultimaAyla } = await supabase
    .from("ayla_messages")
    .select("texto")
    .eq("family_account_id", family.id)
    .eq("direcao", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // ── EXISTE ARTEFATO? ENTÃO A ROTA VALE ─────────────────────────────────
  // `apontaProRecente` protege um caso real: "quero cartões disso" sobre uma
  // sequência CONVERSADA e ainda não persistida não pode pescar uma rotina
  // antiga — ali quem tem o contexto é a conversa. Continua valendo.
  //
  // O que quebrou foi uma das evidências dele: "a última fala da Ayla tem 3+
  // passos numerados". A Fase 1 (08/08/2026) passou a escrever essa lista
  // SEMPRE, direto do banco. De sinal ocasional virou constante, e a rota
  // determinística ficou desligada em todo turno logo depois de uma rotina —
  // que é exatamente quando a mãe pede o PDF. Karina, 08/08: entregou o
  // zoológico, ela disse "Pdf", e a Ayla terminou dizendo que "daqui não
  // consigo gerar o arquivo", com `rotinaParaPdf` pronto ao lado.
  //
  // O discriminador certo não é o FORMATO da mensagem, é um FATO: a rotina
  // existe? Se nasceu agora, ela é o referente e não há o que adivinhar.
  // ⚠️ DETECTAR NÃO É AUTORIZAR — o caso Juliana/Daniel (11/08/2026, PEND-044).
  //
  // A mãe escreveu "ele esta colocando muita coisa na boca, planta, bonecos,
  // papel, plastico". `PEDE_PDF` casa `\bpapel\b` — a palavra está lá porque
  // "me manda no papel" é pedido legítimo de impressão. O portão abriu com uma
  // condição verdadeira, e ela recebeu "Ainda não temos uma rotina montada pra
  // eu transformar em PDF" no lugar de ajuda com o filho.
  //
  // `pedeArtefatoImprimivel` continua sendo o que sempre foi: detector de
  // VOCABULÁRIO e de alvo. Quem autoriza é o ATO.
  //
  // ⚠️ E OS ATOS AQUI NÃO SÃO OS DE `abreFluxoDeArtefato`. Neste artefato
  // `reenviar` É o caso central — "me manda o pdf" é a frase mais comum de
  // todas —, enquanto no Plano `reenviar` deliberadamente NÃO abre geração.
  // Contratos diferentes para artefatos diferentes, escritos por extenso.
  const atoImprimivel = atoSobreArtefato(inbound.texto);
  const autorizaImprimivel =
    atoImprimivel === "criar" || atoImprimivel === "editar" || atoImprimivel === "reenviar";
  const pedeImprimivel = pedeArtefatoImprimivel(inbound.texto) && autorizaImprimivel;
  const temRotinaRecem = pedeImprimivel
    ? await existeRotinaRecente(supabase, family.id, membroConversa)
    : false;
  const apontaRecente = apontaProRecente(
    inbound.texto,
    (ultimaAyla as { texto?: string } | null)?.texto ?? null,
  );
  if (
    !seguranca.aberta &&
    !rotinaConversa &&
    pedeImprimivel &&
    (temRotinaRecem || !apontaRecente)
  ) {
    const ctxP = await loadFamiliaParaEnvio(supabase, family.id);
    const alvoP = alvoDaRotina(ctxP, membroConversa);
    if (alvoP.ambiguo) return await perguntarQualCrianca(supabase, family, ctxP, alvoP.ambiguo);
    if (ctxP && alvoP.membroId) {
      const r = await entregarArtefatoImprimivel(supabase, {
        familyId: family.id,
        membroAtipicoId: alvoP.membroId,
        texto: inbound.texto,
        phoneE164: ctxP.whatsapp_e164,
        nome: ctxP.membros.find((m) => m.id === alvoP.membroId)?.nome ?? "",
      });
      // `null` = não havia o que entregar de forma determinística; a conversa
      // segue normal, sem promessa nenhuma.
      if (r) {
        const resp = await enviarEPersistir(supabase, {
          family_account_id: family.id,
          membro_atipico_id: alvoP.membroId,
          phone: ctxP.whatsapp_e164,
          texto: r,
          category: "reativa",
          tipo: "resposta_registro",
        });
        return { tratada: true, resposta: resp };
      }
    }
  }

  // fluxo. `pediuRotinaExplicitamente` cobre o período nomeado sem a palavra.
  //
  // ⚠️ FALAR SOBRE ROTINA NÃO É PEDIR UMA ROTINA (11/08/2026, PEND-044).
  //
  // `pedeRotina` e `pediuRotinaExplicitamente` perguntam "a palavra aparece E
  // existe um verbo por perto?" — e verbo não separa PEDIR de DESCREVER. Medido
  // contra as funções reais: **5 de 6 usos conceituais** abriam o artefato. O
  // caso que fechou a conta foi "Quando é PRECISO mudar a rotina de repente ela
  // sente" — o radical `precis` casou, e uma descrição do que acontece com a
  // criança virou pedido de artefato.
  //
  // Os dois continuam como PISO (a rotina precisa ser mencionada); o que se
  // acrescenta é o ATO — `criar` e `editar` abrem; `conversar_sobre`,
  // `reenviar`, `recusar` e `ambiguo` não. A composição só pode ESTREITAR o
  // portão, nunca alargá-lo.
  //
  // ⚠️ `intent === "organizacao"` FICA, e a decisão de mantê-lo é deliberada.
  //
  // Eu havia tirado: o comentário abaixo já dizia que ela "NÃO diz que precisa
  // de rotina", e o código entrava assim mesmo. Mas **não há prova** de que um
  // turno real classificado como `organizacao` tenha criado artefato indevido —
  // `conhecimento_consultado` não registra intenção, e a suspeita é INFERIDA.
  // Corrigir por inferência é o que esta frente inteira existe para não fazer.
  // Quando a instrumentação registrar a intenção (PEND-040), isto se decide com
  // dado. Até lá, o que muda é só o que está medido.
  const pedidoDeRotina =
    (pedeRotina(inbound.texto) || pediuRotinaExplicitamente(inbound.texto)) &&
    abreFluxoDeArtefato(atoSobreArtefato(inbound.texto));
  if (
    !seguranca.aberta &&
    // `rotinaConversa` é CONTINUAÇÃO de uma montagem já em curso — a família já
    // pediu, e o turno é a resposta dela. Não passa pelo ato de novo.
    (rotinaConversa ||
      intent === "rotina_criar" ||
      // "organizacao" entra na MESMA capacidade — e é por isso que ela existe.
      // O classificador diz que o assunto é sequência/previsibilidade/passagem;
      // NÃO diz que precisa de rotina. Quem escolhe entre orientação, sequência
      // curta e o período inteiro é a prontidão, um passo adiante.
      intent === "organizacao" ||
      pedidoDeRotina)
  ) {
    const ctxR = await loadFamiliaParaEnvio(supabase, family.id);
    const alvo = alvoDaRotina(ctxR, rotinaConversa?.membroId ?? membroConversa);
    if (alvo.ambiguo) return await perguntarQualCrianca(supabase, family, ctxR, alvo.ambiguo);
    const membroId = alvo.membroId;
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
          // "rotina_pronta", NÃO "resposta_registro". A ponte do PLANO dispara
          // em resposta_registro — então a rotina ficar pronta ACIONAVA o
          // gerador de plano. Caso real (03/08, 00:33): a mãe pediu a rotina da
          // tarde, recebeu a rotina, e logo depois "vou mandar agora o plano
          // estratégico em PDF" com um PDF de PLANO. Ela pediu rotina e recebeu
          // outro artefato.
          // Rotina montada mas esperando o tema dos cartões: a conversa fica
          // ABERTA, senão o "pode ser dinossauros" dela cai na conversa comum
          // e os cartões nunca saem. A ponte do Plano segue bloqueada, que é o
          // que "rotina_pronta" protegia.
          //
          // ⚠️ "rotina_proposta" (17/08/2026): a Ayla PÔS UMA SEQUÊNCIA NA MESA
          // e está esperando a família. É tipo próprio porque o turno seguinte
          // precisa saber que existe uma decisão em aberto — e as etapas viajam
          // em `metadataMensagem`, senão o "sim" da mãe não teria referente e a
          // sequência aprovada não teria como chegar ao quadro.
          tipo: r.proposta?.length
            ? "rotina_proposta"
            : r.pronto && !r.aguardandoTema
              ? "rotina_pronta"
              : "rotina_conversa",
          // Mesmo canal que a clarificação já usa pra guardar o pedido que a
          // originou: `ayla_messages.metadata`, lido pela mensagem seguinte.
          ...(r.proposta?.length ? { metadataMensagem: { proposta: r.proposta } } : {}),
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

  // ⚠️ 15/08/2026 · C2 — O EXPERIMENTAL DESCEU PARA CÁ.
  //
  // Ele era a PRIMEIRA porta depois do gate de assinatura, e o `return` dele
  // pulava tudo o que vem acima: fim de semana, escolha de criança, rotina
  // (ver/editar/conduzir), Cartões e o "sim" curto do Kolo Vivo. Uma família
  // da allowlist que pedisse a rotina de terça não recebia a rotina —
  // recebia uma resposta conversacional SOBRE rotina. A capacidade existia e
  // não era alcançada.
  //
  // Descer resolve sem duplicar nada: os roteadores já se auto-excluem por
  // `if` e já encerram o turno com `return`. O experimental passa a ser o que
  // sempre foi na intenção — quem responde quando NENHUMA intenção
  // especializada casou.
  //
  // ⚠️ O QUE ELE GANHA AQUI: `turnoClassificado` já existe neste ponto, com
  // intenção, tema, aceite e skills. Um dono só para a decisão, e é o mesmo
  // objeto que a recuperação de Boas Práticas consome logo abaixo — então
  // religar o acervo ao caminho novo não custa classificação nova.
  //
  // ⚠️ O QUE ELE PASSA A PAGAR: `classificarIntencao`, MEDIDO em 849 ms de
  // p50 (bancada de 15/08). Continua sem `parseInbound` (2.659 ms de p50),
  // que segue abaixo — então o turno experimental continua mais rápido que o
  // Legacy, que paga os dois. Era a decisão C2, com esses números na mesa.

  // ══════════════════════════════════════════════════════════════════════
  // 3a-EXP. A PORTA AO LADO — AYLA EXPERIMENTAL (15/08/2026)
  // ══════════════════════════════════════════════════════════════════════
  //
  // ⚠️ ISTO NÃO SUBSTITUI NADA. Tudo o que vem depois continua exatamente como
  // estava, e é o CONTROLE do experimento. Só famílias na allowlist explícita
  // entram aqui; qualquer outra segue o caminho de sempre.
  //
  // ⚠️ POR QUE AQUI, E NÃO ANTES NEM DEPOIS. Antes deste ponto ficam as
  // proteções que NÃO podem ser puladas por um experimento — identidade da
  // família, bloqueio/opt-out, criança escrevendo, idempotência do inbound,
  // controle de turno e o gate de assinatura. Depois deste ponto começa a
  // condução conversacional: classificador de intenção, parser, os portões de
  // rotina/plano/imprimível, o núcleo de `diretrizes.ts` e as lentes — que é
  // justamente o que o experimento quer PULAR.
  //
  // ⚠️ FAIL CLOSED EM DUAS CAMADAS. `ehFamiliaExperimental` devolve false em
  // qualquer dúvida (variável ausente, id fora da lista, erro de leitura), e
  // `responderExperimental` devolve null em qualquer falha — inclusive quando a
  // rede de fronteiras barra o texto. Nos dois casos o turno CAI para a Ayla
  // atual, e a família recebe UMA resposta só.
  if (ehFamiliaExperimental(family.id)) {
    const ctxExp = await loadFamiliaParaEnvio(supabase, family.id);
    const exp = ctxExp
      ? await responderExperimental(supabase, {
          familyId: family.id,
          mensagem: inbound.texto,
          // ⚠️ C2 · UM DONO PARA A DECISÃO. A classificação deste turno já
          // aconteceu acima; o experimental consome, nunca reclassifica.
          turnoClassificado,
        })
      : null;
    if (ctxExp && exp) {
      console.log(
        `[ayla:path] experimental — ${exp.metrica.consultasBanco} consultas · ${exp.metrica.chamadasLLM} LLM · ` +
          `in=${exp.metrica.tokensEntrada} out=${exp.metrica.tokensSaida} · ` +
          `contexto=${exp.metrica.msContexto}ms modelo=${exp.metrica.msModelo}ms ` +
          `inspecao=${exp.metrica.msInspecao}ms total=${exp.metrica.msTotal}ms`,
      );
      const resp = await enviarEPersistir(supabase, {
        family_account_id: family.id,
        membro_atipico_id: exp.membroId,
        phone: ctxExp.whatsapp_e164,
        texto: exp.texto,
        category: "reativa",
        tipo: "resposta_registro",
        meta: { ayla_path: "experimental", ...exp.metrica },
      });
      // ⚠️ A PONTE DO PLANO CHEGA AO CAMINHO NOVO — 15/08/2026.
      //
      // É a MESMA função que o Legacy chama (`ponteDePlano`), com o mesmo
      // gerador por dentro. A resposta principal JÁ SAIU acima: a ponte
      // continua sendo a última bolha do turno, nunca a resposta.
      //
      // ⚠️ O DADO QUE SUBSTITUI O PARSER. `temDesafio` não decide plano nenhum
      // — é o freio barato de `montarPonteWhatsApp` (ver o comentário lá).
      // Aqui ele vem da classificação que este turno já fez, então o caminho
      // novo não paga `parseInbound` antes da resposta para ter isto.
      //
      // ⚠️ POR QUE `enviarEPersistir` E NÃO SÓ `enviarTexto`. O cooldown e a
      // janela de 20h da própria ponte procuram "/auth/wa" em `ayla_messages`.
      // Uma bolha enviada e não persistida deixaria o dedup cego, e a família
      // ganharia um plano por turno.
      if (resp.enviada) {
        // A ÂNCORA DA ENTREGA. Sem ela, a mensagem que entrega o Plano volta a
        // ser lida como uma OFERTA no turno seguinte, e o "Ok" da mãe gera
        // outro Plano (caso Matheo, 11/08/2026).
        let planoEntregueId: string | null = null;
        const nudge = await ponteDePlano(supabase, {
          familyId: family.id,
          membroId: exp.membroId,
          phone: ctxExp.whatsapp_e164,
          mensagem: inbound.texto,
          temDesafio:
            turnoClassificado.intencao === "plano" || Boolean(turnoClassificado.tema),
          aoEntregar: (id) => {
            planoEntregueId = id;
          },
        }).catch((e) => {
          console.warn(
            "[ayla:experimental] ponte do plano falhou:",
            e instanceof Error ? e.message : e,
          );
          return null;
        });
        if (nudge) {
          await enviarEPersistir(supabase, {
            family_account_id: family.id,
            membro_atipico_id: exp.membroId,
            phone: ctxExp.whatsapp_e164,
            texto: nudge,
            category: "reativa",
            tipo: "resposta_registro",
            meta: { ayla_path: "experimental", ponte: "plano" },
            // ⚠️ `metadataMensagem`, não `meta`: esta vai para
            // `ayla_messages.metadata`, que é onde `ofertaDePlanoPendente` lê.
            // `meta` iria só para o log de auditoria e não fecharia a oferta.
            ...(planoEntregueId ? { metadataMensagem: { plano_id: planoEntregueId } } : {}),
          });
        }
      }

      // ⚠️ APRENDER DEPOIS DE RESPONDER (Fase 1). `extrairESalvarEventos` tem
      // pré-filtro por regex e só chama modelo quando o texto PARECE trazer um
      // evento — e roda DEPOIS da bolha, então não entra no caminho crítico.
      // É a peça que faz o experimento deixar de ser amnésico.
      //
      if (exp.membroId) {
        await extrairESalvarEventos(
          supabase,
          family.id,
          exp.membroId,
          inbound.texto,
          undefined,
          // O nome sai do contexto que este turno JÁ carregou — nenhuma
          // consulta nova. Sem ele o extrator não sabe de quem é o registro.
          ctxExp.membros.find((m) => m.id === exp.membroId)?.nome ?? null,
        ).catch(() => {});
      }

      // ⚠️ FATIA 3 · O APRENDIZADO LONGITUDINAL VOLTA — DEPOIS DA RESPOSTA.
      //
      // Até 15/08/2026 este ramo só escrevia `eventos_membro`. Ficavam de fora
      // `diarios`, `ayla_daily_checkins` e `sugestao_perfil_vivos` — ou seja, a
      // auto-incorporação do Kolo Vivo, que é o mecanismo pelo qual o Perfil
      // cresce sozinho. Uma Ayla que conversa bem hoje e esquece amanhã não é a
      // Ayla que as famílias têm.
      //
      // O comentário antigo dizia que `persistirRegistro` não podia entrar
      // porque arrastaria `parseInbound` de volta. Estava certo sobre o
      // mecanismo e errado sobre a conclusão: o parser não pode entrar ANTES da
      // resposta. Aqui a bolha JÁ FOI ENVIADA — `enviarEPersistir` aconteceu
      // acima —, então a mãe não espera um milissegundo por isto.
      //
      // ⚠️ SEM `await`. O turno retorna e a persistência segue. Se ela falhar, a
      // conversa já aconteceu; o custo é um aprendizado perdido, não um silêncio.
      // O `console.warn` é o que torna essa perda visível — sem ele, dado
      // sumindo em silêncio é exatamente o defeito que este repositório mais
      // paga caro.
      //
      // ⚠️ ISOLAMENTO. `family.id` e o membro vêm do contexto JÁ resolvido deste
      // turno; `persistirRegistro` sai cedo quando não há membro. Nada aqui
      // escolhe criança por palpite.
      void (async () => {
        try {
          const membrosDoTurno = ctxExp.membros.map((m) => ({ id: m.id, nome: m.nome ?? "" }));
          if (membrosDoTurno.length === 0) return;
          const parsedExp = await parseInbound(
            {
              texto: inbound.texto,
              membros: membrosDoTurno,
              ultimoMembroFoco:
                ctxExp.membros.find((m) => m.id === exp.membroId)?.nome ?? null,
            },
            { supabase, family_account_id: family.id, feature: "ayla_parser_pos" },
          );
          // Família com uma criança só: se o parser não cravou, é a única
          // possível. Mesma regra do Legacy, e pelo mesmo motivo.
          if (membrosDoTurno.length === 1 && !parsedExp.membro_atipico_id) {
            parsedExp.membro_atipico_id = membrosDoTurno[0].id;
            parsedExp.confianca_identificacao = 100;
          }
          // ⚠️ O FOCO DO TURNO MANDA. Se a resposta foi carimbada para uma
          // criança, o registro é dela — o parser não pode filar conteúdo em
          // outro irmão depois de a resposta já ter saído.
          if (exp.membroId) parsedExp.membro_atipico_id = exp.membroId;
          await persistirRegistro(supabase, family.id, parsedExp);
        } catch (e) {
          console.warn(
            "[ayla:experimental] persistência pós-resposta falhou:",
            e instanceof Error ? e.message : e,
          );
        }
      })();

      // ⚠️ O `return` É O QUE GARANTE UMA RESPOSTA SÓ. Sem ele, o turno seguiria
      // para a Ayla atual e a família receberia duas.
      return { tratada: true, familia: family.id, resposta: resp };
    }
    console.log("[ayla:path] experimental indisponível — seguindo pela Ayla atual");
  }

  // 4. Parser IA
  //
  // ⚠️ AS TRÊS LEITURAS QUE ALIMENTAM O PARSER, EM PARALELO (13/08/2026,
  // PEND-064). Contexto da família, último check-in e histórico não dependem
  // um do outro: os três só precisam de `family.id`. Em fila custavam três
  // idas ao banco; juntos custam uma. `loadFamiliaParaEnvio` já era um
  // `Promise.all` de três consultas por dentro — este é o mesmo padrão, um
  // nível acima.
  //
  // O histórico vem do leitor do turno: se o classificador de intenção já o
  // leu, aqui não custa nada.
  const [ctx, { data: ultimoCheckin }, historicoParser] = await Promise.all([
    loadFamiliaParaEnvio(supabase, family.id),
    supabase
      .from("ayla_daily_checkins")
      .select("membro_atipico_id, membros_atipicos(nome)")
      .eq("family_account_id", family.id)
      .order("created_at", { ascending: false })
      .limit(1),
    // Histórico da conversa PRO PARSER: respostas curtas ("letra f", "adora
    // dançar") só viram fato se ele entender o contexto. Sem recorte de
    // membro, DE PROPÓSITO: é este parser que descobre de quem a mensagem
    // fala — filtrar aqui seria circular. O recorte acontece onde o dano é
    // permanente: na ESCRITA do Kolo Vivo.
    historicoDoTurno().then((bruto) =>
      carregarHistorico(supabase, family.id, inbound.texto, null, undefined, bruto),
    ),
  ]);
  if (!ctx) return { tratada: true, familia: family.id };

  // Último membro foco (pra desambiguar pronome em famílias 2+)
  const ultimoNome = ultimoCheckin?.[0]
    ? Array.isArray(ultimoCheckin[0].membros_atipicos)
      ? ultimoCheckin[0].membros_atipicos[0]?.nome
      : (ultimoCheckin[0].membros_atipicos as { nome: string } | null)?.nome
    : null;
  const ultimoMembroId = (ultimoCheckin?.[0]?.membro_atipico_id as string | null) ?? null;

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

  // DE QUEM É CADA FALA. O inbound é gravado antes de sabermos o membro (a
  // trava de idempotência precisa vir primeiro), então a atribuição acontece
  // aqui, assim que ele é resolvido. Sem isto o histórico volta sem dono e
  // observação de um irmão vira fato sobre o outro — o caso Mario→Manu.
  const nomePorMembro = new Map(ctx.membros.map((m) => [m.id, m.nome]));
  if (membroContextoId && inbound.messageId) {
    await supabase
      .from("ayla_messages")
      .update({ membro_atipico_id: membroContextoId })
      .eq("zaap_message_id", inbound.messageId)
      .then(undefined, () => {});
  }

  const membroFoco = membroContextoId
    ? (ctx.membros.find((m) => m.id === membroContextoId) ?? null)
    : null;
  const nomeMembro = membroFoco?.nome ?? null;
  const idadeFoco = idadeAnos(membroFoco?.data_nascimento ?? null);
  // Loaders independentes em paralelo (antes eram 3 idas ao banco em fila,
  // logo antes da chamada mais cara — a voz). O magic link do Lúdico (só
  // criança) vem junto, pra Ayla mandar se pedirem história/rotina/desenho.
  const ehCrianca = idadeFoco != null && idadeFoco <= 12;
  // PEDIDO DE PLANO NÃO RECEBE OS LINKS DO LÚDICO. Eles não têm relação com o
  // Plano — e num caso real (03/08/2026) o modelo, sem um link de plano na
  // mão, colou o do Relatório pra professora. Quem entrega o Plano é a ponte,
  // com o link de /planos/{id}. De quebra, param de nascer 5 tokens por turno
  // que ninguém vai usar.
  const pedidoDePlano = pedeUmPlano(inbound.texto);
  const ofereceLudico = ehCrianca && !pedidoDePlano;
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
    carregarEstrategiasRecentes(supabase, family.id, membroContextoId),
    carregarHistorico(
      supabase,
      family.id,
      inbound.texto,
      membroContextoId,
      nomePorMembro,
      await historicoDoTurno(),
    ),
    ofereceLudico ? gerarMagicLink(supabase, { familyId: family.id, next: "/historias/criar" }) : Promise.resolve(null),
    ofereceLudico
      ? gerarMagicLink(supabase, { familyId: family.id, next: "/ludico/rotinas/semana" })
      : Promise.resolve(null),
    ofereceLudico ? gerarMagicLink(supabase, { familyId: family.id, next: "/ludico/desenhos" }) : Promise.resolve(null),
    ofereceLudico
      ? gerarMagicLink(supabase, { familyId: family.id, next: "/configuracoes/avatar" })
      : Promise.resolve(null),
    ofereceLudico ? gerarMagicLink(supabase, { familyId: family.id, next: "/evolucao/relatorio" }) : Promise.resolve(null),
  ]);
  const linksLudico = ofereceLudico
    ? { historia: linkHistoria, rotina: linkRotina, desenho: linkDesenho, avatar: linkAvatar, relatorio: linkRelatorio }
    : null;

  // REPERTÓRIO — a Camada 2 chegando ao WhatsApp pela primeira vez. A skill já
  // veio do classificador (4º campo, sem chamada extra); aqui só se busca o
  // conteúdo. Falha silenciosa: sem repertório, a conversa segue como sempre.
  // RASTRO: registra o que foi consultado e o que chegou ao prompt. Não muda
  // nada do que é escolhido nem do que é enviado — só deixa de ser invisível.
  //
  // ⚠️ FASE 4A · 10/08/2026. Até aqui esta chamada era deliberadamente CRUA — o
  // teste 7 de `piloto.test.ts` mordia se alguém passasse `relato`, e o motivo
  // era bom: em 4A.1 o ranking ainda não tinha sido medido, e ligá-lo no
  // WhatsApp sem medição teria escondido a causa de qualquer mudança. A medição
  // aconteceu (bancada de 09/08, `docs/bancada/4a1-ranking-2026-08-09.txt`), e a
  // decisão mudou. O teste mudou junto, e continua mordendo — agora garantindo
  // que os parâmetros só entrem DENTRO do piloto.
  const noPiloto4A = pilotoQuatroA(family.id);
  let erroNaConsulta = false;
  const bpsRecuperadas = await recuperarBoasPraticas({
    supabase,
    skills: turnoClassificado.skills,
    idade: idadeFoco,
    // Fora do piloto os três são `undefined`, e o recuperador volta a escolher
    // 3 por peso — byte a byte o que este canal sempre recebeu.
    relato: noPiloto4A ? inbound.texto : undefined,
    statusAceitos: noPiloto4A ? ["ativo", "rascunho"] : undefined,
    limite: noPiloto4A ? 2 : undefined,
    aoFalhar: () => {
      erroNaConsulta = true;
    },
  });
  const repertorio = blocoBoasPraticas(bpsRecuperadas);

  // PERFIL CONSULTÁVEL e BASE 2 — as duas leituras que faltavam a este canal.
  // Leituras ACESSÓRIAS: se falharem, a conversa segue sem elas. O que não pode
  // é derrubar o turno por causa de um enriquecimento.
  const perfilConsultavel4A =
    noPiloto4A && membroContextoId
      ? await carregarPerfilConsultavel(supabase, {
          membroId: membroContextoId,
          familyId: family.id,
        }).catch(() => null)
      : null;
  const temaBase2 = turnoClassificado.skills[0] ?? null;
  const base2Secoes =
    noPiloto4A && temaBase2 && temMaterial(temaBase2)
      ? secoesDe({ tema: temaBase2, estado: "investigacao", limite: 3 })
      : [];
  void registrarRastroConhecimento(
    montarRastro({
      canal: "whatsapp",
      familyId: family.id,
      membroId: membroContextoId,
      skills: turnoClassificado.skills,
      // O WhatsApp não manda tags: o classificador devolve só nomes de skill.
      // Registrar o zero é o que torna a assimetria com a web mensurável.
      tags: 0,
      idade: idadeFoco,
      recuperadas: bpsRecuperadas,
      // O bloco leva tudo o que foi recuperado; vazio quando não há bloco.
      enviadas: repertorio ? bpsRecuperadas : [],
      erroNaConsulta,
    }),
  );

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
      diagnosticoRegistrado: membroFoco
        ? blocoDiagnosticoRegistrado(
            membroFoco.diagnosticos_formais,
            membroFoco.perfil,
            membroFoco.nome,
          )
        : null,
      generoMembro: membroFoco?.genero ?? null,
      temaAtivo,
      intencao: intent,
      aceite,
      notaDeSeguranca: seguranca.aberta ? notaDeSeguranca({ precisaChecar: seguranca.precisaChecar }) : null,
      koloVivoResumo,
      koloVivoLacunas,
      estrategiasRecentes,
      historico,
      linksLudico,
      repertorio,
      // FASE 4A · vazios fora do piloto, e aí o prompt sai idêntico ao de antes.
      piloto4A: noPiloto4A,
      perfilConsultavel: perfilConsultavel4A,
      base2: base2Secoes,
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
  // ⚠️ RECORTE POR MEMBRO ANTES DE ESCREVER. Daqui sai evento no Kolo Vivo, e
  // evento fica: "se concentra melhor com as mãos ocupadas" era do Mario e
  // virou fato da Manu (07/08/2026). Sai o que se SABE ser de outro filho;
  // turno sem dono continua entrando, senão a família perderia todo o acervo
  // anterior a esta correção (o inbound nunca gravava membro). Ver
  // `membro-escopo.ts` — a decisão de não confiar em janela de tempo.
  const historicoDoMembro = semOutrosMembros(historicoParser, membroContextoId);
  // ⚠️ O NOME VAI JUNTO. Recortar o histórico por membro (acima) impede que a
  // fala de um irmão vire contexto do outro; não impede que a MENSAGEM DE AGORA
  // fale de outra pessoa. PROVEI que "o irmão dela, João, começou a andar"
  // virava marco da Ana em 3/3. Quem separa é o extrator saber de quem é a
  // linha do tempo — e `nomePorMembro` já está montado neste turno.
  await extrairESalvarEventos(
    supabase,
    family.id,
    membroContextoId,
    inbound.texto,
    historicoDoMembro,
    membroContextoId ? (nomePorMembro.get(membroContextoId) ?? null) : null,
  );

  return { tratada: true, familia: family.id, resposta: resp };
}

/**
 * A PONTE DO PLANO — UM DONO SÓ, PARA OS DOIS CAMINHOS DE PUBLICAÇÃO.
 *
 * ⚠️ POR QUE ELA EXISTE (15/08/2026). Este bloco vivia DENTRO de
 * `enviarRespostaEmChunks`, que é chamada num único lugar: o caminho Legacy. O
 * ramo experimental publica por `enviarEPersistir` — outra função —, então a
 * família do experimento conversava e NUNCA recebia um plano. Não era ordem de
 * blocos: era outro caminho de publicação.
 *
 * O que NÃO muda por isto: a ponte continua sendo FOLLOW-UP da resposta
 * principal (nunca a substitui), o gerador continua sendo um só
 * (`montarPonteWhatsApp`), e nenhuma chamada de modelo nova entra no turno —
 * `pedeUmPlano` é regex pura e `ofertouPlanoRecente` é uma consulta, só
 * disparada quando a mensagem é um "sim" curto.
 *
 * `querPlano` chega pronto no Legacy porque lá ele é calculado ANTES da
 * geração: ele também encurta a resposta no chat (`RespostaParams.querPlano`).
 * Quem não precisa disso omite, e a decisão é tomada aqui.
 */
async function ponteDePlano(
  supabase: SupabaseClient,
  args: {
    familyId: string;
    membroId: string | null;
    phone: string;
    mensagem: string;
    /**
     * ⚠️ NÃO É INSUMO DE DECISÃO. `temDesafio` aparece uma vez só dentro de
     * `montarPonteWhatsApp`: um freio barato (mensagem < 40 caracteres e sem
     * desafio sai antes de gastar IA). Com pedido explícito nem é lido. Por
     * isso o caminho novo pode alimentá-lo com a classificação do turno, sem
     * arrastar o parser de volta para antes da resposta.
     */
    temDesafio: boolean;
    querPlano?: boolean;
    /** Repassa a âncora da entrega pra quem vai persistir a mensagem. */
    aoEntregar?: (planoId: string) => void;
  },
): Promise<string | null> {
  const querPlano =
    args.querPlano ??
    (pedeUmPlano(args.mensagem) ||
      // ⚠️ `ofertaDePlanoPendente`, não `ofertouPlanoRecente`: a segunda
      // perguntava ao TEXTO se havia oferta, e o texto da própria entrega
      // respondia que sim. Ver o caso Matheo no comentário da função.
      (ehAfirmacaoCurta(args.mensagem) &&
        (await ofertaDePlanoPendente(supabase, args.familyId, args.membroId))));
  console.log(
    `[ayla:ponte] avaliando — querPlano=${querPlano} temDesafio=${args.temDesafio}`,
  );
  const nudge = await montarPonteWhatsApp(supabase, {
    familyId: args.familyId,
    membroAtipicoId: args.membroId,
    mensagem: args.mensagem,
    temDesafio: args.temDesafio,
    phoneE164: args.phone,
    // Pedido explícito de plano: fura o dedup/intenção e entrega na hora.
    forcar: querPlano,
    aoEntregar: args.aoEntregar,
  });
  return nudge;
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
  // VERDADE OPERACIONAL (06/08/2026). Um turno da Ayla vira VÁRIAS bolhas no
  // WhatsApp e UM registro em `ayla_messages` — então guardamos o id de cada
  // bolha, não só o da última. Antes isto era `messageId = "unknown"` e nada
  // disso chegava ao banco: na conversa da Vitória, 27 de 27 mensagens de saída
  // ficaram com `zaap_message_id` nulo, e por isso a Ayla pôde dizer "Chegou!"
  // sem ter como saber.
  const idsBolhas: Array<string | null> = [];
  let erro: string | null = null;
  /** Id do Plano que a ponte entregou neste turno — a âncora que fecha a oferta. */
  let planoEntregueId: string | null = null;

  // A pessoa pediu um plano? Então a Ayla NÃO escreve o plano no chat — dá uma
  // resposta curta e o sistema entrega o plano (PDF + link). Vale tanto pro pedido
  // EXPLÍCITO quanto pro "sim" curto logo depois de a Ayla OFERECER um plano (1c).
  const querPlano =
    pedeUmPlano(args.params.mensagem) ||
    // ⚠️ Mesma troca do outro ponto de uso: quem responde "há oferta pendente?"
    // deixou de ser o texto da própria entrega. Ver o caso Matheo.
    (ehAfirmacaoCurta(args.params.mensagem) &&
      (await ofertaDePlanoPendente(
        supabase,
        args.family_account_id,
        args.membro_atipico_id,
      )));
  args.params.querPlano = querPlano;

  // ⚠️ O BALÃO DE ESPERA FOI DESLIGADO em 03/08/2026.
  //
  // `agendarEspera` mandava dois balões, aos 2,8 s e 7,5 s, pra cobrir o
  // silêncio da geração ("Deixa eu pensar nisso com você 🌿", "Tô montando
  // aqui, já te mando 🌿"). A intenção era boa e a medição de latência que
  // escolheu os tempos estava certa. O efeito em produção não foi:
  //
  //   - apareceu em TRÊS testes reais seguidos, sempre as mesmas 8 frases —
  //     não é ocasional, é toda resposta que passa de 2,8 s;
  //   - dobra o número de bolhas de cada turno;
  //   - simula trabalho futuro, que é exatamente o que o CATÁLOGO proíbe
  //     ("nunca anuncie arquivo no futuro", "não prometa artefato");
  //   - e uma mãe que já mandou a pergunta não quer saber que a Ayla está
  //     pensando. Quer a resposta.
  //
  // A regra agora é simples: a PRIMEIRA bolha que a família recebe já tem
  // conteúdo útil. Silêncio honesto é melhor que ruído de sala de espera.
  //
  // `espera.ts` continua no repositório, sem uso, com seus testes — remover o
  // módulo agora só aumentaria o diff sem ganho. Se o silêncio se provar um
  // problema real, a saída é reduzir a latência, não fingir conversa.

  // GERAÇÃO — buffer completo, com a rede da fronteira por dentro. Nada saiu
  // para o WhatsApp até aqui.
  let textoCompleto = await gerarRespostaAyla(args.params, {
    supabase,
    family_account_id: args.family_account_id,
    feature: "ayla_responder",
  });

  // ── ABRE OU FECHA O ESTADO DE SEGURANÇA ────────────────────────────────
  // Duas condições pra ABRIR, e as duas precisam ser verdadeiras:
  //   1. a resposta orientou emergência (CVV/SAMU/CAPS) — determinístico;
  //   2. o risco é ATUAL, não histórico — classificador.
  // Só a primeira não basta: a Ayla cita CVV ao falar de um fato de 5 anos
  // atrás, e isso não pode abrir estado. Só a segunda também não: sem a
  // primeira, o classificador rodaria em toda mensagem, de graça.
  //
  // Pra FECHAR, só serve a família confirmar que conseguiu atendimento. Mudar
  // de assunto não fecha — foi exatamente assim que a conversa da Adelly
  // voltou a ser comum cinco minutos depois da crise.
  let tipoFinal: AylaTipoReativa = args.tipo;
  const conversaCurta = args.params.historico
    .map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`)
    .join("\n");

  if (args.params.notaDeSeguranca) {
    // Estado já aberto: só a confirmação de atendimento encerra.
    const fim = await segurancaFoiEncaminhada({ mensagem: args.params.mensagem, conversa: conversaCurta });
    console.log(`[ayla:seguranca] encerrar? ${fim.encaminhada} — ${fim.motivo}`);
    tipoFinal = fim.encaminhada ? "seguranca_encerrada" : "seguranca";
  } else if (respostaOrientouEmergencia(textoCompleto)) {
    const risco = await riscoEhAtual({ mensagem: args.params.mensagem, conversa: conversaCurta });
    console.log(`[ayla:seguranca] risco atual? ${risco.atual} — ${risco.motivo}`);
    if (risco.atual) tipoFinal = "seguranca";
  }
  args.tipo = tipoFinal;

  // PUBLICAÇÃO — só agora, e só do texto aprovado. As bolhas e o ritmo são os
  // mesmos de antes: o efeito "digitando" nunca veio do streaming, vem do
  // delaySegundos por bolha.
  // RITMO COM TETO. A fórmula antiga somava 13-14 s numa resposta de 3 bolhas —
  // mais que o pipeline inteiro. Ver `ritmoDasBolhas`. O orçamento é comum a
  // estas bolhas E ao link do plano, logo abaixo: os dois saem da mesma conta.
  // ⚠️ APRESENTAÇÃO ANTES DA ENTREGA. `paraWhatsApp` é o último ponto em que o
  // texto ainda é um texto só — depois dele já são balões, e consertar balão é
  // consertar tarde. Ela normaliza SÓ marcação: medida em 3.471 balões reais
  // (23/05→15/08), preservou palavras, URLs, números e emojis em 3.471/3.471,
  // e mudaria 36 mensagens (1,04%) — as que hoje chegam com `**hoje**` e `---`
  // visíveis para a mãe. Ver `apresentacao.ts` e a bancada do replay.
  const bolhas = dividirEmBolhas(paraWhatsApp(textoCompleto));
  const ritmo = ritmoDasBolhas(bolhas);
  let esperaGasta = ritmo.reduce((a, b) => a + b, 0);
  for (const [i, par] of bolhas.entries()) {
    const delay = ritmo[i];
    try {
      const r = await enviarTexto({ phoneE164: args.phone, texto: par, delaySegundos: delay });
      providerResp = r.raw;
      idsBolhas.push(r.messageId);
    } catch (e) {
      erro = e instanceof Error ? e.message : "falha no envio";
      break;
    }
  }

  const enviada = erro == null;

  // Ponte WhatsApp → app (Fase 3): num desafio de verdade, manda um
  // magic-link que abre o plano completo no app, já logado. Numa crise /
  // desabafo / dúvida (ou clarificação de membro) não manda — a própria
  // ponte filtra por intenção. Falha silenciosa: nunca quebra a resposta.
  console.log(
    `[ayla:ponte] avaliando — tipo=${args.tipo} enviada=${enviada} querPlano=${querPlano} temDesafio=${Boolean(args.params.sinais.desafio)}`,
  );
  // PEDIU ROTINA → RECEBE ROTINA. A ponte do plano só entra em conversa comum;
  // quem acabou de receber uma rotina não pode ganhar um plano por cima.
  if (enviada && args.tipo === "resposta_registro" && !args.params.notaDeSeguranca) {
    const nudge = await ponteDePlano(supabase, {
      familyId: args.family_account_id,
      membroId: args.membro_atipico_id,
      phone: args.phone,
      mensagem: args.params.mensagem,
      temDesafio: Boolean(args.params.sinais.desafio),
      // Já calculado lá em cima: aqui ele não pode ser recalculado, porque a
      // resposta que acabou de sair foi encurtada com base nele.
      querPlano,
      // ⚠️ NO LEGACY A PONTE NÃO TEM LINHA PRÓPRIA — ela é concatenada em
      // `textoCompleto` e persistida junto da resposta principal, lá embaixo.
      // Então a âncora vai no `metadata` DAQUELA linha, que é a que existe.
      aoEntregar: (id) => {
        planoEntregueId = id;
      },
    });
    if (nudge) {
      try {
        // O link do plano é a última bolha do turno, e antes custava 3 s fixos
        // POR CIMA das outras. Entra no mesmo orçamento: se a resposta já
        // consumiu o teto, ele sai sem espera.
        const delayNudge = Math.min(1, Math.max(0, TETO_ESPERA_SEGUNDOS - esperaGasta));
        esperaGasta += delayNudge;
        const r = await enviarTexto({ phoneE164: args.phone, texto: nudge, delaySegundos: delayNudge });
        idsBolhas.push(r.messageId);
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
      ...registroDeEnvio(idsBolhas),
      // A ÂNCORA DA ENTREGA DO PLANO — é ela que faz o "Ok" da mãe no turno
      // seguinte NÃO gerar outro Plano (`ofertaDePlanoPendente` lê este campo).
      ...(planoEntregueId ? { metadata: { plano_id: planoEntregueId } } : {}),
    });
    await supabase
      .from("ayla_preferences")
      .update({ ultima_mensagem_em: new Date().toISOString() })
      .eq("family_account_id", args.family_account_id);
    return { enviada: true, messageId: idsBolhas.find(Boolean) ?? null };
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
  //
  // ⚠️ A ESCRITA CONFERE O PRÓPRIO RESULTADO (§7). Sem isto, esta chamada
  // devolveu **400 em toda execução desde 0001** e ninguém soube: o
  // `onConflict` de três colunas não tinha constraint que casasse no banco
  // (42P10), o `error` era descartado e o fluxo seguia como sucesso. Medido em
  // 15/08/2026: a tabela tinha ZERO linhas na história inteira do produto. A
  // constraint chegou na 0078; a conferência chega aqui, para que a próxima
  // falha deste tipo não precise de uma auditoria da Vercel para aparecer.
  const { error: erroCheckin } = await supabase.from("ayla_daily_checkins").upsert(
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
  if (erroCheckin) {
    // Não derruba o turno: a mãe já recebeu a resposta, e perder o registro
    // não justifica perder a conversa. Mas deixa de ser invisível.
    await logEvent({
      kind: "checkin_nao_gravou",
      severity: "error",
      family_account_id: familyId,
      message: `ayla_daily_checkins não gravou: ${erroCheckin.message.slice(0, 200)}`,
      payload: {
        membro_atipico_id: p.membro_atipico_id,
        code: (erroCheckin as { code?: string }).code ?? null,
        motivo: erroCheckin.message.slice(0, 400),
      },
    });
  }

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

/**
 * O RECADO DO VÍDEO — fixo, e fixo de propósito.
 *
 * Ele diz três coisas, nesta ordem, e as três importam: **recebi** (a mãe não
 * fica sem saber se chegou), **não consigo assistir** (sem rodeio e sem
 * prometer para depois — o CATÁLOGO proíbe anunciar trabalho futuro), e **me
 * conta que eu penso com você** (a conversa continua, em vez de terminar num
 * "não posso").
 *
 * Não passa por modelo: é a mesma frase toda vez, para todo mundo. Famílias
 * es/en recebem no idioma delas pelo choke point de tradução que já existe em
 * `enviarEPersistir` — para PT não há chamada nenhuma.
 */
const TEXTO_VIDEO_SEM_TEXTO =
  "Recebi seu vídeo 💛 Eu ainda não consigo assistir ao vídeo por aqui. Me conta o que você quer que eu observe nele — pode escrever ou mandar um áudio. Aí eu penso nisso com você.";

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

/** Frases que caracterizam uma OFERTA de plano feita pela Ayla. Inclui a
 *  nomenclatura nova ("plano estratégico com atividades"), que existe pra a mãe
 *  não confundir o material com plano de ASSINATURA.
 *
 *  ⚠️ ELA NÃO DISTINGUE OFERTA DE ENTREGA, e não é ela que precisa distinguir.
 *  "Montei um plano estratégico com atividades" — o texto FIXO da entrega, em
 *  `ponte.ts` — casa aqui. Quem separa os dois estados é a âncora estrutural,
 *  abaixo. */
const REGEX_OFERTA_PLANO =
  /monte(i)? um plano|montar (um |esse |o )?plano|junte.*plano|plano (completo|estrat[ée]gico)|um plano (completo|estrat[ée]gico|com|pra|sobre)/;

/**
 * Quantas mensagens de saída entram na janela de 30 min.
 *
 * ⚠️ ERA 6, e 6 bastava enquanto a pergunta era "existe alguma oferta aqui?".
 * Agora a pergunta é sobre a ORDEM entre duas mensagens — a oferta e a entrega
 * que a cumpriu —, e as duas precisam caber na mesma leitura. Entre elas cabe
 * uma conversa inteira: no caso Matheo (11/08/2026) foram 6 balões em 4 min.
 */
const JANELA_OFERTA_MENSAGENS = 30;

type SaidaDaJanela = {
  texto: string | null;
  metadata: unknown;
  membro_atipico_id: string | null;
};

/**
 * ESTA MENSAGEM É UMA ENTREGA? — perguntado à âncora, não ao texto.
 *
 * `metadata.plano_id` é gravado só quando `montarPonteWhatsApp` avisou que um
 * Plano foi REALMENTE criado (callback `aoEntregar`). Mensagem com âncora
 * entregou um Plano; é fato registrado, não interpretação de fala.
 */
function ehEntregaDePlano(m: SaidaDaJanela): boolean {
  const meta = m.metadata as { plano_id?: unknown } | null | undefined;
  return typeof meta?.plano_id === "string" && meta.plano_id.length > 0;
}

/**
 * EXISTE UMA OFERTA DE PLANO AINDA NÃO CUMPRIDA? — o gatilho do "Ok".
 *
 * ⚠️ O CASO MATHEO (11/08/2026). A mãe recebeu o Plano, respondeu "Ok" e ganhou
 * outro — seis vezes em dois dias, quatro delas em nove minutos. A pergunta
 * antiga era "alguma das últimas 6 mensagens PARECE uma oferta?", e a mensagem
 * que ENTREGA o Plano parece. A entrega se reoferecia sozinha, para sempre.
 *
 * ⚠️ POR QUE NÃO SE RESOLVE POR TIMESTAMP. Comparar "última oferta" com "último
 * Plano" na tabela `planos` não funciona: a linha nasce dentro de `gerarPlano`,
 * e a mensagem que a anuncia só é persistida no fim do turno — ela vem DEPOIS.
 * O Plano que cumpriu a oferta é sempre mais VELHO que o texto que a
 * "reoferece", então a comparação diria "pendente" sempre.
 *
 * O que resolve é a ORDEM na própria timeline de saída, com os dois estados
 * marcados por naturezas diferentes: a oferta por TEXTO, a entrega por ÂNCORA.
 * Varrendo do mais novo para o mais velho, a primeira mensagem RELEVANTE
 * decide — e isso é exatamente "não há entrega depois da última oferta":
 *
 *   oferta ………………………………… pendente  → o "Ok" gera
 *   oferta → entrega ………… cumprida  → o "Ok" NÃO gera
 *   oferta → entrega → oferta  pendente  → a oferta NOVA vale por si
 *
 * ESCOPO: por criança quando o turno sabe de quem se fala, por família quando
 * não sabe. Mensagem sem dono entra nos dois casos — é o mesmo recorte que a
 * conversa já usa ("deste membro OU sem membro"), e sem ele as ofertas e
 * entregas com `membro_atipico_id` nulo sumiriam da janela.
 */
export async function ofertaDePlanoPendente(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string | null,
): Promise<boolean> {
  const desde = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  // Olha as ÚLTIMAS mensagens, não só a última. A Ayla responde em vários
  // balões e costuma continuar falando depois de oferecer; com limit(1) o "sim"
  // da mãe já chegava tarde demais e a oferta evaporava. Também cobre o caso
  // real: ela pergunta o preço, a Ayla esclarece, e só então ela aceita.
  const { data } = await supabase
    .from("ayla_messages")
    .select("texto, metadata, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("direcao", "outbound")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(JANELA_OFERTA_MENSAGENS);

  for (const m of (data ?? []) as SaidaDaJanela[]) {
    // Do irmão: não é oferta minha nem entrega minha. Sai da conta inteira.
    if (membroAtipicoId && m.membro_atipico_id && m.membro_atipico_id !== membroAtipicoId) {
      continue;
    }
    // A ÂNCORA VENCE O TEXTO, e é a inversão que corrige o caso Matheo: a
    // mensagem de entrega casa a regex, mas é entrega, e entrega fecha a oferta.
    if (ehEntregaDePlano(m)) return false;
    if (REGEX_OFERTA_PLANO.test((m.texto ?? "").toLowerCase())) return true;
  }
  return false;
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
    /** Confirmados + "Hipótese: X" — a distinção que a conversa não tinha. */
    diagnosticos_formais?: unknown;
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
      .select("id, nome, data_nascimento, perfil, genero, diagnosticos_formais")
      .eq("family_account_id", familyAccountId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!family || !family.whatsapp_e164) return null;
  return {
    family_account_id: familyAccountId,
    whatsapp_e164: family.whatsapp_e164,
    // Passa pelo detector: uma frase inteira no campo do nome ("Meu Nome e
    // Gisela Meu Filgo e Davi Ele e Autista") vira "" e a Ayla fala sem nome.
    nomeMae: primeiroNomeConfiavel(profile?.como_chamar) || primeiroNomeConfiavel(profile?.nome_mae),
    cuidador: descricaoCuidador({
      papel: (profile as { papel?: string | null } | null)?.papel ?? null,
      papelOutro: (profile as { papel_outro?: string | null } | null)?.papel_outro ?? null,
      genero: (profile as { genero_responsavel?: Genero } | null)?.genero_responsavel ?? null,
    }),
    membros: membros ?? [],
  };
}

/**
 * O QUE O SISTEMA SABE SOBRE O PRÓPRIO ENVIO — os campos de `ayla_messages` que
 * já existiam desde a 0001 e que ninguém preenchia (nenhuma migração aqui).
 *
 * ⚠️ LEIA ISTO ANTES DE USAR O DADO. `zaap_message_id` e `entrega.aceito_em`
 * provam UMA coisa: a Z-API respondeu 200 e devolveu um id. Não provam entrega
 * no aparelho, não provam recebimento e não provam leitura — status de entrega
 * viria de webhook, que não escutamos. Em telas, relatório ou prompt, isto se
 * chama "aceito pelo provedor". Chamar de "entregue" seria trocar um nulo
 * honesto por um número errado, que é o pior dos dois mundos.
 *
 * `zaap_message_id` recebe o id da PRIMEIRA bolha porque a coluna tem índice
 * único (0053, a trava de idempotência do inbound) e o turno tem uma linha só;
 * os demais ids ficam em `metadata.entrega.ids`, sem restrição de unicidade.
 * Nunca gravamos a string "unknown" ali: além de mentir, a segunda ocorrência
 * violaria o índice e derrubaria o registro inteiro da mensagem.
 */
function registroDeEnvio(ids: Array<string | null>): {
  zaap_message_id: string | null;
  metadata: Record<string, unknown>;
} {
  return {
    zaap_message_id: ids.find(Boolean) ?? null,
    metadata: {
      entrega: {
        canal: "z-api",
        // O nome do campo é o que ele prova. Não renomeie pra "entregue".
        aceito_pelo_provedor: ids.length > 0,
        aceito_em: new Date().toISOString(),
        bolhas: ids.length,
        ids,
      },
    },
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
    /**
     * Vai pro `ayla_messages.metadata` — estado que a PRÓXIMA mensagem precisa
     * ler. É onde a clarificação guarda o pedido que a originou, pra resposta
     * da mãe retomar o fluxo em vez de virar assunto novo.
     */
    metadataMensagem?: Record<string, unknown>;
  },
): Promise<EnvioResultado> {
  // Idioma da família: todo texto proativo/template é gerado em PT; se a
  // família é es/en, traduz AQUI (choke point único) antes de enviar. PT não
  // passa pela tradução — zero custo/latência. A conversa reativa não usa esta
  // função (já sai no idioma de quem escreve).
  // Nome ausente deixa cicatriz ("Oi, 🌿", "Tô com você, ."). Vários textos
  // proativos são montados à mão aqui no orchestrator, fora do fill() dos
  // templates — então a limpeza mora também neste choke point.
  // CADENCIA — so proativa, e antes de qualquer coisa cara (traducao, envio).
  // Resposta a mae NUNCA passa por aqui: a trava le `category` e sai.
  // Ver lib/ayla/cadencia.ts pro caso real (08:00 + 08:01) e pra concorrencia.
  let reservaId: string | null = null;
  if (params.category === "proativa" && !proativaIsentaDeCadencia(params.tipo)) {
    const reserva = await reservarEnvioProativo(supabase, {
      familyAccountId: params.family_account_id,
      tipo: params.tipo,
    });
    if (!reserva.ok) {
      await logEvent({
        kind: "ayla_proativa_bloqueada_por_cadencia",
        severity: "info",
        family_account_id: params.family_account_id,
        payload: { tipo: params.tipo, motivo: reserva.motivo },
      }).catch(() => {});
      return { enviada: false, motivo: reserva.motivo };
    }
    reservaId = reserva.reservaId || null;
  }

  let texto = limparNomeAusente(params.texto);
  const idioma = await idiomaDaFamilia(supabase, params.family_account_id);
  if (idioma !== "pt") texto = limparNomeAusente(await traduzirProativa(texto, idioma));

  let resultado: EnvioResultado;
  let providerResp: unknown = null;
  let erro: string | null = null;
  const idsBolhas: Array<string | null> = [];

  try {
    const r = await enviarTexto({ phoneE164: params.phone, texto });
    providerResp = r.raw;
    idsBolhas.push(r.messageId);
    resultado = { enviada: true, messageId: r.messageId };
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha desconhecida";
    resultado = { enviada: false, motivo: erro };
  }

  // Auditoria. Com reserva, a linha JA existe (foi ela que garantiu a janela) —
  // atualiza. Sem reserva (reativa, isenta, ou banco fora), insere como antes.
  const auditoria = {
    family_account_id: params.family_account_id,
    template_key: params.tipo,
    payload: {
      phone: params.phone,
      texto,
      ...(params.meta ? { meta: params.meta } : {}),
    },
    resposta_provider: providerResp as Record<string, unknown> | null,
    status: resultado.enviada ? "enviada" : ("falha" as const),
    erro,
  };
  if (reservaId) {
    await supabase.from("ayla_send_log").update(auditoria).eq("id", reservaId);
  } else {
    await supabase.from("ayla_send_log").insert(auditoria);
  }

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
      ...(params.metadataMensagem ? { metadata: params.metadataMensagem } : {}),
      ...registroDeEnvio(idsBolhas),
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
    // TEMAS é a fonte única. O mapa manual daqui tinha 9 das 15 chaves: a
    // família marcava "escola" ou "aprendizado" no cadastro, o onboarding
    // gravava, e a Ayla no WhatsApp não lia. Agora lê tudo que existe.
    for (const t of TEMAS) {
      if (t.storage !== "extras") continue;
      const resumo = resumoCampoKV(extras[t.chave]);
      if (resumo) linhas.push(`${t.rotulo}: ${resumo}`);
    }
  }
  return linhas.join("\n");
}

/**
 * Últimas perguntas que a mãe fez nas Estratégias (in-app), pra a Ayla
 * mostrar que acompanha os dois canais — não só o WhatsApp.
 */
/**
 * Os últimos títulos de Estratégia — servem pra Ayla não repetir o que já
 * entregou.
 *
 * ⚠️ É dado de UMA criança, não da família: uma Estratégia é gerada para um
 * membro, e `conversas.membro_atipico_id` guarda qual. Sem o recorte, a Ayla
 * evitava repetir pra Manu um plano que tinha dado pro Mario — e o título do
 * irmão entrava no prompt como se fosse coisa dela.
 *
 * O recorte vai na CONSULTA, não depois: com `.limit(3)` antes do filtro, três
 * planos recentes do irmão apagariam as Estratégias da criança da vez.
 * Registro antigo sem membro continua entrando — ver `membro-escopo.ts`.
 */
async function carregarEstrategiasRecentes(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId?: string | null,
): Promise<string[]> {
  let q = supabase
    .from("conversas")
    .select("titulo, created_at")
    .eq("family_account_id", familyId);
  if (membroAtipicoId) {
    q = q.or(`membro_atipico_id.eq.${membroAtipicoId},membro_atipico_id.is.null`);
  }
  const { data } = await q
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
/**
 * As duas últimas falas — o carregador do TEMA ATIVO entre uma mensagem e a
 * seguinte. Sem isso o classificador trata cada mensagem isoladamente e "e de
 * manhã?" vira tema nenhum, logo depois da mãe ter escolhido alimentação.
 */
async function ultimasFalas(
  supabase: SupabaseClient,
  familyId: string,
  mensagemAtual: string,
  brutoDoTurno?: LinhaDeHistorico[],
): Promise<{ ultimaMae: string | null; ultimaAyla: string | null }> {
  try {
    const h = await carregarHistorico(supabase, familyId, mensagemAtual, null, undefined, brutoDoTurno);
    return {
      ultimaMae: [...h].reverse().find((t) => t.de === "mae")?.texto ?? null,
      ultimaAyla: [...h].reverse().find((t) => t.de === "ayla")?.texto ?? null,
    };
  } catch {
    return { ultimaMae: null, ultimaAyla: null };
  }
}

/**
 * Os desafios que a família marcou no cadastro. São as chaves de TEMAS — é daí
 * que o tema ativo costuma nascer na primeira conversa, porque a introdução
 * oferece exatamente esses e a mãe escolhe um.
 */
async function carregarDesafiosOnboarding(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<string[]> {
  if (!membroId) return [];
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const extras = data?.categorias_extras as { desafios_onboarding?: string[] } | null;
    return (extras?.desafios_onboarding ?? []).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * O HISTÓRICO, COM DE QUEM É CADA FALA.
 *
 * ⚠️ POR QUE `sobre` EXISTE (07/08/2026, conversa real): a mãe contou que o
 * MARIO presta mais atenção com algo nas mãos, depois escreveu "A Manu começa a
 * lição mas 5 min depois já quer fazer outra coisa" — e a Ayla respondeu sobre
 * a Manu dizendo "como ela já mostrou que se concentra melhor quando as mãos
 * estão ocupadas".
 *
 * A causa não era o modelo. Esta função selecionava `direcao, texto` e mais
 * nada: o histórico chegava como um fluxo único, sem dizer de qual filho era
 * cada frase, com `nomeMembro` = Manu no prompt. Tudo que a mãe tinha dito
 * virava, para o modelo, informação sobre a criança da vez.
 *
 * A coluna `membro_atipico_id` já existia em `ayla_messages`. Só não era lida.
 */
type LinhaDeHistorico = {
  direcao: string;
  texto: string | null;
  created_at: string;
  membro_atipico_id?: string | null;
};

/**
 * A CONSULTA, sozinha — as 9 últimas falas da família.
 *
 * ⚠️ SEPARADA DE `carregarHistorico` (13/08/2026, PEND-064) porque MEDIMOS que
 * ela rodava TRÊS VEZES no mesmo turno, idêntica: uma dentro de `ultimasFalas`
 * (para o classificador de intenção), uma para o parser e uma nos loaders
 * paralelos. A consulta não usa `membroFocoId` nem `nomePorMembro` — esses só
 * entram na formatação —, então as três traziam exatamente as mesmas linhas.
 *
 * A ~400 ms por ida ao banco, eram ~800 ms jogados fora em todo turno.
 */
async function lerHistoricoBruto(
  supabase: SupabaseClient,
  familyId: string,
): Promise<LinhaDeHistorico[]> {
  const { data } = await supabase
    .from("ayla_messages")
    .select("direcao, texto, created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .order("created_at", { ascending: false })
    .limit(9);
  return (data ?? []) as LinhaDeHistorico[];
}

async function carregarHistorico(
  supabase: SupabaseClient,
  familyId: string,
  mensagemAtual: string,
  membroFocoId?: string | null,
  nomePorMembro?: Map<string, string>,
  // `membro_atipico_id` volta em cada turno pra que quem ESCREVE fato possa
  // recortar depois, com o membro já resolvido — ver `extrairESalvarEventos`.
  /**
   * As linhas cruas já lidas NESTE TURNO, para não repetir a consulta.
   *
   * ⚠️ ESCOPO É TUDO. Isto não é cache: é um valor que o turno já tem na mão e
   * passa adiante. Nasce e morre dentro de UMA execução de `processInbound`,
   * amarrado a UM `family_account_id` — nunca um mapa global, que é como
   * contexto de uma família vaza para outra.
   */
  brutoDoTurno?: LinhaDeHistorico[],
): Promise<
  Array<{ de: "mae" | "ayla"; texto: string; sobre?: string; membro_atipico_id: string | null }>
> {
  const data = brutoDoTurno ?? (await lerHistoricoBruto(supabase, familyId));
  const turnos = (data ?? [])
    .reverse()
    .filter((m) => typeof m.texto === "string" && m.texto.trim())
    .map((m) => {
      const id = (m as { membro_atipico_id?: string | null }).membro_atipico_id ?? null;
      // Só marca quando o turno é sobre OUTRA criança. Marcar o membro da vez
      // em toda linha viraria ruído e ensinaria o modelo a repetir o nome.
      const sobre =
        id && membroFocoId && id !== membroFocoId ? nomePorMembro?.get(id) : undefined;
      return {
        de: (m.direcao === "inbound" ? "mae" : "ayla") as "mae" | "ayla",
        texto: m.texto as string,
        membro_atipico_id: id,
        ...(sobre ? { sobre } : {}),
      };
    });
  // Remove a própria mensagem recém-inserida do fim, pra não duplicar.
  if (turnos.length > 0) {
    const ultimo = turnos[turnos.length - 1];
    if (ultimo.de === "mae" && ultimo.texto.trim() === mensagemAtual.trim()) {
      turnos.pop();
    }
  }
  return turnos.slice(-6);
}
