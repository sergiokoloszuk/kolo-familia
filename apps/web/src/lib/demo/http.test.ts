import { describe, it, expect, vi, afterEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * A casca HTTP da demonstração: FAIL-CLOSED sem a variável, e CORS só para a
 * landing autorizada. Nada aqui chama banco, Z-API nem modelo.
 */

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/ayla/whatsappSender", () => ({
  enviarTexto: async () => {
    throw new Error("não pode enviar em teste");
  },
}));
vi.mock("@/lib/ia/provider", () => ({
  gerarConversacional: async () => {
    throw new Error("não pode chamar modelo em teste");
  },
}));

const { rotaDemo, preflight, statusDoMotivo } = await import("./http");

function req(origem: string | null, corpo = "{}"): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === "origin" ? origem : null) },
    text: async () => corpo,
  } as unknown as NextRequest;
}

afterEach(() => {
  delete process.env.DEMO_AYLA_HABILITADA;
  delete process.env.DEMO_ORIGENS_PERMITIDAS;
});

describe("liga/desliga", () => {
  it("MORDE: sem DEMO_AYLA_HABILITADA=1, responde 503 e não executa nada", async () => {
    const executar = vi.fn(async () => ({ ok: true }));
    const r = await rotaDemo(req("https://www.kolofamilia.com.br"), executar);
    expect(r.status).toBe(503);
    expect(executar).not.toHaveBeenCalled();
  });

  it("ligada: corpo inválido é 400, sem executar", async () => {
    process.env.DEMO_AYLA_HABILITADA = "1";
    const executar = vi.fn(async () => ({ ok: true }));
    const r = await rotaDemo(req(null, "não é json"), executar);
    expect(r.status).toBe(400);
    expect(executar).not.toHaveBeenCalled();
  });

  it("ligada: o status sai do motivo", async () => {
    process.env.DEMO_AYLA_HABILITADA = "1";
    const r = await rotaDemo(req(null), async () => ({ ok: false, motivo: "ja_usou" }));
    expect(r.status).toBe(409);
    expect(statusDoMotivo("cooldown")).toBe(429);
    expect(statusDoMotivo("token_invalido")).toBe(401);
    expect(statusDoMotivo("qualquer")).toBe(500);
  });
});

describe("CORS", () => {
  it("só a origem permitida recebe o cabeçalho", async () => {
    process.env.DEMO_ORIGENS_PERMITIDAS = "https://www.kolofamilia.com.br, https://landing.exemplo.com/";
    const ok = preflight(req("https://landing.exemplo.com"));
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://landing.exemplo.com");
    const fora = preflight(req("https://golpe.exemplo.com"));
    expect(fora.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
