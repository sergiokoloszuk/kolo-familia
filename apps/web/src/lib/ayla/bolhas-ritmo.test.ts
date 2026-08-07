import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ritmoDasBolhas, TETO_ESPERA_SEGUNDOS, dividirEmBolhas } from "./bolhas";

/**
 * O RITMO DAS BOLHAS — a espera que a mãe sente, e que não vem do modelo.
 *
 * Medido em 07/08/2026: o pipeline leva ~5,2 s de mediana no GPT, e a fórmula
 * antiga (2 s na primeira bolha, até 6 s nas demais) somava 13-14 s numa
 * resposta de 3 bolhas. Quatro quintos da espera eram nossos.
 *
 * A fórmula antiga, pra comparação: `primeiro ? 2 : min(max(round(len/25),2),6)`
 */
const ANTIGA = (bolhas: string[]) =>
  bolhas.map((b, i) => (i === 0 ? 2 : Math.min(Math.max(Math.round(b.length / 25), 2), 6)));
const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** Blocos de tamanho realista — os do smoke com repertório. */
const bloco = (n: number) => "x".repeat(n);

describe("teto de espera artificial", () => {
  it("nunca passa do teto, em nenhuma quantidade de bolhas", () => {
    for (let n = 1; n <= 8; n++) {
      const bolhas = Array.from({ length: n }, () => bloco(250));
      expect(soma(ritmoDasBolhas(bolhas)), `${n} bolhas`).toBeLessThanOrEqual(
        TETO_ESPERA_SEGUNDOS,
      );
    }
  });

  it("a primeira bolha sai em 1 s — é ela que tira a mãe da incerteza", () => {
    expect(ritmoDasBolhas([bloco(600)])[0]).toBe(1);
    expect(ritmoDasBolhas([bloco(50), bloco(50)])[0]).toBe(1);
  });

  it("bloco maior pede um pouco mais, mas nunca mais que 2 s", () => {
    const [, curto] = ritmoDasBolhas([bloco(100), bloco(80)]);
    const [, longo] = ritmoDasBolhas([bloco(100), bloco(400)]);
    expect(curto).toBe(1);
    expect(longo).toBe(2);
  });

  it("quando o orçamento acaba, as bolhas restantes saem SEM espera", () => {
    const r = ritmoDasBolhas(Array.from({ length: 6 }, () => bloco(300)));
    expect(soma(r)).toBe(TETO_ESPERA_SEGUNDOS);
    expect(r.at(-1)).toBe(0);
  });

  it("delay nunca é negativo nem fracionário — a Z-API só aceita inteiro", () => {
    for (let n = 1; n <= 8; n++) {
      for (const d of ritmoDasBolhas(Array.from({ length: n }, () => bloco(400)))) {
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("antes × depois — o ganho medido", () => {
  const casos = [1, 2, 3, 4].map((n) => ({
    n,
    bolhas: Array.from({ length: n }, () => bloco(250)),
  }));

  it("toda quantidade de bolhas melhora, e a de 3 é a típica", () => {
    for (const c of casos) {
      const antes = soma(ANTIGA(c.bolhas));
      const depois = soma(ritmoDasBolhas(c.bolhas));
      expect(depois, `${c.n} bolhas`).toBeLessThan(antes);
    }
    // A resposta típica com repertório tem 3 bolhas: era 14 s, agora ≤ 4.
    const tres = casos[2].bolhas;
    expect(soma(ANTIGA(tres))).toBeGreaterThanOrEqual(12);
    expect(soma(ritmoDasBolhas(tres))).toBeLessThanOrEqual(4);
  });
});

describe("nada além do timing mudou", () => {
  const SRC = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

  it("o texto e o número de bolhas continuam vindo de dividirEmBolhas", () => {
    const t = "Primeiro bloco aqui.\n\nSegundo bloco aqui.\n\nTerceiro bloco aqui.";
    const b = dividirEmBolhas(t);
    expect(b.length).toBe(3);
    // O ritmo é calculado SOBRE as bolhas — não as cria, não as junta.
    expect(ritmoDasBolhas(b).length).toBe(b.length);
    expect(b.join("")).toBe(dividirEmBolhas(t).join(""));
  });

  it("a fórmula antiga saiu do orquestrador", () => {
    expect(SRC).not.toMatch(/Math\.round\(par\.length \/ 25\)/);
    expect(SRC).toMatch(/const ritmo = ritmoDasBolhas\(bolhas\)/);
  });

  it("o link do plano entrou no MESMO orçamento — não soma 3 s por fora", () => {
    expect(SRC).not.toMatch(/texto: nudge, delaySegundos: 3/);
    expect(SRC).toMatch(/TETO_ESPERA_SEGUNDOS - esperaGasta/);
  });
});
