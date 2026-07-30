import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CONTROLE DE TURNO — uma resposta por vez de fala da mãe.
 *
 * No WhatsApp ninguém escreve um parágrafo: escreve três mensagens seguidas.
 * Como o webhook dispara um `processInbound` por mensagem, isso virava três
 * Aylas em paralelo, cada uma lendo o histórico antes de as outras
 * responderem. Na conversa do Pietro (29/07/2026) deu nisto: a mesma pergunta
 * feita 3× no mesmo minuto, um "que coisa boa de ouvir" respondendo a um
 * desabafo, e balões cruzados.
 *
 * O mecanismo tem duas partes, e as duas são necessárias:
 *
 * 1. ESPERAR O SILÊNCIO. Depois de persistir a mensagem, a execução dorme uns
 *    segundos. Se chegou mensagem nova nesse meio-tempo, ESTA execução desiste
 *    — quem chegou depois responde por todas. Numa rajada, só a última fala.
 *
 * 2. CLAIMAR O LOTE. Quem sobrevive faz `update ... where processada_em is
 *    null returning *`: um único statement, então duas execuções concorrentes
 *    nunca pegam a mesma mensagem. Quem perde recebe zero linhas e sai calada.
 *
 * O preço são alguns segundos a mais de latência. Vale: a Ayla já leva dezenas
 * de segundos pra responder, e uma resposta coerente compensa muito a espera.
 */

/** Silêncio esperado antes de responder. Cobre o intervalo típico entre
 *  mensagens de uma mesma fala; acima disso a pessoa está mesmo esperando. */
const JANELA_SILENCIO_MS = 7000;

/** Teto de mensagens no lote — rajada absurda não vira prompt gigante. */
const MAX_MENSAGENS_LOTE = 12;

/** Só entra no lote o que é recente. Rede de segurança contra mensagem antiga
 *  que ficou pendente por um erro e voltaria à conversa fora de hora. */
const JANELA_LOTE_MIN = 15;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LinhaInbound = { id: string; texto: string | null; created_at: string };

export type Lote = {
  /** Texto único do turno — as mensagens da mãe na ordem em que ela escreveu. */
  texto: string;
  /** Quantas mensagens entraram (1 = turno normal). */
  quantidade: number;
};

/**
 * Espera o silêncio e captura o turno. Devolve `null` quando esta execução NÃO
 * deve responder — porque chegou mensagem mais nova (outra execução assume) ou
 * porque outra já claimou o lote. Nesses casos o chamador retorna sem falar.
 */
export async function aguardarTurnoDaMae(
  supabase: SupabaseClient,
  params: { familyId: string; textoAtual: string },
): Promise<Lote | null> {
  // Marco tirado ANTES de dormir: a minha mensagem já está gravada, então
  // qualquer linha mais nova que isto é mensagem que chegou durante a espera.
  const marco = new Date().toISOString();

  await dormir(JANELA_SILENCIO_MS);

  const desde = new Date(Date.now() - JANELA_LOTE_MIN * 60_000).toISOString();

  try {
    // Chegou algo depois de mim? Então quem chegou responde — inclusive por
    // mim, porque a minha mensagem continua pendente no lote dela.
    const { data: novas } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", params.familyId)
      .eq("direcao", "inbound")
      .is("processada_em", null)
      .gt("created_at", marco)
      .limit(1);
    if ((novas?.length ?? 0) > 0) {
      console.log("[ayla:turno] mensagem mais nova chegou — esta execução cede a vez");
      return null;
    }

    // Claim atômico: só uma execução leva as linhas.
    const { data: claimadas, error } = await supabase
      .from("ayla_messages")
      .update({ processada_em: new Date().toISOString() })
      .eq("family_account_id", params.familyId)
      .eq("direcao", "inbound")
      .is("processada_em", null)
      .gte("created_at", desde)
      .select("id, texto, created_at");

    if (error) {
      // Coluna ainda não migrada (0070) ou falha inesperada: NÃO travar a Ayla.
      // Degrada pro comportamento antigo — responde só esta mensagem.
      console.warn("[ayla:turno] claim falhou, seguindo sem agrupar:", error.message);
      return { texto: params.textoAtual, quantidade: 1 };
    }

    const linhas = ((claimadas ?? []) as LinhaInbound[])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-MAX_MENSAGENS_LOTE);

    if (linhas.length === 0) {
      // Outra execução já levou este turno (corrida perdida) — sai calada,
      // senão a mãe recebe duas respostas.
      console.log("[ayla:turno] lote já claimado por outra execução — silêncio");
      return null;
    }

    const textos = linhas
      .map((l) => (l.texto ?? "").trim())
      .filter(Boolean);
    if (textos.length === 0) return { texto: params.textoAtual, quantidade: 1 };

    if (textos.length > 1) {
      console.log(`[ayla:turno] agrupando ${textos.length} mensagens num turno só`);
    }
    return { texto: textos.join("\n"), quantidade: textos.length };
  } catch (e) {
    console.warn("[ayla:turno] erro inesperado, seguindo sem agrupar:", e instanceof Error ? e.message : e);
    return { texto: params.textoAtual, quantidade: 1 };
  }
}

/**
 * Tira as pendentes da fila sem responder — pros caminhos que encerram o turno
 * por outro motivo (comando PAUSAR/SAIR, lead em abordagem manual, bloqueio).
 * Sem isto, essas mensagens ficariam pendentes e voltariam no próximo lote.
 */
export async function descartarTurnoPendente(
  supabase: SupabaseClient,
  familyId: string,
): Promise<void> {
  try {
    await supabase
      .from("ayla_messages")
      .update({ processada_em: new Date().toISOString() })
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .is("processada_em", null);
  } catch {
    /* best-effort — nunca derruba o fluxo */
  }
}
