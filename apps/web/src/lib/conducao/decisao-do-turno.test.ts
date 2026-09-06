import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { interpretar } from "./decisao-do-turno";

/**
 * ⚠️ O QUE ESTES TESTES PRENDEM. A decisão semântica do turno saiu do
 * claude-haiku-4-5 e foi para o GPT — mas o que protege a família não é o
 * modelo, é o CONTRATO: nada que o modelo devolva pode disparar uma feature por
 * acidente, nomear uma skill que não existe ou inventar uma intenção.
 *
 * Toda entrada estranha vira o valor mais conservador. O pior caso do modelo
 * errando é o produto de ontem — nunca uma feature agindo sozinha.
 */

const CATALOGO = new Set(["sono", "rotina", "comunicacao", "emocional"]);
const j = (o: Record<string, unknown>) => JSON.stringify(o);

describe("GATE 3 — falar sobre um assunto não é pedir a ação", () => {
  it("o caso Claire/Maria: 'Nós 2, lição e rotina' não dispara feature", () => {
    // O modelo entende o assunto (rotina) e diz que NÃO houve pedido.
    const d = interpretar(
      j({ intencao: "organizacao", pedido_explicito: false, tema: "lição de casa" }),
      CATALOGO,
    );
    expect(d.intencao).toBe("organizacao");
    // ⚠️ É este `false` que impede o sequestro. O assunto foi entendido; a
    // feature não age.
    expect(d.pedidoExplicito).toBe(false);
  });

  it("comando inequívoco continua funcionando", () => {
    const d = interpretar(
      j({ intencao: "rotina_editar", pedido_explicito: true, tema: "banho" }),
      CATALOGO,
    );
    expect(d.intencao).toBe("rotina_editar");
    expect(d.pedidoExplicito).toBe(true);
  });

  it("SÓ o booleano true libera — nada de string, número ou objeto", () => {
    // ⚠️ O VIÉS É SEMPRE NÃO DISPARAR. Um modelo que devolve "true" como string
    // não pode acionar a Rotina Visual de uma família real.
    for (const v of ["true", 1, "sim", {}, [], null, undefined]) {
      const d = interpretar(j({ intencao: "rotina_criar", pedido_explicito: v }), CATALOGO);
      expect(d.pedidoExplicito).toBe(false);
    }
    expect(interpretar(j({ intencao: "rotina_criar", pedido_explicito: true }), CATALOGO).pedidoExplicito).toBe(true);
  });
});

describe("GATE 5 — necessidade de conhecimento entra no contrato", () => {
  it.each([
    ["nenhum", "nenhum"],
    ["boas_praticas", "boas_praticas"],
    ["base2", "base2"],
    ["pos_neurodesenvolvimento", "pos_neurodesenvolvimento"],
    ["combinacao", "combinacao"],
  ])("aceita %s", (entrada, esperado) => {
    expect(
      interpretar(j({ necessidade_conhecimento: entrada }), CATALOGO).necessidadeConhecimento,
    ).toBe(esperado);
  });

  it("valor inventado vira nenhum", () => {
    expect(
      interpretar(j({ necessidade_conhecimento: "consultar_a_internet" }), CATALOGO)
        .necessidadeConhecimento,
    ).toBe("nenhum");
  });

  it("tema do conhecimento viaja junto quando existe", () => {
    const d = interpretar(
      j({ necessidade_conhecimento: "boas_praticas", tema_conhecimento: "seletividade alimentar" }),
      CATALOGO,
    );
    expect(d.temaConhecimento).toBe("seletividade alimentar");
  });
});

describe("SKILLS — o catálogo manda, não o modelo", () => {
  it("skill fora do catálogo é descartada", () => {
    const d = interpretar(j({ skills: ["sono", "telepatia", "rotina"] }), CATALOGO);
    expect(d.skills).toEqual(["sono", "rotina"]);
  });
  it("no máximo duas", () => {
    const d = interpretar(j({ skills: ["sono", "rotina", "comunicacao", "emocional"] }), CATALOGO);
    expect(d.skills).toHaveLength(2);
  });
  it("skills repetidas não duplicam", () => {
    expect(interpretar(j({ skills: ["sono", "sono"] }), CATALOGO).skills).toEqual(["sono"]);
  });
  it("skills não-array vira lista vazia", () => {
    expect(interpretar(j({ skills: "sono" }), CATALOGO).skills).toEqual([]);
  });
});

describe("INTENÇÃO — só o domínio conhecido", () => {
  it.each(["rotina_criar", "rotina_ver", "rotina_editar", "organizacao", "plano", "outro"])(
    "aceita %s",
    (i) => expect(interpretar(j({ intencao: i }), CATALOGO).intencao).toBe(i),
  );
  it("intenção inventada vira outro", () => {
    // Uma intenção fora do domínio rotearia para uma feature que não existe.
    expect(interpretar(j({ intencao: "cancelar_assinatura" }), CATALOGO).intencao).toBe("outro");
  });
});

describe("GATE 4 — continuação e referente", () => {
  it("resposta curta marcada como continuação", () => {
    const d = interpretar(
      j({ intencao: "outro", continuacao: true, aceite: "montar a rotina da manhã" }),
      CATALOGO,
    );
    expect(d.continuacao).toBe(true);
    expect(d.aceite).toBe("montar a rotina da manhã");
  });
  it("cobrança de artefato NÃO vira intenção de feature", () => {
    // ⚠️ "E agora?" com artefato pendente: quem trata é o código da retomada,
    // não a feature de criação. Criar uma rotina nova aqui duplicaria o quadro.
    const d = interpretar(j({ intencao: "outro", continuacao: true, pedido_explicito: false }), CATALOGO);
    expect(d.intencao).toBe("outro");
    expect(d.pedidoExplicito).toBe(false);
  });
});

describe("ENTRADA QUEBRADA NUNCA DERRUBA NEM DISPARA", () => {
  it.each([
    ["texto solto", "não consegui decidir"],
    ["json inválido", "{ intencao: rotina_criar "],
    ["vazio", ""],
    ["array", "[1,2,3]"],
  ])("%s vira decisão neutra", (_, bruto) => {
    const d = interpretar(bruto, CATALOGO);
    expect(d.intencao).toBe("outro");
    expect(d.pedidoExplicito).toBe(false);
    expect(d.skills).toEqual([]);
    expect(d.necessidadeConhecimento).toBe("nenhum");
  });

  it("cercas de código são toleradas — o modelo às vezes as põe", () => {
    const d = interpretar('```json\n{"intencao":"plano","pedido_explicito":true}\n```', CATALOGO);
    expect(d.intencao).toBe("plano");
    expect(d.pedidoExplicito).toBe(true);
  });

  it('a string "null" não vira tema', () => {
    expect(interpretar(j({ tema: "null" }), CATALOGO).tema).toBeNull();
  });
});

/**
 * ⚠️ TESTES ESTRUTURAIS — prendem DECISÕES, não comportamento.
 * Eles quebram no dia em que alguém devolver a autoridade ao Haiku ou reabrir
 * o sequestro por classificação, que são os dois jeitos de esta fase se
 * desfazer sem ninguém perceber.
 */
describe("a inversão está de pé no orquestrador", () => {
  const ORQ = readFileSync(new URL("../ayla/orchestrator.ts", import.meta.url), "utf8");

  it("o caminho oficial chama decidirTurno, não classificarIntencao", () => {
    expect(ORQ).toMatch(/await decidirTurno\(\{/);
    // `classificarIntencao` pode continuar importado (outros consumidores),
    // mas não pode mais ser chamado para decidir o turno reativo.
    expect(ORQ).not.toMatch(/:\s*await classificarIntencao\(\{/);
  });

  it("o estado é apurado ANTES da decisão", () => {
    const iEstado = ORQ.indexOf("apurarEstadoDoTurno(supabase");
    const iDecisao = ORQ.indexOf("await decidirTurno({");
    expect(iEstado).toBeGreaterThan(0);
    expect(iEstado).toBeLessThan(iDecisao);
  });

  it("o bloco de estado viaja para a decisão", () => {
    expect(ORQ).toMatch(/blocoEstado: blocoEstadoDoTurno/);
  });

  it("os quatro pontos de sequestro exigem pedido explícito", () => {
    expect(ORQ).toMatch(/intent === "rotina_ver" && pedidoExplicito/);
    expect(ORQ).toMatch(/intent === "rotina_editar" && pedidoExplicito/);
    expect(ORQ).toMatch(/\(intent === "rotina_criar" && pedidoExplicito\)/);
    expect(ORQ).toMatch(/\(intent === "organizacao" && pedidoExplicito\)/);
  });

  it("o Plano não dispara por intenção sem pedido", () => {
    expect(ORQ).toMatch(/turnoClassificado\.intencao === "plano" && pedidoExplicito/);
  });
});

describe("a decisão usa o mesmo provider da conversa", () => {
  const DEC = readFileSync(new URL("./decisao-do-turno.ts", import.meta.url), "utf8");
  it("openai, e não anthropic", () => {
    expect(DEC).toMatch(/provider: "openai"/);
    expect(DEC).not.toMatch(/anthropic/i);
  });
  it("a duração é registrada — Gate 9", () => {
    expect(DEC).toMatch(/ms: saida\.ms/);
  });
  it("a falha cai no neutro, nunca de volta no Haiku", () => {
    expect(DEC).toMatch(/fallback_neutro/);
    expect(DEC).not.toMatch(/classificarIntencao\(/);
  });
});
