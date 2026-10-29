import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ client: vi.fn(), resolve: vi.fn(), active: vi.fn(), transcribe: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.client, createServiceRoleClient: vi.fn(() => ({})) }));
vi.mock("@/lib/auth/current-family", () => ({ resolveFamily: mock.resolve }));
vi.mock("@/lib/auth/require-active-write", () => ({ requireActiveWrite: mock.active }));
vi.mock("@/lib/ayla/transcribe", () => ({ transcreverArquivo: mock.transcribe }));
import { POST } from "./route";
const originalFlag = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
const originalKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
  process.env.OPENAI_API_KEY = "chave-falsa-nao-enviada";
  mock.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } });
  mock.resolve.mockResolvedValue({ data: { id: "f1" } });
  mock.active.mockResolvedValue(undefined);
  mock.transcribe.mockResolvedValue("Quero ajuda para dormir.");
});
afterEach(() => {
  if (originalFlag == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = originalFlag;
  if (originalKey == null) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
});
const req = (tipo = "audio/webm") => {
  const form = new FormData(); form.set("audio", new Blob(["audio sintetico"], { type: tipo }), "mensagem.webm");
  return new Request("http://localhost/api/conversar/transcrever", { method: "POST", body: form }) as NextRequest;
};
describe("áudio da web — endpoint real, transcritor simulado", () => {
  it("devolve texto editável, sem enviar mensagem ou gravar Perfil", async () => {
    const r = await POST(req());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ texto: "Quero ajuda para dormir." });
    expect(mock.transcribe).toHaveBeenCalledWith(expect.any(Blob), "audio.webm", expect.objectContaining({ family_account_id: "f1", feature: "conversa_web_audio" }));
  });
  it("off não consome API", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    expect((await POST(req())).status).toBe(404);
    expect(mock.transcribe).not.toHaveBeenCalled();
  });
  it("sem sessão ou acesso não consome API", async () => {
    mock.client.mockResolvedValueOnce({ auth: { getUser: async () => ({ data: { user: null } }) } });
    expect((await POST(req())).status).toBe(401);
    mock.active.mockRejectedValueOnce(new Error("inativo"));
    expect((await POST(req())).status).toBe(402);
    expect(mock.transcribe).not.toHaveBeenCalled();
  });
  it("sem chave é fail-closed; formato incorreto não chega ao transcritor", async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await POST(req())).status).toBe(503);
    process.env.OPENAI_API_KEY = "fake";
    expect((await POST(req("text/plain"))).status).toBe(415);
    expect(mock.transcribe).not.toHaveBeenCalled();
  });
  it("falha de transcrição não vira texto ou falso sucesso", async () => {
    mock.transcribe.mockResolvedValueOnce(null);
    expect((await POST(req())).status).toBe(502);
  });
});
