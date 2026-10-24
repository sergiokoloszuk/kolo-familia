import { beforeEach, describe, expect, it, vi } from "vitest";
import { BLACK_FRIDAY_2026 } from "./black-friday-2026";

const mocks = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({ prices: { retrieve: mocks.retrieve } }),
}));

import {
  conferirOfertaBlackFriday,
  lerOfertaBlackFridayNoStripe,
} from "./oferta-black-friday";

const certo = {
  id: BLACK_FRIDAY_2026.priceIdAprovado,
  active: true,
  currency: "brl",
  unit_amount: 3990,
  recurring: { interval: "month", interval_count: 1 },
};

describe("trava do preço Black Friday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_ID_BLACK_FRIDAY = BLACK_FRIDAY_2026.priceIdAprovado;
  });

  it("aceita somente o price aprovado com R$ 39,90 mensais", () => {
    expect(conferirOfertaBlackFriday(certo)).toEqual({
      ok: true,
      priceId: BLACK_FRIDAY_2026.priceIdAprovado,
      valorCentavos: 3990,
      problema: null,
    });
  });

  it.each([
    [{ ...certo, active: false }, /arquivado/],
    [{ ...certo, currency: "usd" }, /reais/],
    [{ ...certo, unit_amount: 39900 }, /39,90/],
    [{ ...certo, recurring: { interval: "year", interval_count: 1 } }, /uma vez por mês/],
    [{ ...certo, recurring: null }, /uma vez por mês/],
  ] as const)("recusa preço incompatível", (price, motivo) => {
    expect(conferirOfertaBlackFriday(price).ok).toBe(false);
    expect(conferirOfertaBlackFriday(price).problema).toMatch(motivo);
  });

  it("recusa uma variável que aponte para outro price, mesmo que ele pareça correto", () => {
    expect(conferirOfertaBlackFriday({ ...certo, id: "price_outro" }, "price_outro"))
      .toMatchObject({ ok: false, problema: expect.stringMatching(/não é o preço aprovado/) });
  });

  it("a consulta é apenas de leitura e falha fechada quando o Stripe falha", async () => {
    mocks.retrieve.mockRejectedValue(new Error("provider indisponível"));
    await expect(lerOfertaBlackFridayNoStripe()).resolves.toMatchObject({
      ok: false,
      problema: expect.stringMatching(/Não consegui consultar/),
    });
    expect(mocks.retrieve).toHaveBeenCalledWith(BLACK_FRIDAY_2026.priceIdAprovado);
  });
});
