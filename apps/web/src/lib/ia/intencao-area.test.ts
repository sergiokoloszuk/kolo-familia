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
