import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as webhook } from "@/app/api/ayla/webhook/route";
import { GET as cronGet, POST as cronPost } from "@/app/api/ayla/cron/route";
import { GET as exclusaoGet, POST as exclusaoPost } from "@/app/api/cron/exclusao-pagamento/route";

const efeitos = vi.hoisted(() => ({ banco: vi.fn(), processar: vi.fn(), stripe: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: efeitos.banco }));
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: efeitos.stripe }));
vi.mock("@/lib/ayla/orchestrator", () => ({ processInbound: efeitos.processar, idiomaPorTelefone: vi.fn() }));
vi.mock("@/lib/evolucao/snapshot", () => ({ gerarSnapshotMensal: vi.fn() }));
vi.mock("@/lib/ayla/rotina-reconciliacao", () => ({ resolverRotinaOrfa: vi.fn() }));
vi.mock("@/lib/ayla/rotina-guiada", () => ({ dispararGeracao: vi.fn() }));
vi.mock("@/lib/ayla/insightEngine", () => ({ detectAndPersist: vi.fn() }));
vi.mock("@/lib/regras/engine", () => ({ runRegrasParaFamilia: vi.fn() }));
vi.mock("@/lib/stripe/reconciliacao", () => ({}));
vi.mock("@/lib/fiscal/notificacao", () => ({ enviarLinksFiscais: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("CRON_SECRET", "qa-secret");
  vi.stubEnv("AYLA_WEBHOOK_SECRET", "qa-secret");
  vi.stubEnv("DUNNING_DELETE_ENABLED", "true");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("rede proibida no teste"); }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const portas = [
  { nome: "webhook POST", rota: webhook, caminho: "/api/ayla/webhook", metodo: "POST" },
  { nome: "cron GET", rota: cronGet, caminho: "/api/ayla/cron?tipo=rotina", metodo: "GET" },
  { nome: "cron POST", rota: cronPost, caminho: "/api/ayla/cron?tipo=comercial", metodo: "POST" },
  { nome: "exclusão GET", rota: exclusaoGet, caminho: "/api/cron/exclusao-pagamento", metodo: "GET" },
  { nome: "exclusão POST", rota: exclusaoPost, caminho: "/api/cron/exclusao-pagamento", metodo: "POST" },
];

describe("Preview recusa automações antes de ler/escrever banco ou processar payload", () => {
  it.each(portas)("$nome bloqueada com segredo válido, inclusive repetição", async ({ rota, caminho, metodo }) => {
    for (let rodada = 0; rodada < 2; rodada++) {
      const request = new NextRequest(`https://example.invalid${caminho}`, {
        method: metodo,
        headers: { authorization: "Bearer qa-secret", "x-ayla-secret": "qa-secret" },
        ...(metodo === "POST" ? { body: "json inválido" } : {}),
      });
      const lerPayload = vi.spyOn(request, "json");
      const resposta = await rota(request);
      expect(resposta.status).toBe(403);
      expect(await resposta.json()).toEqual({ error: "preview_somente_conversa" });
      expect(lerPayload).not.toHaveBeenCalled();
    }
    expect(efeitos.banco).not.toHaveBeenCalled();
    expect(efeitos.processar).not.toHaveBeenCalled();
    expect(efeitos.stripe).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(portas)("$nome também bloqueada sem segredo configurado", async ({ rota, caminho, metodo }) => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("AYLA_WEBHOOK_SECRET", "");
    const resposta = await rota(new NextRequest(`https://example.invalid${caminho}`, { method: metodo }));
    expect(resposta.status).toBe(403);
    expect(efeitos.banco).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(portas)("$nome preserva autenticação fora da Preview", async ({ rota, caminho, metodo }) => {
    vi.stubEnv("VERCEL_ENV", "production");
    const resposta = await rota(new NextRequest(`https://example.invalid${caminho}`, { method: metodo }));
    expect(resposta.status).toBe(401);
    expect(efeitos.banco).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
