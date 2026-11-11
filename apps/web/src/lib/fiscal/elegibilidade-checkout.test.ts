import { describe, expect, it } from "vitest";
import { jaPossuiAssinaturaOuCheckoutConcluido } from "./elegibilidade-checkout";

describe("elegibilidade para criar checkout", () => {
  it.each([
    { status: "active" },
    { status: "trialing", stripeSubscriptionId: "sub_trial" },
    { status: "trialing", checkoutConcluidoEm: "2026-11-11T12:00:00.000Z" },
  ])("bloqueia assinatura ou checkout já existente", (estado) => {
    expect(jaPossuiAssinaturaOuCheckoutConcluido(estado)).toBe(true);
  });

  it.each([
    { status: "trialing" },
    { status: "canceled" },
    { status: "canceled", stripeSubscriptionId: "sub_antiga" },
    { status: "past_due" },
  ])("não bloqueia sem vínculo nem conclusão: $status", (estado) => {
    expect(jaPossuiAssinaturaOuCheckoutConcluido(estado)).toBe(false);
  });
});
