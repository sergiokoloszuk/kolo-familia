import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  estado: vi.fn(),
  preco: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("./estado-black-friday", () => ({ lerEstadoBlackFriday: mocks.estado }));
vi.mock("./oferta-black-friday", () => ({ lerOfertaBlackFridayNoStripe: mocks.preco }));

import { resolverOfertaDaFamilia } from "./oferta-familia";

describe("oferta individual no checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.estado.mockResolvedValue("ativa");
    mocks.preco.mockResolvedValue({ ok: true, priceId: "price_bf", valorCentavos: 3990, problema: null });
    mocks.rpc.mockResolvedValue({ data: [{
      participa: true,
      trial_fim_em: "2026-12-10T03:00:00Z",
      oferta_fim_exclusivo: "2026-12-11T03:00:00Z",
    }], error: null });
  });

  it("usa apenas a participação autenticada e devolve sessão de 30 minutos", async () => {
    const oferta = await resolverOfertaDaFamilia({ rpc: mocks.rpc } as never, new Date("2026-11-30T12:00:00Z"));
    expect(mocks.rpc).toHaveBeenCalledWith("minha_oferta_black_friday_2026");
    expect(oferta).toMatchObject({
      priceId: "price_bf",
      valorCentavos: 3990,
      trialFimEm: "2026-12-10T03:00:00Z",
      checkoutIniciadoEm: "2026-11-30T12:00:00.000Z",
      checkoutExpiraEm: "2026-11-30T12:30:00.000Z",
    });
  });

  it("mantém a oferta adquirida quando novas entradas estão pausadas", async () => {
    mocks.estado.mockResolvedValue("pausada");
    await expect(resolverOfertaDaFamilia({ rpc: mocks.rpc } as never, new Date("2026-11-30T12:00:00Z")))
      .resolves.not.toBeNull();
  });

  it.each(["desligada", "encerrada"])("falha fechada no estado %s", async (estado) => {
    mocks.estado.mockResolvedValue(estado);
    await expect(resolverOfertaDaFamilia({ rpc: mocks.rpc } as never, new Date("2026-11-30T12:00:00Z")))
      .resolves.toBeNull();
    expect(mocks.preco).not.toHaveBeenCalled();
  });

  it("não oferece depois do prazo individual", async () => {
    await expect(resolverOfertaDaFamilia({ rpc: mocks.rpc } as never, new Date("2026-12-11T03:00:00Z")))
      .resolves.toBeNull();
  });

  it("não oferece se o Stripe não confirmar o preço", async () => {
    mocks.preco.mockResolvedValue({ ok: false, priceId: null, problema: "errado" });
    await expect(resolverOfertaDaFamilia({ rpc: mocks.rpc } as never, new Date("2026-11-30T12:00:00Z")))
      .resolves.toBeNull();
  });
});
