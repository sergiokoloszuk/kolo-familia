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
 * Separação visual não é separação de mensagem. Uma orientação fica inteira;
 * atividades completas podem viajar uma por mensagem. O texto não é reescrito.
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

// Teto operacional conservador da aplicação, NÃO uma afirmação de limite da
// Z-API. O endpoint send-text não documenta teto numérico. Pode ser reduzido
// pelo chamador/teste se o provedor exigir; nunca truncamos para caber.
export const LIMITE_OPERACIONAL_TEXTO_WHATSAPP = 4000;

const CAMPO_ATIVIDADE = /^(?:tempo|dura[cç][aã]o|materia(?:l|is)|materiais|como (?:come[cç]ar|brincar|fazer)|passos?|convite|pr[oó]xima rodada|para terminar|encerramento|o que (?:exercita|fortalece|trabalha)|se n[aã]o funcionar)\b/i;

function unidadesDeConteudo(texto: string): string[] {
  const titulos: Array<{ inicio: number; fim: number }> = [];
  const linhas = /[^\n]+/g;
  let linha: RegExpExecArray | null;
  while ((linha = linhas.exec(texto))) {
    const t = linha[0].trim();
    const titulo = t.match(/^#{1,6}\s+(.+)$/)?.[1]
      ?? t.match(/^(?:\d+[.)]\s+)?\*{1,2}([^*]+)\*{1,2}$/)?.[1]
      ?? t.match(/^(?:\d+[.)]|[1-9]️⃣)\s+(.{1,100})$/u)?.[1]
      ?? t.match(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s+(.{1,100})$/u)?.[1];
    if (!titulo || titulo.length > 120 || CAMPO_ATIVIDADE.test(titulo) || /^[“"'‘>]/.test(titulo)) continue;
    titulos.push({ inicio: linha.index, fim: linha.index + linha[0].length });
  }

  // Primeiro localizar aberturas que apresentam material. Subtítulos internos
  // (por exemplo “Preparação”) não podem interromper a execução da atividade.
  const comMateriais = titulos.filter((titulo, i) => {
    const trecho = texto.slice(titulo.fim, titulos[i + 1]?.inicio ?? texto.length);
    return /^\s*(?:\*{1,2})?(?:materiais|material|sem material|voc[eê] (?:vai )?precisa(?:r)?|o que usar)\b/im.test(trecho);
  });
  const atividades = comMateriais.filter((titulo, i) =>
    /\b(?:como (?:come[cç]ar|brincar|fazer)|comece|convite|diga|rodada|passos?)\b/i.test(
      texto.slice(titulo.fim, comMateriais[i + 1]?.inicio ?? texto.length),
    ),
  );
  if (atividades.length < 2) return [texto];

  // Introdução fica com a primeira; opções finais ficam com a última.
  const inicios = [0, ...atividades.slice(1).map((a) => a.inicio)];
  return inicios.map((inicio, i) => texto.slice(inicio, inicios[i + 1] ?? texto.length).trim());
}

function respeitarLimite(texto: string, limite: number): string[] {
  const partes: string[] = [];
  let restante = texto;
  while (restante.length > limite) {
    const janela = restante.slice(0, limite + 1);
    // Preferir parágrafo completo; depois linha ou palavra, sem bolhas mínimas.
    let corte = janela.lastIndexOf("\n\n", limite);
    if (corte < limite / 2) corte = janela.lastIndexOf("\n", limite);
    if (corte < limite / 2) corte = janela.lastIndexOf(" ", limite);
    if (corte < limite / 2) {
      corte = 0;
      // Emojis com tom de pele/ZWJ e caracteres combinados viajam juntos.
      for (const parte of new Intl.Segmenter("pt", { granularity: "grapheme" }).segment(restante)) {
        const fim = parte.index + parte.segment.length;
        if (fim > limite) break;
        corte = fim;
      }
      // Um único cluster patológico pode exceder o próprio teto do canal.
      if (!corte) {
        corte = limite;
        if (/[\uD800-\uDBFF]/.test(restante[corte - 1])) corte--;
      }
    }
    partes.push(restante.slice(0, corte).trimEnd());
    restante = restante.slice(corte).trimStart();
  }
  if (restante) partes.push(restante);
  return partes;
}

/** Orientação inteira ou uma atividade por mensagem, com exceção de tamanho. */
export function dividirEmBolhas(
  texto: string,
  limite = LIMITE_OPERACIONAL_TEXTO_WHATSAPP,
): string[] {
  if (!Number.isInteger(limite) || limite < 32) throw new RangeError("Limite de mensagem inválido.");
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  if (!limpo) return [];
  return unidadesDeConteudo(limpo).flatMap((unidade) => respeitarLimite(unidade, limite));
}
