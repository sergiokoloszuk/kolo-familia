/** O caso da escola, com o bloco de hipóteses. Desligado sem PROVA_REAL. */
import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { montarMundo, inboundDe, type Mundo } from "./__harness/cenario";
import { carregarEnvLocal, medirTexto, type CapturaConversa } from "./__harness/prova-real";
carregarEnvLocal(process.cwd());
const mundoRef: { atual: Mundo | null } = { atual: null };
const capturas: CapturaConversa[] = [];
vi.mock("./whatsappSender", () => ({
  enviarTexto: async (p: { phoneE164: string; texto: string }) => {
    mundoRef.atual?.enviadas.push({ para: p.phoneE164, texto: p.texto });
    return { ok: true, messageId: "x" };
  },
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
  const g = real.gerarConversacional as (p: unknown) => Promise<CapturaConversa>;
  return { ...real, gerarConversacional: async (p: { system: string; messages: unknown }) => {
    const t0 = Date.now(); const r = (await g(p)) as unknown as CapturaConversa;
    capturas.push({ system: p.system, user: JSON.stringify(p.messages), texto: r.texto, provider: r.provider, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cacheRead: r.cacheRead ?? 0, ms: Date.now() - t0 });
    return r; } };
});
const { processInbound } = await import("./orchestrator");
function familia() {
  return montarMundo({ nomeMae: "Juliana", criancas: [{ nome: "Manu", nascimento: "2019-05-10", genero: "feminino",
    sabe: { essencial: "Manu, 7 anos, autista (laudo)", como_e: "observadora; compreende frases simples",
      corpo_rotina: "escola de manhã", sensorial: "sente bastante barulho e lugar cheio",
      desafios_regulacao: "sente bastante as mudanças de rotina" },
    extras: { gostos: "adora cavalos e desenhar" } }] });
}
async function turno(m: Mundo, texto: string) {
  mundoRef.atual = m; const a = m.enviadas.length; const c0 = capturas.length;
  const r = await processInbound(m.db.cliente(), inboundDe(m, texto));
  expect(r.tratada).toBe(true);
  expect(m.enviadas.length, "não respondeu").toBeGreaterThan(a);
  const resposta = m.enviadas.slice(a).map((e) => e.texto).join("\n");
  const c = capturas[capturas.length - 1];
  return { mensagem: texto, resposta, ...medirTexto(resposta), semProdutor: capturas.length === c0, ms: c?.ms ?? 0 };
}
describe.skipIf(!process.env.PROVA_REAL)("escola", () => {
  it("dois turnos", async () => {
    const m = familia();
    const t1 = await turno(m, "Ela não quer ir para a escola.");
    const t2 = await turno(m, "2 e 4");
    writeFileSync(process.env.PROVA_SAIDA ?? "escola.json", JSON.stringify([t1, t2], null, 2), "utf8");
  }, 300_000);
});
