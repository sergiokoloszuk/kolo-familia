/** Preview permite o aceite da conversa web, nunca operação automática. */
export function previewSomenteConversa(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export const ERRO_PREVIEW_CONVERSA = "preview_somente_conversa";

/** Defesa no transporte: mesmo chamadas internas não podem enviar mensagens. */
export function exigirEnvioForaDaPreview(): void {
  if (previewSomenteConversa()) throw new Error(ERRO_PREVIEW_CONVERSA);
}
