import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * O WEBHOOK NÃO GRAVA TEXTO NEM TELEFONE NOS LOGS — 12/11/2026.
 *
 * Antes saíam para os logs da Vercel os 600 primeiros caracteres do payload e
 * o par { telefone, texto } da mensagem da mãe. O teste chama o handler de
 * verdade com uma mensagem fictícia e procura o texto e o telefone em TUDO o
 * que foi escrito no console.
 */

const TEXTO = "mensagem ficticia de teste sobre a crianca qa";
const TELEFONE = "+5551912345678";

vi.mock("next/server", async (original) => {
  const real = await original<typeof import("next/server")>();
  return { ...real, after: () => undefined }; // o processamento em segundo plano não roda no teste
});
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/ayla/whatsappSender", () => ({
  enviarTexto: vi.fn(),
  parseZapiWebhook: () => ({ phoneE164: TELEFONE, texto: TEXTO }),
}));
vi.mock("@/lib/ayla/orchestrator", () => ({ processInbound: vi.fn(), idiomaPorTelefone: vi.fn() }));
vi.mock("@/lib/ayla/transcribe", () => ({ transcreverAudio: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhook da Ayla — logs", () => {
  it("MORDE: nenhum log contém o texto da mãe nem o telefone completo", async () => {
    const escritos: string[] = [];
    for (const nivel of ["log", "warn", "error", "info"] as const) {
      vi.spyOn(console, nivel).mockImplementation((...args: unknown[]) => {
        escritos.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      });
    }
    const { POST } = await import("./route");
    const r = await POST(
      new NextRequest("https://kolo.test/api/ayla/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: TELEFONE.slice(1), text: { message: TEXTO } }),
      }),
    );
    expect(r.status).toBe(200);
    const tudo = escritos.join("\n");
    expect(escritos.length).toBeGreaterThan(0);
    expect(tudo).not.toContain(TEXTO);
    expect(tudo).not.toContain("5551912345678");
    expect(tudo).toContain("***5678"); // ainda dá para correlacionar
  });
});
