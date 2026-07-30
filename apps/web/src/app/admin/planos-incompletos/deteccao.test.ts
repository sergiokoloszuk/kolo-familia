import { describe, it, expect } from "vitest";
import { estaAmputado } from "./deteccao";

const sec = (tipo: string, conteudo = "conteúdo de verdade") => ({
  tipo,
  titulo: "",
  conteudo_markdown: conteudo,
});

describe("estaAmputado", () => {
  it("marca o caso real: só entender + observar (o que aconteceu com 12 planos)", () => {
    expect(estaAmputado([sec("entender"), sec("observar")])).toBe(true);
  });

  it("marca plano com uma prática só (4 planos ficaram assim)", () => {
    expect(estaAmputado([sec("entender"), sec("diferente"), sec("observar")])).toBe(true);
  });

  it("aceita plano com práticas suficientes mesmo sem o 'o que fazer diferente'", () => {
    expect(
      estaAmputado([sec("crencas"), sec("brincadeiras"), sec("atividades"), sec("frases")]),
    ).toBe(false);
  });

  it("aceita o plano completo", () => {
    expect(
      estaAmputado([
        sec("entender"),
        sec("crencas"),
        sec("diferente"),
        sec("brincadeiras"),
        sec("observar"),
      ]),
    ).toBe(false);
  });

  it("ignora seção com conteúdo vazio (não conta como prática)", () => {
    expect(
      estaAmputado([sec("diferente"), sec("crencas", "  "), sec("brincadeiras", "")]),
    ).toBe(true);
  });

  it("não trata plano em geração nem plano já sinalizado como erro", () => {
    expect(estaAmputado([])).toBe(false);
    expect(estaAmputado([sec("__erro__")])).toBe(false);
    expect(estaAmputado(null)).toBe(false);
  });
});
