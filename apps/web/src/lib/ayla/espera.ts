/**
 * O BALÃO DE ESPERA no WhatsApp.
 *
 * Desde que a resposta passou a ser gerada por inteiro antes de sair (é esse
 * instante que permite checá-la — ver `responder.ts`), existe um silêncio real
 * entre a mensagem da mãe e a primeira bolha. Medido em produção simulada:
 * 2,3 s numa mensagem curta, 12,3 s num desafio comum.
 *
 * POR QUE DOIS BALÕES, e não só antecipar o primeiro. A conta é simples e foi o
 * que decidiu o desenho: com 12,3 s de geração, um único balão aos 4 s deixa
 * 8,3 s de vazio depois dele; aos 2,5 s deixa 9,8 s — ANTECIPAR SOZINHO PIORA a
 * segunda metade da espera, porque só empurra o vazio pra frente.
 *
 * Com dois balões, os tempos foram escolhidos medindo o VÃO MÁXIMO entre
 * qualquer sinal e o próximo, nas duas gerações reais (9,6 s e 12,3 s):
 *
 *   [4000]        → 5,6 s e 8,3 s
 *   [2500]        → 7,1 s e 9,8 s   (pior, como previsto)
 *   [2800, 9000]  → 6,2 s e 6,2 s
 *   [2800, 7500]  → 4,7 s e 4,8 s   ← escolhido
 *
 * Dois é o teto: três viraria conversa de robô ansioso.
 *
 * REGRAS QUE ESTE MÓDULO GARANTE:
 *   - resposta rápida NUNCA vê balão (o primeiro só dispara depois de 2,8 s);
 *   - os dois balões nunca repetem a mesma frase;
 *   - o texto varia por mensagem — a família não vê a mesma frase toda vez;
 *   - cancelar espera o que já estava em voo, então balão nunca cai no meio das
 *     bolhas da resposta;
 *   - nada aqui é persistido: não vira `ayla_messages`, `ayla_send_log`, fato da
 *     criança nem contexto. É só ruído de sala de espera;
 *   - o envio é disparado sem `await` no caminho da geração — a resposta real
 *     nunca espera pelo balão.
 */

/** Quando cada balão dispara, em ms desde o início da geração. */
export const ESPERAS_MS = [2800, 7500] as const;

/**
 * O primeiro é "estou com você"; o segundo é "ainda estou aqui, quase lá".
 * Separados de propósito: repetir o mesmo tipo de frase duas vezes soa robô.
 */
export const FRASES_PRIMEIRA = [
  "Deixa eu pensar nisso com você 🌿",
  "Tô aqui — me dá um segundinho.",
  "Boa. Deixa eu olhar isso com carinho.",
  "Peraí que eu já volto com isso.",
] as const;

export const FRASES_SEGUNDA = [
  "Tô montando aqui, já te mando 🌿",
  "Quase lá — só organizando as ideias.",
  "Só mais um pouquinho.",
  "Já vai, tô terminando de pensar.",
] as const;

/** Hash estável: a mesma mensagem escolhe sempre as mesmas frases. */
function semente(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type Espera = {
  /**
   * Para os balões que ainda não saíram e ESPERA o que já estava em voo.
   * Chame antes de publicar a resposta.
   */
  cancelar: () => Promise<void>;
  /** Quantos balões chegaram a ser disparados. Só para teste/telemetria. */
  disparados: () => number;
};

/**
 * Agenda os balões de espera. Não bloqueia nada.
 *
 * @param enviar  como mandar o texto (o canal decide; aqui não se conhece Z-API)
 * @param mensagem  a mensagem da mãe — só serve de semente para variar as frases
 */
export function agendarEspera(params: {
  enviar: (texto: string) => Promise<unknown>;
  mensagem: string;
  /** Sobrescreve os tempos. Existe para os testes com relógio simulado. */
  temposMs?: readonly number[];
}): Espera {
  const tempos = params.temposMs ?? ESPERAS_MS;
  const s = semente(params.mensagem);
  const textos = [
    FRASES_PRIMEIRA[s % FRASES_PRIMEIRA.length],
    FRASES_SEGUNDA[s % FRASES_SEGUNDA.length],
  ];

  const timers: Array<ReturnType<typeof setTimeout>> = [];
  const emVoo: Array<Promise<unknown>> = [];
  let n = 0;

  tempos.forEach((ms, i) => {
    timers.push(
      setTimeout(() => {
        n += 1;
        // Sem await: a geração não espera pelo balão.
        emVoo.push(params.enviar(textos[i] ?? textos[textos.length - 1]).catch(() => undefined));
      }, ms),
    );
  });

  return {
    disparados: () => n,
    cancelar: async () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      // O que já saiu precisa chegar antes das bolhas, ou a ordem embaralha.
      await Promise.all(emVoo).catch(() => undefined);
    },
  };
}
