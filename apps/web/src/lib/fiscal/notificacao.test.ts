import { describe, expect, it, vi } from "vitest";
import { enviarLinksFiscais, mensagemFiscal } from "./notificacao";

describe("aviso fiscal para Rosangela", () => {
  const links = [{ invoiceId: "in_123456789", url: "https://kolo.test/fiscal/notas/token-opaco" }];

  it("entrega o link ao número configurado para Rosangela sem colocar PII na mensagem", async () => {
    const enviar = vi.fn().mockResolvedValue({ messageId: "msg-1" });
    await enviarLinksFiscais("+5511999999999", links, enviar);

    expect(enviar).toHaveBeenCalledWith({
      phoneE164: "+5511999999999",
      texto: expect.stringContaining("https://kolo.test/fiscal/notas/token-opaco"),
    });
    const texto = enviar.mock.calls[0][0].texto as string;
    expect(texto).toContain("nome completo, CPF e endereço");
    expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it("falha fechada sem o telefone da destinatária", async () => {
    await expect(enviarLinksFiscais("", links, vi.fn())).rejects.toThrow(
      "ROSANGELA_FISCAL_WHATSAPP_E164 não configurado",
    );
  });

  it("identifica Rosangela e não inclui dados fiscais no texto", () => {
    expect(mensagemFiscal(links)).toContain("Rosangela");
    expect(mensagemFiscal(links)).toContain("Esses dados não são enviados pelo WhatsApp");
  });
});
