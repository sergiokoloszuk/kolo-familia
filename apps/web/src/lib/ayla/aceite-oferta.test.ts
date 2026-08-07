import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O CASO GUSTAVO — 04/08/2026, produção.
 *
 * A Ayla ofereceu: "se quiser, a gente pode montar uma história curta pro
 * Gustavo de protagonista, praticando esse momento de chegar num grupo".
 * A mãe respondeu: "Sim. Vamos montar uma história."
 *
 * E recebeu uma resposta sobre não poder dar diagnóstico.
 *
 * No banco: a fronteira do diagnóstico barrou a resposta (`atribuicao_
 * distribuida`), a regeneração barrou de novo, e o piso de texto fixo foi ao
 * ar. O "sim" não tinha referente — sem ele, o modelo reconstrói o turno a
 * partir da conversa inteira, e a conversa inteira era sobre o autismo do
 * Gustavo.
 *
 * A peça que resolvia aceite existia, mas só pro Plano (`ofertouPlanoRecente`)
 * e pro Kolo Vivo (`confirmarSugestaoPendente`). E o classificador — que já
 * recebia a última fala da Ayla — dizia que resposta curta é SEMPRE "outro".
 */

const INTENT = readFileSync(resolve(__dirname, "intent.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const RESP = readFileSync(resolve(__dirname, "responder.ts"), "utf8");

describe("o classificador resolve o referente do 'sim'", () => {
  it("devolve o aceite na MESMA chamada — sem roteador novo", () => {
    expect(INTENT).toMatch(/intencao\|tema\|aceite/);
    expect(INTENT).toMatch(/aceite: string \| null;/);
    // 06/08/2026: o campo `skills` entrou como QUARTO, e a separação passou a
    // ser `separarCampos` — que protege o aceite do erro real do Haiku (emitir
    // 3 campos e pôr a skill no lugar do aceite). A posição do aceite não mudou.
    expect(INTENT).toMatch(/let aceite = p\[2\] \?\? "";/);
    expect(INTENT).toMatch(/aceite = ""; \/\/ não havia aceite/);
  });

  it("separa ACEITAR uma oferta de RESPONDER uma pergunta", () => {
    expect(INTENT).toMatch(/ACEITAR UMA OFERTA É DIFERENTE DE RESPONDER UMA PERGUNTA/);
    // A regra que existia continua — ela não estava errada, só era metade.
    expect(INTENT).toMatch(/RESPOSTA A UMA PERGUNTA NÃO É PEDIDO/);
  });

  it("cobre a fala que tem pergunta E oferta juntas — o caso real", () => {
    // Sem esta cláusula o caso do Gustavo resolvia em 4 de 6 execuções: a
    // mesma mensagem da Ayla perguntava ("me conta o que você reparar") e
    // oferecia ("a gente pode montar uma história").
    expect(INTENT).toMatch(/A FALA DA AYLA QUASE SEMPRE TEM AS DUAS COISAS/);
    expect(INTENT).toMatch(/se ela retomou a COISA OFERECIDA/);
    expect(INTENT).toMatch(/responde o CONTEÚDO da pergunta/);
  });

  it("aceitar uma IDEIA não abre ferramenta — só artefato oferecido faz isso", () => {
    expect(INTENT).toMatch(/SÓ quando a oferta era de um ARTEFATO/);
    expect(INTENT).toMatch(/Aceitar uma ideia não pode abrir uma ferramenta que ela não pediu/);
  });

  it("duas opções + 'sim' continua ambíguo — quem pergunta é a Ayla", () => {
    expect(INTENT).toMatch(/OFERTA COM DUAS OPÇÕES \+ "sim" É AMBÍGUO/);
  });

  it("guarda o caso real que motivou tudo", () => {
    expect(INTENT).toMatch(/Sim\. Vamos montar uma história\./);
    expect(INTENT).toMatch(/resposta sobre não poder dar diagnóstico|resposta sobre diagnóstico/);
  });

  it("o campo cabe na resposta — 24 tokens cortavam a frase no meio", () => {
    expect(INTENT).toMatch(/max_tokens: 100/);
    expect(INTENT).not.toMatch(/max_tokens: 24/);
  });

  it("aceite vazio, '-' ou curto demais vira null — o silêncio não inventa", () => {
    expect(INTENT).toMatch(/bruto !== "-" && bruto\.length > 3 \? bruto\.slice\(0, 200\) : null/);
  });

  it("em falha, nada de aceite — nunca executa por acidente", () => {
    expect(INTENT).toMatch(/return \{ intencao: "outro", tema: anterior, aceite: null, skills: \[\] \}/);
  });
});

describe("o aceite chega até a fala", () => {
  it("o orquestrador passa adiante", () => {
    expect(ORCH).toMatch(/const aceite = turnoClassificado\.aceite/);
    expect(ORCH).toMatch(/\n      aceite,\n/);
  });

  it("a nota manda FAZER agora, e proíbe voltar pro começo", () => {
    expect(RESP).toMatch(/ELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU no seu último turno/);
    expect(RESP).toMatch(/FAÇA ISSO AGORA, neste turno/);
    expect(RESP).toMatch(/não volte a "por onde a gente começa\?"/);
    expect(RESP).toMatch(/não peça pra ela repetir o pedido/);
  });

  it("história vai pro app, com link e avatar — não é a Ayla que escreve", () => {
    expect(RESP).toMatch(/HISTÓRIA é um destes casos: quem monta é ela, no app/);
    expect(RESP).toMatch(/dá pra criar o avatar/);
    expect(RESP).toMatch(/Não descreva a história inteira no WhatsApp nem prometa gerar você mesma/);
  });

  it("faltando UM dado, pergunta só ele", () => {
    expect(RESP).toMatch(/pergunte SÓ esse dado — nada além dele/);
  });

  it("os links do Lúdico continuam existindo pra este turno", () => {
    // Este é um aceite de HISTÓRIA, não um pedido de plano: os links precisam
    // estar na mão do modelo. Só o turno de plano fica sem eles.
    expect(ORCH).toMatch(/const ofereceLudico = ehCrianca && !pedidoDePlano/);
    expect(ORCH).toMatch(/next: "\/historias\/criar"/);
  });
});
