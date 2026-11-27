import { describe, expect, it } from "vitest";
import { atribuicaoEhTeste } from "./internos";

describe("atribuicaoEhTeste", () => {
  it.each([
    ["escalasaas", "testedeutm"],
    ["escalasaas", "testedeonboarding"],
    ["escalasaas", "testedeonboardingmobile"],
    ["escalasaasgravação", "gravação"],
  ])("exclui a evidência conhecida de teste (%s / %s)", (utm_source, utm_campaign) => {
    expect(atribuicaoEhTeste({ utm_source, utm_campaign })).toBe(true);
  });

  it("não exclui uma eventual indicação real da Escala SaaS", () => {
    expect(
      atribuicaoEhTeste({ utm_source: "escalasaas", utm_campaign: "indicacao_clientes" }),
    ).toBe(false);
  });

  it("não exclui campanhas reais de tráfego", () => {
    expect(
      atribuicaoEhTeste({ utm_source: "facebookads", utm_campaign: "black_friday_2026" }),
    ).toBe(false);
  });
});
