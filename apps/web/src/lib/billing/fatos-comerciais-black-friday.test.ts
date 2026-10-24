import { describe, expect, it } from "vitest";
import { FATOS_COMERCIAIS, fatosComerciaisParaFamilia } from "./fatos-comerciais";

function banco(resultado: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => resultado,
  };
  return { from: () => builder } as never;
}

describe("fato comercial individual da Black Friday", () => {
  it("mantém 7 dias como regra normal quando não há prova individual", async () => {
    const texto = await fatosComerciaisParaFamilia(banco({ data: null, error: null }), "familia");
    expect(texto).toBe(FATOS_COMERCIAIS);
    expect(texto).toMatch(/7 dias/);
  });

  it("informa 15 dias e R$ 39,90 apenas para uma participação registrada", async () => {
    const texto = await fatosComerciaisParaFamilia(banco({ data: {
      trial_fim_em: "2026-12-10T12:00:00Z",
      oferta_fim_exclusivo: "2026-12-11T03:00:00Z",
    }, error: null }), "familia");
    expect(texto).toMatch(/esta família recebeu 15 dias completos/);
    expect(texto).toMatch(/R\$ 39,90/);
    expect(texto).toMatch(/primeira cobrança ocorre depois/);
  });

  it("erro de banco não inventa campanha", async () => {
    await expect(fatosComerciaisParaFamilia(banco({ data: null, error: { message: "sem tabela" } }), "familia"))
      .resolves.toBe(FATOS_COMERCIAIS);
  });
});
