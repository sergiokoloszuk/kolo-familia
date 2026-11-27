import { describe, expect, it } from "vitest";
import { calcularMarcosJornada, classificarCanalAtribuicao } from "./jornada-regras";

const origem = (extra: Partial<Parameters<typeof classificarCanalAtribuicao>[0]> = {}) => ({
  afiliado_id: null,
  ref_codigo: null,
  utm_source: null,
  utm_medium: null,
  ...extra,
});
describe("atribuição de origem", () => {
  it("não chama Base44 de tráfego pago", () => {
    expect(classificarCanalAtribuicao(origem({ utm_source: "base44", utm_medium: "landing_page" })))
      .toBe("landing_sem_canal");
  });

  it("reconhece fonte explicitamente paga", () => {
    expect(classificarCanalAtribuicao(origem({ utm_source: "facebookads" }))).toBe(
      "trafego_pago",
    );
  });

  it("medium pago classifica uma fonte social como paga", () => {
    expect(
      classificarCanalAtribuicao(origem({ utm_source: "instagram", utm_medium: "paid_social" })),
    ).toBe("trafego_pago");
  });

  it("social sem medium pago não vira anúncio por suposição", () => {
    expect(classificarCanalAtribuicao(origem({ utm_source: "instagram" }))).toBe(
      "organico_social",
    );
  });

  it("separa parceria, convite, afiliado, ausência e fonte desconhecida", () => {
    expect(classificarCanalAtribuicao(origem({ utm_source: "escalasaas" }))).toBe("parceria");
    expect(classificarCanalAtribuicao(origem({ ref_codigo: "CONVITE" }))).toBe("convite");
    expect(classificarCanalAtribuicao(origem({ afiliado_id: "af-1" }))).toBe("afiliado");
    expect(classificarCanalAtribuicao(origem())).toBe("sem_origem");
    expect(classificarCanalAtribuicao(origem({ utm_source: "fonte-nova" }))).toBe(
      "desconhecido",
    );
  });
});

describe("marcos cumulativos da jornada", () => {
  it("reproduz a ordem cadastrou → iniciou → concluiu → valor → engajou", () => {
    expect(
      calcularMarcosJornada({
        onboardingCompleted: true,
        onboardingStep: 7,
        usos: 2,
        temPlano: false,
        falouComAyla: false,
      }),
    ).toEqual({
      iniciouOnboarding: true,
      concluiuOnboarding: true,
      recebeuPrimeiroValor: true,
      engajou: true,
    });
  });

  it("plano antigo conta como valor, mas nunca pula onboarding", () => {
    expect(
      calcularMarcosJornada({
        onboardingCompleted: false,
        onboardingStep: 1,
        usos: 0,
        temPlano: true,
        falouComAyla: false,
      }),
    ).toEqual({
      iniciouOnboarding: false,
      concluiuOnboarding: false,
      recebeuPrimeiroValor: false,
      engajou: false,
    });
  });

  it("conversa e plano juntos engajam somente depois do onboarding", () => {
    const marcos = calcularMarcosJornada({
      onboardingCompleted: true,
      onboardingStep: 7,
      usos: 0,
      temPlano: true,
      falouComAyla: true,
    });
    expect(marcos.recebeuPrimeiroValor).toBe(true);
    expect(marcos.engajou).toBe(true);
  });

  it("garante por construção que uma etapa nunca supera a anterior", () => {
    const casos = [
      { onboardingCompleted: false, onboardingStep: 1, usos: 4, temPlano: true, falouComAyla: true },
      { onboardingCompleted: false, onboardingStep: 3, usos: 2, temPlano: false, falouComAyla: false },
      { onboardingCompleted: true, onboardingStep: 7, usos: 0, temPlano: false, falouComAyla: false },
      { onboardingCompleted: true, onboardingStep: 7, usos: 1, temPlano: false, falouComAyla: false },
    ];

    for (const caso of casos) {
      const m = calcularMarcosJornada(caso);
      expect(Number(m.concluiuOnboarding)).toBeLessThanOrEqual(Number(m.iniciouOnboarding));
      expect(Number(m.recebeuPrimeiroValor)).toBeLessThanOrEqual(Number(m.concluiuOnboarding));
      expect(Number(m.engajou)).toBeLessThanOrEqual(Number(m.recebeuPrimeiroValor));
    }
  });
});
