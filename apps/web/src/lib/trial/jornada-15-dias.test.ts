import { describe, expect, it } from "vitest";
import { estadoTrialDe, type LinhaAssinatura } from "./estado";
import { blocoDaJornada, intencaoDoDia } from "./jornada";

const DIA = 24 * 60 * 60 * 1000;
const INICIO = Date.parse("2026-11-10T12:00:00.000Z");

function trialDe(dias: 7 | 15, diaAtual: number): ReturnType<typeof estadoTrialDe> {
  const linha: LinhaAssinatura = {
    status: "trialing",
    created_at: new Date(INICIO).toISOString(),
    trial_ends_at: new Date(INICIO + dias * DIA).toISOString(),
  };
  return estadoTrialDe(linha, INICIO + diaAtual * DIA + 60_000);
}

describe("jornada relativa ao fim do trial", () => {
  it("um trial de 15 dias mostra o dia real, sem ficar preso no dia 7", () => {
    const estado = trialDe(15, 10);
    const bloco = blocoDaJornada(estado);
    expect(estado.dia).toBe(10);
    expect(estado.diasRestantes).toBe(5);
    expect(bloco).toContain("Dia 10 de 15");
    expect(bloco).toContain("Demonstrar continuidade");
  });

  it("os quatro últimos dias preservam a mesma ordem nos trials de 7 e 15 dias", () => {
    for (const dias of [7, 15] as const) {
      expect(intencaoDoDia(dias - 4, 4)).toBe(4);
      expect(intencaoDoDia(dias - 3, 3)).toBe(5);
      expect(intencaoDoDia(dias - 2, 2)).toBe(6);
      expect(intencaoDoDia(dias - 1, 1)).toBe(7);
    }
  });

  it("no último dia, uma recusa gera só uma pergunta opcional e proíbe insistência", () => {
    const bloco = blocoDaJornada(trialDe(15, 14));
    expect(bloco).toContain("SE ELA DISSER QUE NÃO QUER CONTINUAR");
    expect(bloco).toMatch(/pergunte uma única vez/i);
    expect(bloco).toContain("não insista");
  });
});
