import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aceitouPerguntasIniciais, perguntaInicial, recusouPerguntasIniciais } from "./primeiro-contato";

describe("primeiro contato opcional", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("aceita somente resposta social inequívoca, nunca um problema concreto", () => {
    for (const texto of ["sim", "Ok", "pode ser", "Claro!", "pode perguntar", "quero responder"]) {
      expect(aceitouPerguntasIniciais(texto)).toBe(true);
    }
    for (const texto of ["sim, ele bateu na irmã", "não", "ele não quer sair", "1"]) {
      expect(aceitouPerguntasIniciais(texto)).toBe(false);
    }
    expect(recusouPerguntasIniciais("agora não")).toBe(true);
    expect(recusouPerguntasIniciais("não, ele tem medo da porta")).toBe(false);
  });

  it("pergunta de observação muda com a idade, sem rastreio nem diagnóstico", () => {
    expect(perguntaInicial({ nome: "Lia", dataNascimento: "2023-02-01" })).toContain("como costuma mostrar");
    expect(perguntaInicial({ nome: "Lia", dataNascimento: "2018-02-01" })).toContain("momento da tarefa");
    expect(perguntaInicial({ nome: "Lia", dataNascimento: "2012-02-01" })).toContain("que tipo de ajuda aceita");
    expect(perguntaInicial({ nome: "Lia", dataNascimento: "1998-02-01", falaPorSi: true })).toContain("você quer tornar");
  });

  it("idade ausente pede só a idade, e não finge conhecer o perfil", () => {
    const texto = perguntaInicial({ nome: "Lia", dataNascimento: null });
    expect(texto).toContain("qual é a idade");
    expect(texto).not.toMatch(/gestação|parto|diagnóstico|contato visual/i);
  });
});
