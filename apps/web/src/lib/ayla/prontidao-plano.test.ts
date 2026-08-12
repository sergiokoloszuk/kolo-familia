import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PRONTIDÃO PASSA A ENXERGAR A CRIANÇA — fatia 1 da suficiência do Plano.
 *
 * ⚠️ A ASSIMETRIA QUE ISTO CORRIGE: quem DECIDIA se sabíamos o bastante não via
 * nada do que quem PRODUZ vê. `avaliarProntidaoParaPlano` recebia
 * `{familyId, mensagemAtual}` e lia 14 mensagens da FAMÍLIA — sem criança, sem
 * perfil, sem os planos anteriores. Dois passos adiante, `gerarPlano` tinha
 * perfil vivo, base Kolo e `<o_que_ja_funcionou>` na mão.
 *
 * O efeito prático era o pior possível: uma família de meses, com perfil cheio,
 * que voltava e escrevia duas linhas levava "conversa curta demais" — e
 * silêncio.
 *
 * ⚠️ ESTA FATIA NÃO MUDA O CONTRATO: continua devolvendo `{pronto, tema, motivo}`.
 * O que muda é a INFORMAÇÃO com que a decisão é tomada.
 */

/** O que o modelo recebeu — a prova de que o perfil chegou à DECISÃO. */
let ultimoPayload = "";
let chamadasDeModelo = 0;
let respostaDoModelo: Record<string, unknown> = { estado: "suficiente", tema: "comunicação com estranhos", motivo: "ok" };

vi.mock("@/lib/ia/anthropic", () => ({
  MODELS: { leve: "haiku" },
  getAnthropicClient: () => ({
    messages: {
      create: async (args: { system?: unknown; messages?: Array<{ content?: unknown }> }) => {
        chamadasDeModelo++;
        ultimoPayload = `${JSON.stringify(args.system)}\n${JSON.stringify(args.messages)}`;
        return {
          content: [{ type: "text", text: JSON.stringify(respostaDoModelo) }],
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    },
  }),
}));

const { avaliarProntidaoParaPlano } = await import("./prontidao-plano");

const FAM = "fam-1";
const MARIO = "membro-mario";

/** Um supabase mínimo: só a leitura de conversa que a prontidão faz. */
function supaCom(linhas: Array<{ direcao: string; texto: string }>) {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: () => ({ data: linhas.map((l) => ({ ...l, created_at: "2026-08-11T12:00:00Z" })) }),
  });
  return { from: () => q } as never;
}

const CONVERSA_LONGA = Array.from({ length: 10 }, (_, i) => ({
  direcao: i % 2 ? "outbound" : "inbound",
  texto: `mensagem ${i} sobre o dia a dia`,
}));

const PERFIL_RICO = `O essencial: Mário, 9 anos, autista\nComo é / interesses: dinossauros; fala frases longas em casa\nSensorial: incomoda-se com barulho alto`;

beforeEach(() => {
  ultimoPayload = "";
  chamadasDeModelo = 0;
  respostaDoModelo = { estado: "suficiente", tema: "comunicação com estranhos", motivo: "ok" };
});

describe("A · conversa curta + perfil rico", () => {
  it("MORDE: não é barrada por ter poucas mensagens", async () => {
    const r = await avaliarProntidaoParaPlano(supaCom([{ direcao: "inbound", texto: "quero um plano" }]), {
      familyId: FAM,
      mensagemAtual: "quero um plano pro Mário falar com quem ele não conhece",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });
    // O piso de 3 linhas era a única razão de barrar; com perfil, ele não vale.
    expect(r.motivo, "barrou por tamanho de conversa, tendo perfil").not.toContain("conversa curta");
    expect(chamadasDeModelo, "nem chegou a avaliar").toBe(1);
    expect(r.estado).toBe("suficiente");
  });

  it("MORDE: sem perfil E sem aprendizado, o piso continua valendo", async () => {
    // O piso existe por um motivo real: plano genérico pra quem acabou de
    // chegar. Ele não foi removido — deixou de valer para quem já conhecemos.
    const r = await avaliarProntidaoParaPlano(supaCom([{ direcao: "inbound", texto: "oi" }]), {
      familyId: FAM,
      mensagemAtual: "quero um plano",
      membroAtipicoId: MARIO,
    });
    expect(r.estado).toBe("nao_e_plano");
    expect(r.motivo).toContain("criança desconhecida");
    expect(chamadasDeModelo, "gastou modelo numa família que mal falou").toBe(0);
  });
});

describe("B · conversa longa não compra suficiência", () => {
  it("o tamanho não decide — quem decide é o critério", async () => {
    respostaDoModelo = { estado: "falta_escopo", tema: "", motivo: "sem exemplo concreto" };
    const r = await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "não sei, tá tudo difícil",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });
    expect(r.estado, "10 mensagens viraram suficiência sozinhas").not.toBe("suficiente");
  });
});

describe("C/E · o que já sabemos CHEGA à decisão", () => {
  it("MORDE: o perfil entra no payload da prontidão", async () => {
    await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "quero um plano",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });
    expect(ultimoPayload, "o perfil ficou fora da decisão").toContain("o_que_ja_sabemos_da_crianca");
    expect(ultimoPayload).toContain("dinossauros");
    expect(ultimoPayload, "a instrução de não repetir o que já se sabe sumiu").toContain(
      "não peça de novo o que já está ali",
    );
  });

  it("MORDE: o aprendizado de planos anteriores entra", async () => {
    await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "quero um plano",
      membroAtipicoId: MARIO,
      aprendizado: "<o_que_ja_funcionou>\n- rotina do banho: funcionou\n</o_que_ja_funcionou>",
    });
    expect(ultimoPayload).toContain("o_que_ja_funcionou");
    expect(ultimoPayload).toContain("rotina do banho");
  });
});

describe("D/F · isolamento entre irmãos", () => {
  it("MORDE: só entra o que o chamador deu para ESTA criança", async () => {
    // O escopo por criança é do chamador — `perfilResumo` e `aprendizado` já
    // nascem filtrados por membro (`carregarKoloVivoResumo` e
    // `carregarAprendizado` recebem o membro). A prontidão não busca nada por
    // conta própria, e por isso não tem como puxar o irmão.
    await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "quero um plano pro Mário",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });
    expect(ultimoPayload).not.toContain("Manu");
  });
});

describe("G · perfil vazio", () => {
  it("segue coerente: conversa longa sem perfil ainda pode ser suficiente", async () => {
    const r = await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "ele trava quando precisa começar a falar com alguém novo",
      membroAtipicoId: null,
    });
    expect(r.estado).toBe("suficiente");
  });
});

describe("custo", () => {
  it("continua sendo UMA chamada de modelo — a fatia não acrescentou IA", async () => {
    await avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: "quero um plano",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
      aprendizado: "<o_que_ja_funcionou>\n- x: funcionou\n</o_que_ja_funcionou>",
    });
    expect(chamadasDeModelo).toBe(1);
  });
});

describe("o último salto da fiação: orquestrador → ponte", () => {
  it("MORDE: o turno entrega à ponte o resumo que ELE JÁ carregou", () => {
    // ⚠️ ESTE É ESTRUTURAL, e assumidamente o elo mais fraco da cadeia. Os
    // testes acima provam por execução que a prontidão usa o perfil e que a
    // ponte o repassa; falta o salto de cima. Exercitá-lo exigiria rodar
    // `processInbound` com a prontidão real — que fala com outro cliente
    // Anthropic (`@/lib/ia/anthropic`), fora dos duplos do harness.
    //
    // Sem ele, cortar `perfilResumo` no orquestrador passava VERDE: a decisão
    // voltava a ser cega e nenhum teste percebia.
    //
    // E o que ele defende não é a linha, é a ECONOMIA: o resumo vem do turno,
    // já carregado para a resposta conversacional. Buscar de novo seria a mesma
    // consulta duas vezes por uma decisão que nem escreve o plano.
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    expect(ORCH).toMatch(/perfilResumo: args\.params\.koloVivoResumo,/);
  });
});

describe("o contrato de cinco estados", () => {
  const avaliar = (mensagem = "quero um plano") =>
    avaliarProntidaoParaPlano(supaCom(CONVERSA_LONGA), {
      familyId: FAM,
      mensagemAtual: mensagem,
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });

  it("MORDE: os cinco estados passam inteiros", async () => {
    for (const estado of ["suficiente", "falta_escopo", "orientacao", "nao_e_plano"] as const) {
      respostaDoModelo = { estado, tema: "comunicação", motivo: "m" };
      expect((await avaliar()).estado, estado).toBe(estado);
    }
    respostaDoModelo = { estado: "falta", tema: "comunicação", pergunta: "Ele trava mais pra começar ou pra responder?", motivo: "m" };
    const r = await avaliar();
    expect(r.estado).toBe("falta");
    expect(r.pergunta).toContain("começar");
  });

  it("MORDE: estado inventado pelo modelo NÃO vira desfecho", async () => {
    // O contrato é do código. Um "talvez" do modelo não pode abrir caminho novo.
    respostaDoModelo = { estado: "talvez", tema: "x", motivo: "m" };
    expect((await avaliar()).estado).toBe("nao_e_plano");
  });

  it("MORDE: `falta` sem pergunta cai para falta_escopo — nunca fica mudo", async () => {
    // `falta` sem pergunta é o pior dos mundos: não gera E não pergunta. Se o
    // modelo não formulou a pergunta, ele não sabe o que falta.
    respostaDoModelo = { estado: "falta", tema: "comunicação", motivo: "m" };
    const r = await avaliar();
    expect(r.estado).toBe("falta_escopo");
    expect(r.motivo).toContain("sem pergunta");
  });

  it("MORDE: `suficiente` sem tema vira falta_escopo, não silêncio", async () => {
    respostaDoModelo = { estado: "suficiente", tema: "", motivo: "m" };
    expect((await avaliar()).estado).toBe("falta_escopo");
  });

  it("MORDE: falha do modelo devolve nao_e_plano, não `falta`", async () => {
    // Ausência de sinal não é sinal de que falta informação. Prometer pergunta
    // a partir de um erro de rede seria inventar condução.
    respostaDoModelo = { estado: "falta", tema: "x", pergunta: "p", motivo: "m" };
    const quebrado = { from: () => { throw new Error("banco fora"); } } as never;
    const r = await avaliarProntidaoParaPlano(quebrado, {
      familyId: FAM,
      mensagemAtual: "quero um plano",
      membroAtipicoId: MARIO,
      perfilResumo: PERFIL_RICO,
    });
    expect(r.estado).toBe("nao_e_plano");
    expect(r.pergunta).toBeNull();
  });

  it("a instrução proíbe perguntar o que já sabemos, e proíbe duas perguntas", async () => {
    await avaliar();
    expect(ultimoPayload).toContain("NUNCA pergunte o que já está em O QUE JÁ SABEMOS");
    expect(ultimoPayload).toContain("Nunca duas perguntas");
  });
});
