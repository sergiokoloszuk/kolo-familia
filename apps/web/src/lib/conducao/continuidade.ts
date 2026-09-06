/**
 * A PERGUNTA QUE FICOU ABERTA — o fio que se perdia entre um turno e o seguinte.
 *
 * ⚠️ TRÊS INCIDENTES REAIS, 05/09/2026, e o mesmo buraco nos três.
 *
 * **Lucila.** A Ayla perguntou "quando ele não é entendido, consegue apontar ou
 * mostrar o que quer?" — uma pergunta SEM opções. A mãe respondeu "3". A Ayla
 * concluiu "ele também não consegue apontar" — o "3" tinha sido casado com uma
 * lista numerada de DOIS turnos antes.
 *
 * **Vanessa.** Respondeu "Ok" a um aviso de fim de teste. Virou tema de um plano
 * estratégico chamado "Responder 'ok' com clareza".
 *
 * **Samara.** Respondeu "Tudo" a uma pergunta sobre desafios da criança, e
 * recebeu um roteiro de desescalada de briga e um rastreio de violência
 * doméstica — herdados de um ramo de conversa de outro dia.
 *
 * ⚠️ POR QUE ISTO NÃO É UMA TABELA. `estado-seguranca.ts` já registra a doutrina
 * do repositório: o estado é INFERIDO DO HISTÓRICO, como `rotinaConversaPendente`
 * e `criancaPendente` já faziam — sem tabela nova, sem coluna nova, sem uma
 * segunda Ayla. A pergunta pendente JÁ ESTÁ no último outbound; o que faltava
 * era ligá-la à resposta antes de o modelo ler as duas como prosa solta.
 *
 * ⚠️ E ISTO NÃO DECIDE NADA. O bloco só diz ao GPT o que ele não conseguia ver
 * sozinho: qual era a pergunta, quais eram as opções, e — quando a resposta é
 * ambígua — que ela É ambígua. Quem interpreta continua sendo o modelo.
 */

/** Uma opção numerada de um menu: `3. ficar frustrado, chorar ou desistir`. */
export type OpcaoDaPergunta = { numero: number; texto: string };

export type PerguntaAberta = {
  /** A última pergunta que a Ayla fez, se fez alguma. */
  pergunta: string | null;
  /** As opções numeradas que ela ofereceu junto. Vazio quando não ofereceu. */
  opcoes: OpcaoDaPergunta[];
};

/** As linhas `1. …` / `2) …`, em linha própria ou inline. */
function extrairOpcoes(texto: string): OpcaoDaPergunta[] {
  const achados = new Map<number, string>();
  for (const m of texto.matchAll(/(?:^|[\s;])(\d{1,2})\s*[.)]\s+([^;\n]{2,120})/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 20 && !achados.has(n)) achados.set(n, m[2].trim());
  }
  return [...achados.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, texto]) => ({ numero, texto }));
}

/** A última frase interrogativa do texto — é ela que fica pendente. */
function ultimaPergunta(texto: string): string | null {
  const frases = texto.split(/(?<=[?!.])\s+/).filter((f) => f.includes("?"));
  const ultima = frases.at(-1)?.trim();
  return ultima ? ultima.slice(0, 300) : null;
}

/** O que ficou pendente na última fala da Ayla. */
export function perguntaAberta(ultimaAyla: string | null | undefined): PerguntaAberta {
  const t = (ultimaAyla ?? "").trim();
  if (!t) return { pergunta: null, opcoes: [] };
  return { pergunta: ultimaPergunta(t), opcoes: extrairOpcoes(t) };
}

/**
 * A resposta da família é só um aceite/escolha, sem conteúdo próprio?
 *
 * ⚠️ MESMO CRITÉRIO DE `prontidao-plano.ts`, e de propósito: duas definições de
 * "resposta curta" divergiriam, e o gate do plano e o fio da conversa passariam
 * a discordar sobre o mesmo turno.
 */
const RESPOSTA_SEM_CONTEUDO =
  /^\s*(ok(ay)?|sim|nao|não|isso|certo|exato|verdade|tudo|ambos|blz|beleza|uhum|aham|s|n|👍|✅|[1-9]\d?(\s*(e|,)\s*[1-9]\d?)*)\s*[.!]?\s*$/i;

/** Os números que a família citou, quando citou. */
function numerosCitados(texto: string): number[] {
  const m = (texto ?? "").match(/\d{1,2}/g);
  return m ? [...new Set(m.map(Number))].filter((n) => n >= 1 && n <= 20) : [];
}

/**
 * O bloco de continuidade, pronto para o contexto. Vazio quando não há nada a
 * esclarecer — e vazio é o caso comum: só nasce quando a resposta é curta e há
 * uma pergunta em aberto.
 */
export function blocoDeContinuidade(params: {
  ultimaAyla: string | null | undefined;
  mensagem: string;
}): string {
  const msg = (params.mensagem ?? "").trim();
  if (!msg || !RESPOSTA_SEM_CONTEUDO.test(msg)) return "";

  const { pergunta, opcoes } = perguntaAberta(params.ultimaAyla);
  const linhas: string[] = [];

  if (!pergunta && opcoes.length === 0) {
    // ⚠️ O CASO VANESSA: "Ok" depois de um aviso, não de uma pergunta. Sem
    // pendência, um aceite não abre assunto nenhum — e virou tema de plano.
    linhas.push(
      `A família respondeu "${msg}", mas sua última mensagem NÃO fez pergunta nem ofereceu nada. Isso é um aceite de cortesia: não o trate como um assunto novo, não deduza um tema a partir dele e não gere material por causa dele.`,
    );
    return `<continuidade>\n${linhas.join("\n")}\n</continuidade>`;
  }

  if (pergunta) linhas.push(`Sua última pergunta foi: "${pergunta}"`);

  const numeros = numerosCitados(msg);
  if (opcoes.length > 0) {
    linhas.push(
      `As opções que VOCÊ ofereceu nessa pergunta são: ${opcoes.map((o) => `${o.numero}. ${o.texto}`).join(" · ")}`,
    );
    const escolhidas = opcoes.filter((o) => numeros.includes(o.numero));
    if (escolhidas.length > 0) {
      linhas.push(
        `A família respondeu "${msg}" — ou seja, escolheu: ${escolhidas.map((o) => `"${o.texto}"`).join(" e ")}. A resposta é a ESSAS opções, não a nenhuma lista anterior.`,
      );
    }
  } else if (numeros.length > 0) {
    // ⚠️ O CASO LUCILA: número sem lista. O "3" dela foi casado com um menu de
    // dois turnos antes, e a Ayla concluiu algo que a mãe nunca disse.
    linhas.push(
      `A família respondeu "${msg}", mas sua última pergunta NÃO ofereceu opções numeradas. NÃO case esse número com nenhuma lista de turnos anteriores — ela já foi respondida. Se não der para entender a que ele se refere, pergunte.`,
    );
  } else {
    // ⚠️ O CASO SAMARA: "Tudo" a uma pergunta aberta. Responde à pergunta ACIMA,
    // e não a um ramo de conversa de outro dia.
    linhas.push(
      `A família respondeu "${msg}" — isso responde à pergunta acima, e a nada mais. Não recupere um assunto de outro turno para dar sentido a ela.`,
    );
  }

  return `<continuidade>\n${linhas.join("\n")}\n</continuidade>`;
}
