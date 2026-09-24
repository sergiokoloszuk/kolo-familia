import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exigirPlanoCobravel: vi.fn(),
  customersCreate: vi.fn(),
  customersUpdate: vi.fn(),
  listTaxIds: vi.fn(),
  createTaxId: vi.fn(),
  sessionsCreate: vi.fn(),
}));

vi.mock("@/lib/billing/planos", () => ({
  exigirPlanoCobravel: mocks.exigirPlanoCobravel,
}));
vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    customers: {
      create: mocks.customersCreate,
      update: mocks.customersUpdate,
      listTaxIds: mocks.listTaxIds,
      createTaxId: mocks.createTaxId,
    },
    checkout: { sessions: { create: mocks.sessionsCreate } },
  }),
}));

import { criarCheckoutFiscal } from "./checkout";

const dados = {
  plano: "mensal" as const,
  nomeFiscal: "Maria da Silva",
  emailFiscal: "maria@example.com",
  cpf: "529.982.247-25",
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  numero: "1000",
  complemento: "Apto 12",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
};

describe("porta única do checkout fiscal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exigirPlanoCobravel.mockResolvedValue({ priceId: "price_mensal" });
    mocks.customersCreate.mockResolvedValue({ id: "cus_novo" });
    mocks.listTaxIds.mockResolvedValue({ data: [] });
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
  });

  it("salva nome, endereço completo e CPF antes de criar a sessão", async () => {
    const resultado = await criarCheckoutFiscal({
      familyId: "familia-1",
      origin: "https://kolo.test",
      stripeCustomerId: null,
      dados,
    });

    expect(mocks.customersCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Maria da Silva",
      email: "maria@example.com",
      address: expect.objectContaining({
        line1: "Avenida Paulista, 1000",
        line2: "Bairro: Bela Vista · Complemento: Apto 12",
        postal_code: "01310100",
        city: "São Paulo",
        state: "SP",
        country: "BR",
      }),
    }));
    expect(mocks.createTaxId).toHaveBeenCalledWith("cus_novo", {
      type: "br_cpf",
      value: "52998224725",
    });
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_novo" }));
    expect(mocks.customersCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sessionsCreate.mock.invocationCallOrder[0],
    );
    expect(resultado.url).toContain("checkout.stripe.test");
  });

  it("falha antes de tocar no Stripe quando falta um dado obrigatório", async () => {
    await expect(criarCheckoutFiscal({
      familyId: "familia-1",
      origin: "https://kolo.test",
      stripeCustomerId: null,
      dados: { ...dados, bairro: "" },
    })).rejects.toThrow();

    expect(mocks.exigirPlanoCobravel).not.toHaveBeenCalled();
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("atualiza os dados de um Customer existente e não duplica o mesmo CPF", async () => {
    mocks.listTaxIds.mockResolvedValue({
      data: [{ type: "br_cpf", value: "529.982.247-25", created: 1 }],
    });

    await criarCheckoutFiscal({
      familyId: "familia-1",
      origin: "https://kolo.test",
      stripeCustomerId: "cus_existente",
      dados,
    });

    expect(mocks.customersUpdate).toHaveBeenCalledWith(
      "cus_existente",
      expect.objectContaining({ name: "Maria da Silva", address: expect.any(Object) }),
    );
    expect(mocks.createTaxId).not.toHaveBeenCalled();
  });
});
