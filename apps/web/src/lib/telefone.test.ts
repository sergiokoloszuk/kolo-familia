import { describe, it, expect } from "vitest";
import { chaveTelefoneBR } from "./telefone";

/**
 * A normalização de telefone nunca teve teste — e virou suspeita nº 1 num
 * incidente real (02/08/2026), quando um número CADASTRADO foi tratado como
 * desconhecido e o log mostrou a chave `1194770067` para `+5511994770067`.
 *
 * O "9 que sumiu" é DELIBERADO: números antigos (10 dígitos) e novos (11) são o
 * mesmo WhatsApp e precisam colapsar na mesma chave. A função estava correta —
 * o bug era outro (ver `encontrarFamiliaPorTelefone`). Estes testes fixam o
 * contrato para que a próxima investigação não perca tempo aqui de novo.
 */

describe("chaveTelefoneBR — formas do MESMO número colapsam", () => {
  // Todas estas são o mesmo WhatsApp e precisam dar a mesma chave.
  const mesmas = [
    "+5511994770067", // como a Z-API entrega
    "5511994770067", // sem o +
    "+55 (11) 99477-0067", // como uma pessoa digita
    "11994770067", // DDD + celular com 9º dígito
    "1194770067", // legado, sem o 9º dígito
    "+551194770067", // legado com país
    "55 11 9477-0067", // legado, com país e separadores
  ];
  for (const forma of mesmas) {
    it(`"${forma}" → 1194770067`, () => {
      expect(chaveTelefoneBR(forma)).toBe("1194770067");
    });
  }
});

describe("chaveTelefoneBR — números DIFERENTES não podem colidir", () => {
  // Colisão aqui significaria a Ayla respondendo para a família errada.
  const distintos = [
    "+5511994770067",
    "+5511884770067", // outro celular, mesmo DDD
    "+5511994770068", // último dígito diferente
    "+5521994770067", // mesmo número, outro DDD
    "+5511934770067", // 9º dígito presente, prefixo diferente
  ];
  it("todas as chaves são únicas entre si", () => {
    const chaves = distintos.map(chaveTelefoneBR);
    expect(new Set(chaves).size).toBe(distintos.length);
  });

  it("DDD nunca é confundido com prefixo", () => {
    expect(chaveTelefoneBR("+5521994770067")).not.toBe(chaveTelefoneBR("+5511994770067"));
  });
});

describe("chaveTelefoneBR — internacional e bordas", () => {
  it("número internacional não é mutilado", () => {
    // 1 é o código dos EUA; nada aqui pode ser tratado como 9º dígito BR.
    expect(chaveTelefoneBR("+13055551234")).toBe("13055551234");
  });

  it("não remove o 9 quando ele não é o 9º dígito brasileiro", () => {
    // 10 dígitos: já é a forma legada, nada a remover.
    expect(chaveTelefoneBR("1194770067")).toBe("1194770067");
  });

  it("vazio, nulo e lixo não quebram", () => {
    expect(chaveTelefoneBR("")).toBe("");
    expect(chaveTelefoneBR(null)).toBe("");
    expect(chaveTelefoneBR(undefined)).toBe("");
    expect(chaveTelefoneBR("sem número")).toBe("");
  });

  it("é idempotente: aplicar duas vezes não muda", () => {
    const uma = chaveTelefoneBR("+5511994770067");
    expect(chaveTelefoneBR(uma)).toBe(uma);
  });
});
