import { describe, expect, it } from "vitest";
import { assemblePrompt } from "./prompt";

/**
 * BIA LIGADA × DESLIGADA — a comparação do prompt, mecanizada.
 *
 * A promessa da primeira integração é que ligar a BIA acrescenta contexto e não
 * altera mais nada. Isto prova o lado "não altera mais nada": com a flag
 * desligada `carregarBlocoBia` devolve string vazia, e o prompt tem de sair
 * BYTE A BYTE igual ao de antes da integração.
 *
 * É o teste que pega uma regressão silenciosa — um `\n` a mais no turno do
 * usuário quando não há BIA nenhuma invalidaria cache e mudaria a resposta sem
 * ninguém perceber.
 */

/** Contexto mínimo: o que interessa aqui é o turno, não o corpo do contexto. */
const ctx = {
  familia: {},
  cuidador: {},
  membros: [],
  membroFoco: null,
  historico: [],
  diariosRecentes: [],
  eventos: [],
  experimentos: [],
  boasPraticas: [],
  ultimoCheckin: null,
} as never;

const base = {
  skills: [],
  ctx,
  userInput: "ela acorda toda madrugada",
  modo: { kind: "conversa" } as const,
};

const BLOCO = `<conhecimento_de_apoio>\nInstruções de uso.\n\n1. Despertar noturno pede interação mínima.\n</conhecimento_de_apoio>`;

describe("BIA no prompt", () => {
  it("desligada: prompt idêntico ao de antes da integração", () => {
    const sem = assemblePrompt(base);
    for (const vazio of [undefined, "", "   ", "\n"]) {
      const com = assemblePrompt({ ...base, bia: vazio });
      expect(JSON.stringify(com)).toBe(JSON.stringify(sem));
    }
  });

  it("ligada: acrescenta e não substitui nada", () => {
    const sem = assemblePrompt(base);
    const com = assemblePrompt({ ...base, bia: BLOCO });

    // O system é o cacheado — não pode mudar por causa da BIA.
    expect(JSON.stringify(com.system)).toBe(JSON.stringify(sem.system));

    const texto = (p: ReturnType<typeof assemblePrompt>) =>
      JSON.stringify(p.messages);
    expect(texto(com)).toContain("<conhecimento_de_apoio>");
    // O que já existia continua lá, inteiro.
    expect(texto(com).length).toBeGreaterThan(texto(sem).length);
    expect(texto(com)).toContain("ela acorda toda madrugada");
  });

  it("o bloco vem ANTES da fala da mãe — ela é a última coisa que o modelo lê", () => {
    const p = assemblePrompt({ ...base, bia: BLOCO });
    const turno = JSON.stringify(p.messages);
    expect(turno.indexOf("<conhecimento_de_apoio>")).toBeLessThan(
      turno.indexOf("ela acorda toda madrugada"),
    );
  });
});
