import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/log";

/**
 * CONVERSA ATIVA — ADR 0001, seção 6.
 *
 * O problema: automação entrando no meio de uma conversa. Reengajamento,
 * lembrete, oferta — chegando por cima de uma pergunta que a mãe ainda estava
 * respondendo, e mudando o assunto.
 *
 * A causa: não existia o conceito. `interagiu`, em `mensagemEspontanea.ts`,
 * significa "já interagiu alguma vez", não "está conversando agora". E os ~16
 * tipos de cron não consultavam atividade nenhuma.
 *
 * A regra vive AQUI, num lugar só. Espalhar o critério por cada cron é como
 * isto começou.
 */

/** Depois deste silêncio, a conversa não está mais ativa. */
export const JANELA_CONVERSA_ATIVA_MIN = 30;

/**
 * Pergunta feita pela Ayla e ainda não respondida segura automação por mais
 * tempo: a mãe pode demorar a responder e a pergunta continua de pé.
 */
export const JANELA_PERGUNTA_PENDENTE_MIN = 180;

export type EstadoConversa = {
  ativa: boolean;
  /** Motivos que a mantêm ativa — para o log e para decidir adiar × descartar. */
  motivos: Array<"inbound_recente" | "turno_em_andamento" | "pergunta_pendente">;
  ultimaInboundEm: string | null;
};

/**
 * Estado atual da conversa de uma família.
 *
 * Falha segura: erro de banco devolve `ativa: true`. Na dúvida, NÃO
 * interrompe — o custo de adiar uma automação é zero; o de cortar uma conversa
 * real é o que estamos consertando.
 */
export async function avaliarEstadoDaConversa(
  supabase: SupabaseClient,
  familyId: string,
): Promise<EstadoConversa> {
  const motivos: EstadoConversa["motivos"] = [];
  let ultimaInboundEm: string | null = null;

  try {
    const desde = new Date(Date.now() - JANELA_CONVERSA_ATIVA_MIN * 60_000).toISOString();
    const { data: recentes } = await supabase
      .from("ayla_messages")
      .select("created_at, processada_em")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5);

    const linhas = recentes ?? [];
    if (linhas.length > 0) {
      motivos.push("inbound_recente");
      ultimaInboundEm = (linhas[0] as { created_at: string }).created_at;
    }
    // Inbound ainda não processada = turno em andamento (alguém está gerando).
    if (linhas.some((l) => (l as { processada_em: string | null }).processada_em == null)) {
      motivos.push("turno_em_andamento");
    }
  } catch {
    return { ativa: true, motivos: ["inbound_recente"], ultimaInboundEm: null };
  }

  try {
    const desdePergunta = new Date(
      Date.now() - JANELA_PERGUNTA_PENDENTE_MIN * 60_000,
    ).toISOString();
    // A última mensagem da conversa é da AYLA e termina em pergunta? Então ela
    // perguntou e ninguém respondeu — automação não passa por cima disso.
    const { data: ultimas } = await supabase
      .from("ayla_messages")
      .select("direcao, texto, created_at")
      .eq("family_account_id", familyId)
      .gte("created_at", desdePergunta)
      .order("created_at", { ascending: false })
      .limit(1);
    const ultima = (ultimas ?? [])[0] as
      | { direcao: string; texto: string | null }
      | undefined;
    if (ultima && ultima.direcao === "outbound" && /\?\s*$/.test((ultima.texto ?? "").trim())) {
      motivos.push("pergunta_pendente");
    }
  } catch {
    /* sem esta checagem, as outras seguem valendo */
  }

  return { ativa: motivos.length > 0, motivos, ultimaInboundEm };
}

// ============================================================
// Intenção de mensagem
// ============================================================

/**
 * O que uma automação produz. Ela NÃO publica: declara a intenção, e o gate
 * decide se vira publicação, se adia ou se some.
 */
export type IntencaoDeMensagem = {
  familyId: string;
  /** `reengajamento`, `lembrete`, `oferta_plano`… — só para rastro. */
  tipo: string;
  /**
   * Se a intenção ainda faz sentido depois de a conversa esfriar. Um lembrete
   * de "faz 3 dias que não conversamos" perde o sentido quando a mãe acabou de
   * escrever; uma oferta de plano continua válida amanhã.
   */
  perdeSentidoComInteracao?: boolean;
};

export type DecisaoAutomacao =
  | { acao: "publicar" }
  | { acao: "adiar"; motivos: EstadoConversa["motivos"] }
  | { acao: "descartar"; motivos: EstadoConversa["motivos"] };

/**
 * O gate. Toda automação passa por aqui antes de virar entrega.
 *
 * Adiar é a preferência: a mensagem continua fazendo sentido depois. Descartar
 * é para o que só fazia sentido no silêncio — e aí insistir amanhã seria falar
 * de algo que já não é verdade.
 */
export async function avaliarAutomacao(
  supabase: SupabaseClient,
  intencao: IntencaoDeMensagem,
): Promise<DecisaoAutomacao> {
  const estado = await avaliarEstadoDaConversa(supabase, intencao.familyId);
  if (!estado.ativa) return { acao: "publicar" };

  const acao = intencao.perdeSentidoComInteracao ? "descartar" : "adiar";
  await logEvent({
    kind: "ayla_automacao_barrada",
    severity: "info",
    family_account_id: intencao.familyId,
    payload: { tipo: intencao.tipo, acao, motivos: estado.motivos },
  }).catch(() => {});

  return acao === "descartar"
    ? { acao: "descartar", motivos: estado.motivos }
    : { acao: "adiar", motivos: estado.motivos };
}
