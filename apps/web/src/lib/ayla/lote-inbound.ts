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

/**
 * Silêncio esperado antes de responder.
 *
 * ⚠️ 3000 → 10000 EM 19/08/2026 (PEND-058), depois do rollout geral. É a
 * segunda recalibragem, e a história das duas importa mais que o número.
 *
 * ── O QUE FOI DECIDIDO EM 13/08 (7000 → 3000), e por quê ────────────────────
 * Medido sobre 60 dias do caminho LEGACY — 5.329 mensagens, 1.834 turnos:
 * 86,3% dos turnos têm um balão só e pagavam a espera à toa; a mediana do
 * intervalo dentro de um burst deu 11,2s (p90 34s), o que fez a janela parecer
 * inalcançável por construção. Trocou-se cobertura por 4 segundos em 100% dos
 * turnos, com conhecimento de causa.
 *
 * ── POR QUE AQUELE NÚMERO DEIXOU DE VALER ───────────────────────────────────
 * A medição de 13/08 diz ter usado o mesmo recorte que a de agora (entradas
 * consecutivas sem resposta da Ayla no meio) e mesmo assim deu mediana de
 * 11,2s, contra 5,6s aqui. **NÃO SEI dizer com certeza a origem da diferença.**
 * A hipótese mais provável é a população: aquela leu 60 dias do caminho
 * LEGACY, este lê 3 dias do caminho NOVO, que responde bem mais rápido (só
 * `parseInbound`, que o novo não paga, custava 2.659 ms de p50) — e quanto
 * mais rápido a Ayla responde, menos tempo a mãe tem para fragmentar antes de
 * ser respondida. Não é conclusão: é o que fica em aberto.
 *
 * O que NÃO está em aberto é o efeito: com 3s no ar, 11 dos 16 fragmentos
 * reais foram partidos em turnos separados. Isso é contagem, não modelo.
 *
 * ── MEDIDO EM 19/08, SOBRE O CAMINHO NOVO (desde 17/08 13:13Z) ──────────────
 * 47 pares de balões consecutivos (<60s). Separados pelo único critério que
 * distingue os dois fenômenos — houve resposta da Ayla ENTRE os dois?
 *
 *   31 pares COM resposta no meio  → ela respondeu à Ayla. Duas respostas
 *                                     aqui é o comportamento CORRETO.
 *   16 pares SEM resposta no meio  → fragmentação de verdade.
 *
 * Só os 16 reais:  p25 3,1s · MEDIANA 5,6s · p75 7,9s · p90 10,4s · máx 17,2s
 *
 *   janela  3s captura  4/16 (25%)   ← o que estava no ar
 *   janela  8s captura 13/16 (81%)
 *   janela 10s captura 14/16 (88%)   ← escolhido
 *   janela 20s captura 16/16 (100%)
 *
 * Onze dos dezesseis foram partidos em turnos separados.
 *
 * ── POR QUE 10s, E NÃO 8 NEM 20 ─────────────────────────────────────────────
 * A curva vira entre 8 e 10: 8s custa 5 segundos e pega 81%; 10s custa 7 e
 * pega 88%; 20s custaria 17 segundos a todo mundo para pegar mais dois casos.
 * O ponto de 10 foi escolhido por SEGURANÇA, não por eficiência — ver abaixo.
 *
 * ── O CASO QUE DECIDIU ──────────────────────────────────────────────────────
 * Lia/Valentina, 19/08 20:25. Conversa sobre tentativa de agressão da mãe
 * contra a criança. A cuidadora escreveu "Não há tisco" e, 4,0 SEGUNDOS depois,
 * "Risco" — corrigindo o próprio erro de digitação. Com a janela de 3s os dois
 * balões viraram dois turnos, e a Ayla respondeu duas vezes, contraditórias:
 * uma concluindo "não há risco" e seguindo para a lição de casa, outra
 * reabrindo "há risco?" e mandando ligar para o 190.
 *
 * Ter o primeiro balão no histórico NÃO resolve: ele chega como fala anterior,
 * não como parte da mesma frase. Só o agrupamento resolve. É por isso que
 * fragmentação de WhatsApp virou, aqui, um problema de segurança — e por isso
 * a janela maior é uma escolha deliberada de segurança, com o custo de
 * latência aceito por escrito.
 *
 * ⚠️ n=16. Base para decidir, não para fechar: remedir com amostra nova.
 */
const JANELA_SILENCIO_MS = 10000;

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
