import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PEND-186 — FALHA TÉCNICA NÃO PODE VIRAR DECISÃO DA AYLA.
 *
 * ⚠️ O DEFEITO, medido em 09-10/09/2026. `gpt-5.6-luna` é modelo de raciocínio:
 * os tokens de pensamento contam no orçamento e não aparecem no texto. Com
 * `maxTokens: 300`, o raciocínio consumia os 300 e a resposta voltava com
 * `finish_reason: "length"` e **zero caractere** de conteúdo. Não era JSON
 * truncado — era JSON que nunca começou.
 *
 * `interpretar` caía no neutro e `decidirTurno` devolvia `origem: "gpt"`,
 * afirmando que o modelo decidira "nada". Medido em produção: **21,5% de 79
 * chamadas** (17) bateram exatamente no teto. E não morre só `skills`: o neutro
 * zera intenção, pedido explícito, continuidade, tema e necessidade de
 * conhecimento — um "cria uma rotina visual" explícito seria ignorado.
 *
 * ⚠️ POR QUE OS TESTES SÃO SOBRE ESTADO, E NÃO SOBRE O NÚMERO. Subir o teto
 * sozinho não corrige a classe: continuaria existindo um estado em que a
 * chamada tem sucesso, volta vazia, e o sistema chama isso de decisão. O que
 * estes testes prendem é a DISTINÇÃO.
 */

const eventos: Array<{ kind: string; severity?: string; payload?: Record<string, unknown> }> = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; severity?: string; payload?: Record<string, unknown> }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async () => {} }));

/** O que o provider vai devolver, e o que ele RECEBEU. */
const roteiro: { respostas: Array<{ texto: string; motivo: string | null }>; pedidos: unknown[] } = {
  respostas: [],
  pedidos: [],
};

vi.mock("@/lib/ia/provider", () => ({
  MODELO_CONVERSA: { anthropic: "claude-sonnet-4-6", openai: "gpt-5.6-luna" },
  gerarConversacional: async (p: unknown) => {
    roteiro.pedidos.push(p);
    const r = roteiro.respostas.shift() ?? { texto: "", motivo: "length" };
    return {
      texto: r.texto,
      motivoDeParada: r.motivo,
      tokensIn: 1000,
      tokensOut: 900,
      cacheRead: 0,
      cacheWrite: 0,
      ms: 1200,
      provider: "openai",
      model: "gpt-5.6-luna",
    };
  },
}));

const { decidirTurno } = await import("./decisao-do-turno");

const CATALOGO = [
  { name: "emocional", routing_keywords: ["gritou", "crise"] },
  { name: "rotina", routing_keywords: ["transição", "banho"] },
];

const DECISAO_BOA = JSON.stringify({
  intencao: "rotina_criar",
  pedido_explicito: true,
  tema: "sair de casa",
  aceite: null,
  continuacao: false,
  skills: ["rotina"],
  necessidade_conhecimento: "boas_praticas",
  tema_conhecimento: "transição de saída",
});

const chamar = () =>
  decidirTurno({
    texto: "Cria uma rotina visual para a Manu sair de casa.",
    blocoEstado: "<estado>sujeito: Manu</estado>",
    catalogoSkills: CATALOGO,
    familyId: "fam-1",
  });

beforeEach(() => {
  eventos.length = 0;
  roteiro.respostas = [];
  roteiro.pedidos = [];
});

describe("PEND-186 · o decisor distingue decisão de falha", () => {
  it("resposta boa → origem gpt, e a decisão inteira sobrevive", async () => {
    roteiro.respostas = [{ texto: DECISAO_BOA, motivo: "stop" }];
    const d = await chamar();
    expect(d.origem).toBe("gpt");
    expect(d.intencao).toBe("rotina_criar");
    expect(d.pedidoExplicito).toBe(true);
    expect(d.skills).toEqual(["rotina"]);
    expect(roteiro.pedidos.length, "não deveria ter havido retry").toBe(1);
    expect(eventos.length, "sucesso não gera alarme").toBe(0);
  });

  it("CONTEÚDO VAZIO com finish=length → tenta de novo, e a segunda salva o turno", async () => {
    // ⚠️ É O CASO REAL DA KARINA: sucesso de rede, `finish_reason: "length"`,
    // zero caractere. Uma tentativa a mais é barata perto de perder a intenção,
    // o pedido explícito e a continuidade.
    roteiro.respostas = [
      { texto: "", motivo: "length" },
      { texto: DECISAO_BOA, motivo: "stop" },
    ];
    const d = await chamar();
    expect(roteiro.pedidos.length).toBe(2);
    expect(d.origem).toBe("gpt");
    expect(d.pedidoExplicito, "o pedido explícito da família sumiu por falha técnica").toBe(true);
    expect(d.intencao).toBe("rotina_criar");
  });

  it("A RETRY USA O MESMO PEDIDO — nada pode divergir entre as duas", async () => {
    roteiro.respostas = [
      { texto: "", motivo: "length" },
      { texto: DECISAO_BOA, motivo: "stop" },
    ];
    await chamar();
    expect(roteiro.pedidos[0]).toEqual(roteiro.pedidos[1]);
  });

  it("as DUAS vazias → origem sem_resposta, NUNCA gpt", async () => {
    roteiro.respostas = [
      { texto: "", motivo: "length" },
      { texto: "", motivo: "length" },
    ];
    const d = await chamar();
    expect(d.origem, "falha técnica sendo vendida como decisão do modelo").toBe("sem_resposta");
    expect(d.origem).not.toBe("gpt");
    expect(d.skillsAvaliadas).toBe(false);
  });

  it("a falha vira EVENTO PERSISTIDO, com o motivo e o que se perdeu", async () => {
    roteiro.respostas = [
      { texto: "", motivo: "length" },
      { texto: "", motivo: "length" },
    ];
    await chamar();
    const alarme = eventos.find((e) => e.kind === "decisao_turno_sem_resposta");
    expect(alarme, "um em cada cinco turnos perdia a decisão sem deixar rastro").toBeTruthy();
    expect(alarme?.severity).toBe("error");
    expect(alarme?.payload?.motivo_de_parada).toBe("length");
    expect(alarme?.payload?.tentativas).toBe(2);
    expect(alarme?.payload?.campos_perdidos).toContain("pedido_explicito");
    expect(alarme?.payload?.campos_perdidos).toContain("intencao");
    // Nada do que a família escreveu pode entrar no alarme.
    expect(JSON.stringify(alarme?.payload ?? {})).not.toContain("Manu");
  });

  it("JSON ILEGÍVEL também não é decisão — mesma classe, outra forma", async () => {
    roteiro.respostas = [
      { texto: "desculpe, não consigo responder isso", motivo: "stop" },
      { texto: "ainda não consigo", motivo: "stop" },
    ];
    const d = await chamar();
    expect(d.origem).toBe("sem_resposta");
  });

  it("exceção na chamada continua sendo fallback_neutro — são causas diferentes", async () => {
    // ⚠️ Rede caiu ≠ modelo devolveu vazio. Fundir os dois num rótulo só
    // devolveria a ambiguidade que esta frente veio desfazer.
    const { gerarConversacional } = (await import("@/lib/ia/provider")) as unknown as {
      gerarConversacional: unknown;
    };
    void gerarConversacional;
    roteiro.respostas = [];
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    const mod = await import("@/lib/ia/provider");
    const original = mod.gerarConversacional;
    (mod as { gerarConversacional: unknown }).gerarConversacional = async () => {
      throw new Error("rede caiu");
    };
    const d = await chamar();
    (mod as { gerarConversacional: unknown }).gerarConversacional = original;
    espiao.mockRestore();
    expect(d.origem).toBe("fallback_neutro");
    expect(d.skillsAvaliadas).toBe(false);
  });
});

describe("PEND-186 · a configuração que elimina a classe", () => {
  /**
   * ⚠️ MEDIDO, NÃO ESCOLHIDO. Bancada de 10/09/2026 com o modelo real, 8
   * execuções por configuração, sobre o turno real da Karina:
   *
   *   A · 300 (atual)              7/8 · out médio 225 · 3174ms
   *   B · 900                      8/8 · out médio 235 · 3343ms
   *   C · 300 + low                8/8 · out médio 164 · 3584ms
   *   D · 900 + schema             8/8 · out médio 252 · 3911ms
   *   E · 900 + low + schema       8/8 · out médio 101 · 1389ms
   *
   * E vence nos três eixos ao mesmo tempo. E numa bancada de conteúdo com 12
   * casos — incluindo pedidos explícitos de rotina, plano e edição — A e E
   * acertaram 12/12: baixar o esforço de raciocínio não degradou o juízo.
   */
  it("o pedido leva esforço baixo, schema estrito e orçamento medido", async () => {
    roteiro.respostas = [{ texto: DECISAO_BOA, motivo: "stop" }];
    await chamar();
    const p = roteiro.pedidos[0] as {
      maxTokens: number;
      esforcoRaciocinio: string;
      formatoJson: { json_schema: { strict: boolean; schema: { required: string[] } } };
    };
    expect(p.esforcoRaciocinio).toBe("low");
    expect(p.maxTokens).toBe(900);
    expect(p.formatoJson.json_schema.strict).toBe(true);
    // O schema tem que cobrir TODOS os campos: um que fique de fora volta a ser
    // opcional para o modelo, e volta a poder faltar.
    for (const campo of [
      "intencao",
      "pedido_explicito",
      "tema",
      "aceite",
      "continuacao",
      "skills",
      "necessidade_conhecimento",
      "tema_conhecimento",
    ]) {
      expect(p.formatoJson.json_schema.schema.required).toContain(campo);
    }
  });

  it("o schema garante a FORMA; `interpretar` continua garantindo o DOMÍNIO", async () => {
    // Uma intenção fora do enum, uma skill fora do catálogo: o schema pode ser
    // burlado por um provider que o ignore, e a segunda camada tem que segurar.
    roteiro.respostas = [
      {
        texto: JSON.stringify({
          intencao: "inventada",
          pedido_explicito: "sim",
          skills: ["nao_existe", "emocional"],
          necessidade_conhecimento: "magia",
        }),
        motivo: "stop",
      },
    ];
    const d = await chamar();
    expect(d.intencao).toBe("outro");
    expect(d.pedidoExplicito, "string 'sim' virou true").toBe(false);
    expect(d.skills).toEqual(["emocional"]);
    expect(d.necessidadeConhecimento).toBe("nenhum");
  });
});
