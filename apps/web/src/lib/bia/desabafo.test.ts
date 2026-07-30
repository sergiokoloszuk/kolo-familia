import { describe, expect, it } from "vitest";
import { ehDesabafoPuro } from "./desabafo";
import { inferirDominio } from "./contexto-ayla";
import { contextoTemSinalDeRisco } from "./pontuacao";

/**
 * O critério de desabafo puro, testado como ele roda de verdade: o domínio vem
 * de `inferirDominio` e o risco de `contextoTemSinalDeRisco`, exatamente como em
 * `carregarBlocoBia`. Testar com o domínio escrito à mão esconderia o erro mais
 * provável — a pista de domínio que não existe.
 */
function decidir(texto: string): boolean {
  return ehDesabafoPuro({
    texto,
    dominio: inferirDominio(texto),
    temRisco: contextoTemSinalDeRisco({ textoDaConversa: texto }),
  });
}

describe("desabafo puro — a BIA fica quieta", () => {
  it("cansaço e esgotamento da mãe, sem nada concreto", () => {
    expect(decidir("hoje eu não aguento mais, tô exausta")).toBe(true);
    expect(decidir("tô muito cansada essa semana")).toBe(true);
    expect(decidir("me sinto sozinha nisso tudo")).toBe(true);
    expect(decidir("chorei o dia todo, tô no meu limite")).toBe(true);
    expect(decidir("eu queria só desabafar um pouco")).toBe(true);
    expect(decidir("me sinto uma mãe fracassada, tão incapaz")).toBe(true);
  });

  it("o critério é ausência de conteúdo, não uma lista de frases", () => {
    // Nenhuma destas aparece em lugar nenhum do módulo.
    expect(decidir("ultimamente tô saturada, sem forças")).toBe(true);
    expect(decidir("acho que não consigo mais, tô angustiada")).toBe(true);
  });

  it("sofrimento grave do adulto também é do Core, não da BIA", () => {
    // Conhecimento técnico sobre a criança seria a resposta errada aqui.
    expect(decidir("não aguento mais essa vida, tô acabada")).toBe(true);
  });
});

describe("desabafo COM problema concreto — a BIA roda", () => {
  it("um único termo concreto basta para liberar", () => {
    expect(decidir("não aguento mais, ele não dorme há três noites")).toBe(false);
    expect(decidir("tô exausta, ele grita o dia inteiro")).toBe(false);
    expect(decidir("cansada demais, a escola ligou de novo")).toBe(false);
    expect(decidir("tô no limite com as crises dele")).toBe(false);
    expect(decidir("me sinto péssima, ele só come arroz")).toBe(false);
    expect(decidir("exausta, ele não fala nenhuma palavra ainda")).toBe(false);
  });

  it("os cinco temas citados na decisão de produto passam", () => {
    for (const relato of [
      "tô cansada, o sono dele tá horrível",
      "não aguento mais as crises",
      "exausta com a alimentação dele",
      "esgotada, a professora reclamou de novo",
      "tô no limite, ele não se comunica",
    ]) {
      expect(decidir(relato), relato).toBe(false);
    }
  });

  it("um domínio explícito de quem chama sempre libera", () => {
    expect(ehDesabafoPuro({ texto: "tô exausta", dominio: "sono" })).toBe(false);
  });
});

describe("desabafo COM sinal de alerta — segurança nunca é silenciada", () => {
  it("risco passa mesmo sem nenhum termo concreto além dele", () => {
    expect(decidir("tô exausta, ele perdeu as palavras que já falava")).toBe(false);
    expect(decidir("cansada demais, ele se machuca quando fica bravo")).toBe(false);
    expect(decidir("no meu limite, ele não come há dois dias")).toBe(false);
    expect(decidir("tô esgotada, teve bullying na escola")).toBe(false);
  });

  it("a porta de risco vem ANTES de qualquer outra", () => {
    // Sem domínio e sem termo concreto — só o risco segura.
    expect(
      ehDesabafoPuro({ texto: "tô exausta", dominio: null, temRisco: true }),
    ).toBe(false);
  });
});

describe("bordas", () => {
  it("saudação não é desabafo — o retriever já devolve vazio sozinho", () => {
    expect(decidir("oi Ayla, tudo bem?")).toBe(false);
    expect(decidir("")).toBe(false);
  });

  it("termo desconhecido conta como concreto — errar libera, não silencia", () => {
    expect(decidir("tô exausta com a xilofagia dele")).toBe(false);
  });
});

describe("a solidão da mãe não é a socialização da criança", () => {
  it("'me sinto sozinha' é desabafo; 'brinca sozinho' é domínio", () => {
    expect(inferirDominio("me sinto sozinha nisso tudo")).toBeNull();
    expect(inferirDominio("ele brinca sozinho o tempo todo")).toBe("socializacao");
    expect(decidir("tô exausta, ele fica sozinho no recreio")).toBe(false);
  });
});
