import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  estado: vi.fn(),
  preco: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("./estado-black-friday", () => ({ lerEstadoBlackFriday: mocks.estado }));
vi.mock("./oferta-black-friday", () => ({ lerOfertaBlackFridayNoStripe: mocks.preco }));

import {
  podeSolicitarTrialBlackFriday,
  resolverOfertaDaFamilia,
  resolverSituacaoBlackFridayDaFamilia,
} from "./oferta-familia";

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

  it("não confunde falha do Stripe com direito a um segundo trial", async () => {
    mocks.preco.mockResolvedValue({ ok: false, priceId: null, problema: "errado" });
    await expect(resolverSituacaoBlackFridayDaFamilia(
      { rpc: mocks.rpc } as never,
      new Date("2026-11-30T12:00:00Z"),
    )).resolves.toMatchObject({
      estado: "ativa",
      consultaConfiavel: true,
      participa: true,
      direitoAoPreco: true,
      oferta: null,
    });
  });

  it("fecha a reentrada quando a consulta da participação falha", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "indisponível" } });
    const situacao = await resolverSituacaoBlackFridayDaFamilia(
      { rpc: mocks.rpc } as never,
      new Date("2026-11-15T12:00:00Z"),
    );
    expect(situacao).toMatchObject({
      estado: "ativa",
      consultaConfiavel: false,
      oferta: null,
    });
    expect(podeSolicitarTrialBlackFriday({
      assinatura: { status: "canceled" },
      consultaConfiavel: situacao.consultaConfiavel,
      jaParticipa: situacao.participa,
      estado: situacao.estado,
      agora: new Date("2026-11-15T12:00:00Z"),
    })).toBe(false);
  });
});

describe("reentrada voluntária no trial da Black Friday", () => {
  const agora = new Date("2026-11-15T12:00:00Z");

  it.each([
    { status: "trialing", trial_ends_at: "2026-11-14T12:00:00Z" },
    { status: "canceled" },
    { status: "past_due", pagamento_falhou_em: null },
  ])("deixa conta elegível alcançar a ativação mesmo sem acesso: $status", (assinatura) => {
    expect(podeSolicitarTrialBlackFriday({
      assinatura,
      consultaConfiavel: true,
      jaParticipa: false,
      estado: "ativa",
      agora,
    })).toBe(true);
  });

  it.each([
    { nome: "assinante paga", assinatura: { status: "active" } },
    { nome: "trial ainda em curso", assinatura: { status: "trialing", trial_ends_at: "2026-11-16T12:00:00Z" } },
    { nome: "pagamento em recuperação", assinatura: { status: "past_due", pagamento_falhou_em: "2026-11-14T12:00:00Z" } },
    { nome: "cortesia vigente", assinatura: { status: "canceled", cortesia: true, cortesia_ate: "2026-12-01T12:00:00Z" } },
  ])("exclui $nome", ({ assinatura }) => {
    expect(podeSolicitarTrialBlackFriday({
      assinatura,
      consultaConfiavel: true,
      jaParticipa: false,
      estado: "ativa",
      agora,
    })).toBe(false);
  });

  it("não oferece fora de novembro, com campanha desligada ou após participação", () => {
    const assinatura = { status: "canceled" };
    expect(podeSolicitarTrialBlackFriday({ assinatura, consultaConfiavel: true, jaParticipa: false, estado: "desligada", agora })).toBe(false);
    expect(podeSolicitarTrialBlackFriday({ assinatura, consultaConfiavel: true, jaParticipa: true, estado: "ativa", agora })).toBe(false);
    expect(podeSolicitarTrialBlackFriday({
      assinatura,
      consultaConfiavel: true,
      jaParticipa: false,
      estado: "ativa",
      agora: new Date("2026-12-01T03:00:00Z"),
    })).toBe(false);
  });

  it("expõe a ativação também no bloqueio global que intercepta a assinatura", () => {
    const gate = readFileSync(
      join(import.meta.dirname, "../../app/(app)/trial-gate.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      join(import.meta.dirname, "../../app/(app)/layout.tsx"),
      "utf8",
    );
    const assinatura = readFileSync(
      join(import.meta.dirname, "../../app/(app)/assinatura/page.tsx"),
      "utf8",
    );
    expect(gate).toMatch(/form action=\{ativarMeuTrialBlackFriday\}/);
    expect(gate).toMatch(/Ativar meus \{BLACK_FRIDAY_2026\.diasTrial\} dias/);
    expect(layout).toMatch(/podePedirTrialBlackFriday=\{podePedirTrialBlackFriday\}/);
    expect(layout).toMatch(/ofertaBlackFriday=\{Boolean\(ofertaBlackFriday\)\}/);
    expect(layout).toMatch(/ofertaBlackFridayIndisponivel=\{ofertaBlackFridayIndisponivel\}/);
    expect(gate).toMatch(/Não vamos trocar sua oferta pelo preço normal/);
    expect(assinatura).toMatch(/situacaoBlackFriday\.direitoAoPreco\s*\? BLACK_FRIDAY_2026\.valorCentavos/);
  });
});
