import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ final: vi.fn(), stream: vi.fn() }));
vi.mock("./anthropic", () => ({ MODELS: { leve: "fake" }, getAnthropicClient: () => ({ messages: { stream: mock.stream } }) }));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: vi.fn() }));
import { classificarIntencao } from "./intencao";
const flagOriginal = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
afterEach(() => { if (flagOriginal == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = flagOriginal; });
const responder = (texto: string) => {
  mock.final.mockResolvedValue({ content: [{ type: "text", text: texto }], usage: { input_tokens: 1, output_tokens: 1 } });
  mock.stream.mockReturnValue({ finalMessage: mock.final });
};
describe("classificador de troca usa a chamada existente", () => {
  it("piloto Foco distingue pedido atual de ideias/ajuda de desabafo, sem nova chamada", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    responder("duvida|foco|-|-");
    const antes = mock.stream.mock.calls.length;
    const r = await classificarIntencao({ supabase: {} as never, familyId: "f1",
      texto: "Me dê ideias de outras coisas que posso te pedir sobre isso.", areaEscolhida: "foco" });
    expect(r.intencao).toBe("duvida");
    expect(mock.stream.mock.calls.length - antes).toBe(1);
    const prompt = mock.stream.mock.lastCall?.[0].system[0].text;
    expect(prompt).toContain("classifique o PEDIDO DA ÚLTIMA MENSAGEM");
    expect(prompt).toContain("Uma necessidade imediata ou risco continua sendo crise");
  });
  it("refinamento de Foco fica fora dos outros temas e do rollback", async () => {
    responder("desafio|sono|-|-");
    for (const [flag, area] of [["on", "sono"], ["off", "foco"]]) {
      process.env.AYLA_QUALIDADE_RESPOSTA_V2 = flag;
      await classificarIntencao({ supabase: {} as never, familyId: "f1", texto: "Quero ajuda", areaEscolhida: area });
      expect(mock.stream.mock.lastCall?.[0].system[0].text).not.toContain("No piloto de Foco");
    }
  });
  it("não reescreve crise ou desabafo verdadeiro com uma heurística de palavras", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    for (const intencao of ["crise", "desabafo"]) {
      responder(`${intencao}|foco|-|-`);
      const r = await classificarIntencao({ supabase: {} as never, familyId: "f1",
        texto: intencao === "crise" ? "Preciso de ajuda agora, ela está se machucando" : "Hoje só quero desabafar", areaEscolhida: "foco" });
      expect(r.intencao).toBe(intencao);
    }
  });
  it("recebe a oferta final mesmo depois de uma orientação longa", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    responder("desafio|nutricional|montar a próxima refeição|-");
    await classificarIntencao({ supabase: {} as never, familyId: "f1", texto: "Quero a primeira opção",
      historico: [{ papel: "assistant", conteudo: "Orientações. ".repeat(350) + "\nPosso montar a próxima refeição ou uma atividade na cozinha." }] });
    expect(mock.stream.mock.lastCall?.[0].messages[0].content).toContain("atividade na cozinha");
  });
  it("mantém formato legado sem área escolhida", async () => {
    responder("desafio|sono|-");
    const r = await classificarIntencao({ supabase: {} as never, familyId: "f1", texto: "não dorme" });
    expect(r).toEqual({ intencao: "desafio", tema: "sono", aceite: null });
  });
  it("aceita troca válida e rejeita chave inventada", async () => {
    responder("desafio|sono|-|sono");
    const args = { supabase: {} as never, familyId: "f1", texto: "agora sono", areaEscolhida: "nutricional" };
    expect((await classificarIntencao(args)).trocaTema).toBe("sono");
    responder("desafio|sono|-|admin");
    expect((await classificarIntencao(args)).trocaTema).toBeNull();
    const prompt = mock.stream.mock.lastCall?.[0].system[0].text;
    expect(prompt).toContain("NÃO muda a área-base");
  });
  it("menção complementar ou saída antiga não sinaliza troca", async () => {
    responder("desafio|sono|-");
    const r = await classificarIntencao({ supabase: {} as never, familyId: "f1", texto: "come pior quando dorme mal", areaEscolhida: "nutricional" });
    expect(r.tema).toBe("sono");
    expect(r.trocaTema).toBeNull();
  });
});
