import { describe, it, expect, vi, afterEach } from "vitest";
import {
  agendarEspera,
  ESPERAS_MS,
  FRASES_PRIMEIRA,
  FRASES_SEGUNDA,
} from "./espera";

/**
 * A espera medida com relógio simulado, nos tempos que importam.
 *
 * A geração real medida em produção simulada: 2,3 s (curta), 9,6 s (com
 * regeneração), 12,3 s (desafio comum). Os casos abaixo cercam essa faixa.
 */
afterEach(() => vi.useRealTimers());

/** Simula uma geração que leva `ms` e devolve os balões que a mãe recebeu. */
async function simular(ms: number, mensagem = "ela não quer tomar banho") {
  vi.useFakeTimers();
  const recebidos: string[] = [];
  const espera = agendarEspera({
    enviar: async (t) => {
      recebidos.push(t);
    },
    mensagem,
  });
  await vi.advanceTimersByTimeAsync(ms);
  await espera.cancelar();
  return recebidos;
}

describe("balão de espera — tempos simulados", () => {
  const casos: Array<[number, number, string]> = [
    [1000, 0, "resposta imediata não pode ver balão nenhum"],
    [3000, 1, "passou de 2,8s: um balão"],
    [6000, 1, "ainda no primeiro trecho: um balão"],
    [10000, 2, "passou de 9s: o segundo entra"],
    [15000, 2, "teto de dois — nunca três"],
  ];

  for (const [ms, esperado, porque] of casos) {
    it(`${ms / 1000}s → ${esperado} balão(ões): ${porque}`, async () => {
      const recebidos = await simular(ms);
      expect(recebidos.length).toBe(esperado);
    });
  }

  it("o vão máximo cai de 8,3s para menos de 5s nas duas gerações reais", () => {
    // A conta que decidiu os tempos. Um balão só aos 4s deixaria 8,3s de vazio
    // no caso comum; antecipar sozinho pioraria (2,5s → 9,8s).
    for (const geracao of [9600, 12300]) {
      const marcos = [0, ...ESPERAS_MS.filter((t) => t < geracao), geracao];
      const vaos = marcos.slice(1).map((m, i) => m - marcos[i]);
      expect(Math.max(...vaos)).toBeLessThan(5000);
    }
  });
});

describe("balão de espera — as regras que não podem quebrar", () => {
  it("os dois balões nunca são a mesma frase", async () => {
    const recebidos = await simular(15000);
    expect(recebidos).toHaveLength(2);
    expect(recebidos[0]).not.toBe(recebidos[1]);
    expect(FRASES_PRIMEIRA).toContain(recebidos[0] as never);
    expect(FRASES_SEGUNDA).toContain(recebidos[1] as never);
  });

  it("mensagens diferentes recebem frases diferentes — não é sempre a mesma", async () => {
    const vistas = new Set<string>();
    for (const m of ["oi", "ela não dorme", "ele bate na irmã", "tô cansada demais", "socorro"]) {
      const r = await simular(4000, m);
      vistas.add(r[0]);
    }
    expect(vistas.size).toBeGreaterThan(1);
  });

  it("cancelar impede o balão que ainda não saiu", async () => {
    vi.useFakeTimers();
    const recebidos: string[] = [];
    const espera = agendarEspera({
      enviar: async (t) => {
        recebidos.push(t);
      },
      mensagem: "teste",
    });
    await vi.advanceTimersByTimeAsync(5000); // passou do 1º, não do 2º
    await espera.cancelar();
    await vi.advanceTimersByTimeAsync(60000); // nada mais pode sair
    expect(recebidos).toHaveLength(1);
  });

  it("cancelar espera o balão em voo — ele nunca cai no meio das bolhas", async () => {
    vi.useFakeTimers();
    const ordem: string[] = [];
    let liberar: () => void = () => {};
    const espera = agendarEspera({
      enviar: async () => {
        await new Promise<void>((r) => {
          liberar = () => {
            ordem.push("balao");
            r();
          };
        });
      },
      mensagem: "teste",
    });
    await vi.advanceTimersByTimeAsync(3000);
    const fim = espera.cancelar().then(() => ordem.push("publicacao"));
    liberar();
    await fim;
    expect(ordem).toEqual(["balao", "publicacao"]);
  });

  it("falha no envio do balão não quebra nada", async () => {
    vi.useFakeTimers();
    const espera = agendarEspera({
      enviar: async () => {
        throw new Error("z-api fora");
      },
      mensagem: "teste",
    });
    await vi.advanceTimersByTimeAsync(4000);
    await expect(espera.cancelar()).resolves.toBeUndefined();
  });

  it("os tempos são os medidos, não números redondos inventados", () => {
    expect(ESPERAS_MS).toEqual([2800, 7500]);
  });
});
