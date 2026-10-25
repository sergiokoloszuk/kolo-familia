import { afterEach, describe, expect, it, vi } from "vitest";
const geracao = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ia/provider", () => ({ gerarConversacional: geracao, MODELO_CONVERSA: { openai: "fake" } }));
import { decidirTurno } from "./decisao-do-turno";
const original = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
afterEach(() => { if (original == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = original; });
describe("a decisão do turno enxerga as opções finais", () => {
  it("preserva oferta final na candidata e mantém corte anterior com flag off", async () => {
    geracao.mockResolvedValue({ texto: '{"intencao":"outro","pedido_explicito":false}', tokensIn: 1, tokensOut: 1, ms: 1 });
    const ultimaAyla = "Primeiro ajudo. " + "Explicação útil. ".repeat(160) + "\nPosso montar a refeição ou uma atividade na cozinha. Qual prefere?";
    for (const flag of ["on", "off"]) {
      process.env.AYLA_QUALIDADE_RESPOSTA_V2 = flag;
      await decidirTurno({ texto: "Quero a primeira opção", blocoEstado: "<estado />", ultimaAyla });
      const system = geracao.mock.lastCall?.[0].system as string;
      expect(system.includes("atividade na cozinha")).toBe(flag === "on");
      expect(system).toContain("Primeiro ajudo");
    }
  });
});
