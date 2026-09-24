import { enviarTexto } from "@/lib/ayla/whatsappSender";

export type LinkFiscal = { invoiceId: string; url: string };

export function mensagemFiscal(links: LinkFiscal[]): string {
  return [
    `Rosangela, há ${links.length} pagamento${links.length === 1 ? "" : "s"} para emitir nota fiscal.`,
    "Abra cada link para ver nome completo, CPF e endereço. Esses dados não são enviados pelo WhatsApp.",
    ...links.map((link, indice) =>
      `${indice + 1}. Cobrança ${link.invoiceId.slice(-8)}: ${link.url}`,
    ),
  ].join("\n");
}

export async function enviarLinksFiscais(
  destinoRosangela: string,
  links: LinkFiscal[],
  enviar: typeof enviarTexto = enviarTexto,
) {
  if (!destinoRosangela) throw new Error("ROSANGELA_FISCAL_WHATSAPP_E164 não configurado");
  return enviar({ phoneE164: destinoRosangela, texto: mensagemFiscal(links) });
}
