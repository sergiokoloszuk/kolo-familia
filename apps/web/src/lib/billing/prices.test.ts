import { describe, it, expect } from "vitest";
import { PRICE_TABLE, calcularCustoTokens } from "./prices";

/**
 * O CUSTO NÃO PODE MENTIR — 06/08/2026.
 *
 * `calcularCustoTokens` devolve 0 para modelo desconhecido, de propósito: uma
 * chamada nova nunca deve explodir por falta de linha na tabela. O efeito
 * colateral é perigoso na hora de decidir uma migração — se o modelo GPT não
 * estiver cadastrado, o `/admin/uso-api` mostra a troca como se fosse de
 * graça, e a decisão de custo é tomada em cima de um zero falso.
 *
 * Este arquivo é a trava: todo modelo de TEXTO que o produto pode chamar
 * precisa estar na tabela com preço > 0.
 */

/**
 * Os modelos de texto que a camada conversacional pode usar. Ao ligar um
 * provider novo, o nome entra aqui — e o teste falha até o preço ser cadastrado.
 */
const MODELOS_DE_TEXTO = [
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-opus-4-7",
  "gpt-5.6-luna",
] as const;

describe("nenhum modelo de texto pode custar zero", () => {
  for (const modelo of MODELOS_DE_TEXTO) {
    it(`${modelo} está na PRICE_TABLE`, () => {
      expect(PRICE_TABLE[modelo]).toBeDefined();
      expect(PRICE_TABLE[modelo].kind).toBe("token");
    });

    it(`${modelo} cobra por entrada E por saída`, () => {
      const custo = calcularCustoTokens(modelo, 1_000_000, 0);
      const saida = calcularCustoTokens(modelo, 0, 1_000_000);
      expect(custo).toBeGreaterThan(0);
      expect(saida).toBeGreaterThan(0);
    });
  }

  it("modelo desconhecido continua devolvendo 0 — mas isso é o SINAL, não o normal", () => {
    // O comportamento é intencional (não explodir em produção). O que este
    // arquivo garante é que nenhum modelo REALMENTE usado caia nesse caminho.
    expect(calcularCustoTokens("modelo-que-nao-existe", 1_000_000, 1_000_000)).toBe(0);
  });
});

describe("o preço do GPT saiu da fatura da própria Kolo", () => {
  it("bate com a derivação registrada no comentário", () => {
    const p = PRICE_TABLE["gpt-5.6-luna"];
    if (p.kind !== "token") throw new Error("esperava preço por token");
    // US$ 0,0362 / 145.439 tokens de entrada nova = 0,2489/M
    expect(p.input_per_million).toBeCloseTo(0.249, 3);
    // US$ 0,1000 / 83.374 tokens de saída = 1,1994/M
    expect(p.output_per_million).toBeCloseTo(1.199, 3);
  });

  it("a ordem de grandeza contra o Claude está preservada", () => {
    const gpt = PRICE_TABLE["gpt-5.6-luna"];
    const claude = PRICE_TABLE["claude-sonnet-4-6"];
    if (gpt.kind !== "token" || claude.kind !== "token") throw new Error("token");
    // Se alguém trocar o preço por engano e inverter a relação, o teste avisa:
    // a conclusão de custo da migração depende inteiramente disto.
    expect(gpt.output_per_million).toBeLessThan(claude.output_per_million);
    expect(gpt.input_per_million).toBeLessThan(claude.input_per_million);
  });
});
