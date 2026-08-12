/** Por que o modelo leve falha no parser? Desligado sem PROVA_REAL. */
import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { carregarEnvLocal } from "./__harness/prova-real";
carregarEnvLocal(process.cwd());

/** cada tentativa do parser: modelo, texto cru, e onde quebrou */
const brutos: Array<{ model: string; raw: string; ms: number }> = [];

vi.mock("./whatsappSender", () => ({
  enviarTexto: async () => ({ ok: true, messageId: "x" }),
  enviarImagem: async () => ({ ok: true, messageId: "i" }),
  enviarDocumento: async () => ({ ok: true, messageId: "d" }),
}));
vi.mock("./lote-inbound", () => ({
  aguardarTurnoDaMae: async (_s: unknown, p: { textoAtual: string }) => ({ texto: p.textoAtual, ids: [] }),
  descartarTurnoPendente: async () => {},
}));
vi.mock("@/lib/ai/prompts", () => ({ getSystemPrompt: async (_k: string, f: string) => f }));
vi.mock("@/lib/ludico/rotina-servico", () => ({ gerarRotina: async () => ({ desfecho: "nao_gerou", rotinas: [], fala: null }) }));
vi.mock("@/lib/ia/provider", async (o) => {
  const real = (await o()) as Record<string, unknown>;
  return { ...real, gerarConversacional: async () => ({ texto: "[ok]", provider: "anthropic", model: "m", tokensIn: 1, tokensOut: 1, cacheRead: 0 }) };
});
vi.mock("./anthropic", async (o) => {
  const real = (await o()) as Record<string, unknown>;
  const obter = real.getAylaAnthropicClient as () => { messages: { create: (a: unknown) => Promise<unknown>; stream: (a: unknown) => { finalMessage: () => Promise<unknown> } } };
  const texto = (m: unknown) => {
    const c = (m as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    return c.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  };
  return {
    ...real,
    getAylaAnthropicClient: () => {
      const c = obter();
      const ehParser = (a: unknown) => /membro_atipico_id/.test(JSON.stringify((a as { system?: unknown }).system ?? ""));
      return {
        messages: {
          create: async (a: unknown) => {
            const r = await c.messages.create(a);
            if (ehParser(a)) brutos.push({ model: String((a as { model?: string }).model), raw: texto(r), ms: 0 });
            return r;
          },
          stream: (a: unknown) => {
            const t = Date.now();
            const r = c.messages.stream(a);
            return {
              ...r,
              finalMessage: async () => {
                const m = await r.finalMessage();
                if (ehParser(a)) brutos.push({ model: String((a as { model?: string }).model), raw: texto(m), ms: Date.now() - t });
                return m;
              },
            };
          },
        },
      };
    },
  };
});
const { processInbound } = await import("./orchestrator");

function familia() {
  return montarMundo({
    nomeMae: "Juliana",
    criancas: [{ nome: "Pedro", nascimento: "2020-02-10", genero: "masculino",
      sabe: { essencial: "Pedro, 6 anos, autista (laudo)", sensorial: "não gosta de barulho alto" } }],
  });
}

describe.skipIf(!process.env.PROVA_REAL)("por que o parser leve falha", () => {
  it("captura o texto cru de cada tentativa", async () => {
    const falas = [
      "Ele nao quer entrar na escola.",
      "Ele morde quando quer algo e nao consegue pedir.",
      "Hoje ela entrou sorrindo, foi lindo.",
      "Qual horario e melhor pra dar banho?",
      "Ele subiu na janela do quarto agora.",
    ];
    const linhas: unknown[] = [];
    for (const f of falas) {
      brutos.length = 0;
      const m: Mundo = familia();
      await processInbound(m.db.cliente(), inboundDe(m, f));
      linhas.push({ fala: f, tentativas: brutos.map((b) => ({ model: b.model, ms: b.ms, len: b.raw.length, raw: b.raw })) });
    }
    writeFileSync(process.env.PROVA_SAIDA ?? "p.json", JSON.stringify(linhas, null, 2), "utf8");
    expect(linhas.length).toBe(5);
  }, 600_000);
});
