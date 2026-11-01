import { describe, expect, it } from "vitest";
import { resumoTrialAdmin } from "./resumo-trial";

describe("resumoTrialAdmin", () => {
  it("mantém 7 dias para um trial normal", () => {
    expect(
      resumoTrialAdmin({
        inicioPadrao: "2026-10-29T12:00:00.000Z",
        fim: "2026-11-05T12:00:00.000Z",
        hoje: new Date("2026-11-01T12:00:00.000Z"),
      }),
    ).toEqual({ diasUsados: 4, diasRestantes: 4, duracaoDias: 7 });
  });

  it("mostra 15 dias para quem recebeu a Black Friday", () => {
    expect(
      resumoTrialAdmin({
        inicioPadrao: "2026-10-29T12:00:00.000Z",
        fim: "2026-11-13T12:00:00.000Z",
        hoje: new Date("2026-11-01T12:00:00.000Z"),
        participacaoBlackFriday: {
          trial_inicio_em: "2026-10-29T12:00:00.000Z",
          trial_fim_em: "2026-11-13T12:00:00.000Z",
        },
      }),
    ).toEqual({ diasUsados: 4, diasRestantes: 12, duracaoDias: 15 });
  });

  it("usa a duração normal se o registro promocional estiver incompleto", () => {
    expect(
      resumoTrialAdmin({
        inicioPadrao: "2026-10-29T12:00:00.000Z",
        fim: "2026-11-05T12:00:00.000Z",
        hoje: new Date("2026-11-01T12:00:00.000Z"),
        participacaoBlackFriday: { trial_inicio_em: null, trial_fim_em: null },
      }).duracaoDias,
    ).toBe(7);
  });
});
