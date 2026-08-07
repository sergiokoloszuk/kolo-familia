/**
 * COMO A RESPOSTA VIRA BOLHAS NO WHATSAPP.
 *
 * Até aqui a publicação fazia `texto.split(/\n{2,}/)` direto no orquestrador:
 * toda linha em branco virava uma bolha. Isso funcionava enquanto a resposta era
 * prosa corrida — mas quebra qualquer resposta com TÍTULO. Escrito do jeito
 * natural:
 *
 *     *O que eu faria primeiro*
 *
 *     Tire a comida nova do prato dele.
 *
 * o divisor produzia DUAS bolhas, e a primeira continha só o título. Com 3
 * blocos, 6 bolhas — metade delas com duas palavras. É exatamente o "10 bolhas
 * de 1 frase" que não queremos, e acontecia sozinho.
 *
 * Aqui o título viaja junto com o que ele intitula. Nada mais: o NÚMERO de
 * blocos é decidido no prompt (2 a 4 quando há entrega), não neste arquivo.
 */

/**
 * O RITMO DO ENVIO — quanto "digitando" cada bolha mostra antes de aparecer.
 *
 * ⚠️ ESTA ESPERA É ARTIFICIAL E VEM DEPOIS DE A RESPOSTA JÁ ESTAR PRONTA.
 *
 * Medido em 07/08/2026: o pipeline inteiro (classificação + recuperação +
 * modelo) leva ~5,2 s de mediana no GPT. A fórmula anterior — 2 s na primeira
 * bolha e até 6 s nas seguintes — somava **13 a 14 segundos** numa resposta
 * típica de 3 bolhas. Ou seja: o modelo era 20% do que a mãe esperava, e 80%
 * era espera que a gente mesma criou.
 *
 * E o repertório piorou isso sem tocar em latência: respostas mais completas
 * geram mais bolhas, e cada bolha custava até 6 s.
 *
 * O efeito humano continua — some a impressão de "parede de texto instantânea"
 * —, mas com TETO. O `delayTyping` da Z-API é em segundos inteiros, então não
 * adianta pedir 0,8 s: o mínimo que existe é 1.
 *
 * O que NÃO muda: o texto, o número de bolhas, a ordem. Só o ritmo.
 */
export const TETO_ESPERA_SEGUNDOS = 4;

/**
 * Os delays de cada bolha, já dentro do teto total.
 *
 * A primeira sai rápido (1 s) porque é ela que tira a mãe da incerteza. As
 * seguintes acompanham o tamanho do bloco, entre 1 e 2 s — e o orçamento
 * comum garante que uma resposta longa não vire espera longa: quando o teto
 * acaba, as bolhas restantes saem sem espera nenhuma.
 */
export function ritmoDasBolhas(
  bolhas: readonly string[],
  tetoSegundos: number = TETO_ESPERA_SEGUNDOS,
): number[] {
  let restante = Math.max(0, tetoSegundos);
  return bolhas.map((texto, i) => {
    // ~120 caracteres por segundo: um bloco curto pede 1 s, um longo pede 2.
    const bruto = i === 0 ? 1 : Math.min(Math.max(Math.round(texto.length / 120), 1), 2);
    const delay = Math.min(bruto, restante);
    restante -= delay;
    return delay;
  });
}

/**
 * Uma linha que é SÓ um título: `*Assim*`, com emoji antes ou dentro.
 *
 * Curto de propósito (até 48 caracteres). Uma frase inteira em negrito não é
 * título — é ênfase, e ênfase pode legitimamente ficar sozinha numa bolha.
 */
const SO_TITULO =
  /^\s*(?:[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]+\s*)?\*{1,2}[^*\n]{1,48}\*{1,2}\s*$/u;

export function ehSoTitulo(pedaco: string): boolean {
  return SO_TITULO.test(pedaco) && !pedaco.includes("\n");
}

/**
 * Divide o texto da Ayla nas bolhas que vão pro WhatsApp.
 *
 * Regra única: um pedaço que seja só um título gruda no pedaço seguinte. Se o
 * título for a última coisa do texto (não deveria acontecer, mas modelo é
 * modelo), ele sai sozinho mesmo — melhor uma bolha estranha do que sumir com
 * o conteúdo.
 */
export function dividirEmBolhas(texto: string): string[] {
  const pedacos = texto
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);

  const bolhas: string[] = [];
  for (const pedaco of pedacos) {
    const anterior = bolhas[bolhas.length - 1];
    if (anterior !== undefined && ehSoTitulo(anterior)) {
      // O título esperava por este conteúdo: viajam juntos, uma linha só entre
      // eles (duas reabriria a divisão na próxima vez que isso for reprocessado).
      bolhas[bolhas.length - 1] = `${anterior}\n${pedaco}`;
      continue;
    }
    bolhas.push(pedaco);
  }
  return bolhas;
}
