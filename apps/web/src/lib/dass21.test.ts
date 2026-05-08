import { describe, it, expect } from "vitest";
import { calcularDASS21, DASS21_ITEMS } from "./dass21";

function respostasUniformes(valor: 0 | 1 | 2 | 3): number[] {
  return Array.from({ length: 21 }, () => valor);
}

describe("calcularDASS21", () => {
  it("rejeita arrays com tamanho errado", () => {
    expect(() => calcularDASS21([0, 1, 2])).toThrow(
      /exatamente 21 respostas/,
    );
  });

  it("rejeita valores fora do intervalo 0-3", () => {
    const r = respostasUniformes(0);
    r[5] = 4;
    expect(() => calcularDASS21(r)).toThrow(/inválida no item 6/);
  });

  it("zero respostas → todas faixas normais", () => {
    const r = calcularDASS21(respostasUniformes(0));
    expect(r.scores).toEqual({ depressao: 0, ansiedade: 0, estresse: 0 });
    expect(r.faixas).toEqual({
      depressao: "normal",
      ansiedade: "normal",
      estresse: "normal",
    });
    expect(r.algumaSevera).toBe(false);
    expect(r.algumaModeradaOuPior).toBe(false);
  });

  it("máximas respostas → tudo extremamente severa", () => {
    const r = calcularDASS21(respostasUniformes(3));
    // 7 itens × 3 = 21 em cada dimensão
    expect(r.scores).toEqual({ depressao: 21, ansiedade: 21, estresse: 21 });
    expect(r.faixas).toEqual({
      depressao: "extremamente_severa",
      ansiedade: "extremamente_severa",
      estresse: "extremamente_severa",
    });
    expect(r.algumaSevera).toBe(true);
    expect(r.algumaModeradaOuPior).toBe(true);
  });

  it("score 5 em depressão = leve (limite)", () => {
    const r = respostasUniformes(0);
    // marca 5 em algum item de depressão
    const itemDep = DASS21_ITEMS.find((i) => i.dimensao === "depressao")!;
    // distribui 5 ao longo dos itens de depressão
    let restante = 5;
    for (const i of DASS21_ITEMS) {
      if (i.dimensao === "depressao" && restante > 0) {
        const v = Math.min(3, restante);
        r[i.numero - 1] = v;
        restante -= v;
      }
    }
    void itemDep;
    const res = calcularDASS21(r);
    expect(res.scores.depressao).toBe(5);
    expect(res.faixas.depressao).toBe("leve");
  });

  it("score 8 em ansiedade = severa", () => {
    const r = respostasUniformes(0);
    let restante = 8;
    for (const i of DASS21_ITEMS) {
      if (i.dimensao === "ansiedade" && restante > 0) {
        const v = Math.min(3, restante);
        r[i.numero - 1] = v;
        restante -= v;
      }
    }
    const res = calcularDASS21(r);
    expect(res.scores.ansiedade).toBe(8);
    expect(res.faixas.ansiedade).toBe("severa");
    expect(res.algumaSevera).toBe(true);
  });

  it("score 12 em estresse = moderada (limite superior)", () => {
    const r = respostasUniformes(0);
    let restante = 12;
    for (const i of DASS21_ITEMS) {
      if (i.dimensao === "estresse" && restante > 0) {
        const v = Math.min(3, restante);
        r[i.numero - 1] = v;
        restante -= v;
      }
    }
    const res = calcularDASS21(r);
    expect(res.scores.estresse).toBe(12);
    expect(res.faixas.estresse).toBe("moderada");
  });
});
