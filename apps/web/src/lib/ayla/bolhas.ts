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
