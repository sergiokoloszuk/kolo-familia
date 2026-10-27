import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exigirEnvioForaDaPreview, previewSomenteConversa } from "./preview-conversa";
import { enviarDocumento, enviarListaBotoes, enviarTexto, verificarStatusZapi } from "./ayla/whatsappSender";
import { send, verify } from "./email/mailer";

const smtp = vi.hoisted(() => ({
  criar: vi.fn(),
  enviar: vi.fn(),
  verificar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.criar } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ messageId: "qa-sem-envio" })));
  for (const nome of ["ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"]) vi.stubEnv(nome, "qa-falso");
  smtp.criar.mockReturnValue({ sendMail: smtp.enviar, verify: smtp.verificar });
  smtp.enviar.mockResolvedValue({ messageId: "qa-email", response: "simulado", accepted: [], rejected: [] });
  smtp.verificar.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Preview somente conversa — defesa nos transportes reais", () => {
  it.each(["production", "development", ""])("não altera o ambiente %s", (ambiente) => {
    vi.stubEnv("VERCEL_ENV", ambiente);
    expect(previewSomenteConversa()).toBe(false);
    expect(() => exigirEnvioForaDaPreview()).not.toThrow();
  });

  it("bloqueia texto, botões e documento, mesmo com credenciais configuradas", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(previewSomenteConversa()).toBe(true);
    const chamadas = [
      () => enviarTexto({ phoneE164: "+5500000000000", texto: "QA" }),
      () => enviarListaBotoes({ phoneE164: "+5500000000000", mensagem: "QA", botoes: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }),
      () => enviarDocumento({ phoneE164: "+5500000000000", url: "https://example.invalid/qa.pdf", fileName: "qa.pdf" }),
    ];
    for (let rodada = 0; rodada < 2; rodada++) {
      for (const chamar of chamadas) await expect(chamar()).rejects.toThrow("preview_somente_conversa");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("nem a verificação da Z-API conecta na Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await verificarStatusZapi()).toEqual({ connected: false, raw: "preview_somente_conversa" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserva o envio fora da Preview, usando apenas fetch falso", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await enviarTexto({ phoneE164: "+5500000000000", texto: "QA" })).messageId).toBe("qa-sem-envio");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bloqueia SMTP inclusive depois de um transporter já ter sido cacheado", async () => {
    for (const [nome, valor] of Object.entries({ SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "qa", SMTP_PASS: "qa-falso", SMTP_FROM: "qa@example.invalid" })) vi.stubEnv(nome, valor);
    vi.stubEnv("VERCEL_ENV", "production");
    await send({ to: "qa@example.invalid", subject: "QA", text: "Simulado" });
    expect(smtp.criar).toHaveBeenCalledTimes(1);
    expect(smtp.enviar).toHaveBeenCalledTimes(1);

    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(send({ to: "qa@example.invalid", subject: "QA", text: "Não enviar" })).rejects.toThrow("preview_somente_conversa");
    await expect(verify()).rejects.toThrow("preview_somente_conversa");
    expect(smtp.criar).toHaveBeenCalledTimes(1);
    expect(smtp.enviar).toHaveBeenCalledTimes(1);
    expect(smtp.verificar).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
