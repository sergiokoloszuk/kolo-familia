/**
 * Z-API sender — PRD §12.12.
 *
 * Z-API expõe REST. Endpoints relevantes:
 *   POST /instances/{instanceId}/token/{token}/send-text
 *   Headers: Client-Token: {client_token}
 *   Body: { phone, message }
 *
 * Em produção, o ideal é passar pelo n8n (que orquestra retry, fan-out,
 * normalização de mídia). Esta função é o caminho direto — n8n pode
 * chamar outro endpoint nosso e nós despachamos por aqui no fim.
 */

const ZAPI_BASE = "https://api.z-api.io";

type ZapiConfig = {
  instanceId: string;
  token: string;
  clientToken: string;
};

function getZapiConfig(): ZapiConfig {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token || !clientToken) {
    throw new Error(
      "ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN devem estar configurados em .env.local.",
    );
  }
  return { instanceId, token, clientToken };
}

/**
 * Envia uma mensagem de texto via Z-API.
 * Retorna o messageId / zaapId que a Z-API devolve, ou lança em erro.
 */
export async function enviarTexto(params: {
  phoneE164: string;
  texto: string;
}): Promise<{ messageId: string; raw: unknown }> {
  const { instanceId, token, clientToken } = getZapiConfig();

  // Z-API espera o telefone sem o '+', no formato E.164 sem prefixo.
  const phone = params.phoneE164.replace(/^\+/, "");

  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify({ phone, message: params.texto }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Z-API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as { messageId?: string; zaapId?: string };
  const messageId = json.messageId ?? json.zaapId ?? "unknown";
  return { messageId, raw: json };
}

/**
 * Normaliza o payload de webhook do Z-API/n8n para um shape único.
 * Z-API webhook tem várias formas (textos simples, mídia, status, etc.).
 * Aqui só lemos texto recebido — o mínimo para o parser.
 */
export type InboundWhatsApp = {
  phoneE164: string;
  texto: string;
  recebidaEm: Date;
  midiaUrl?: string;
  midiaTipo?: string;
};

export function parseZapiWebhook(payload: unknown): InboundWhatsApp | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  // Apenas mensagens RECEBIDAS — Z-API ecoa as enviadas (fromMe=true).
  // O nome do campo varia entre Z-API e n8n; cobre ambos.
  const fromMe = (p.fromMe ?? p.from_me ?? false) === true;
  if (fromMe) return null;

  // Telefone (Z-API usa 'phone'; n8n pode embrulhar)
  const phoneRaw =
    (typeof p.phone === "string" ? p.phone : null) ??
    (typeof p.from === "string" ? p.from : null);
  if (!phoneRaw) return null;
  const phoneE164 = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;

  // Texto pode estar em várias chaves — Z-API ReceivedCallback usa
  // { text: { message: "..." } }; n8n às vezes manda { message: { text: "..." } }
  // ou { text: "..." } direto. Cobre tudo.
  const texto =
    pickString(p.text) ??
    pickString((p.text as Record<string, unknown> | undefined)?.message) ??
    pickString((p.message as Record<string, unknown> | undefined)?.text) ??
    pickString(p.message) ??
    pickString(p.body) ??
    "";
  if (!texto.trim()) return null;

  // Mídia (opcional — Ayla apenas arquiva por ora)
  const midiaUrl =
    pickString(p.mediaUrl) ??
    pickString((p.image as Record<string, unknown> | undefined)?.imageUrl) ??
    pickString((p.audio as Record<string, unknown> | undefined)?.audioUrl);
  const midiaTipo = midiaUrl
    ? (typeof p.mediaType === "string" && p.mediaType) ||
      (p.image ? "image" : p.audio ? "audio" : "outro")
    : undefined;

  // Timestamp
  const tsMs =
    typeof p.timestamp === "number"
      ? p.timestamp * (p.timestamp < 1e12 ? 1000 : 1)
      : Date.now();

  return {
    phoneE164,
    texto,
    recebidaEm: new Date(tsMs),
    midiaUrl,
    midiaTipo,
  };
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
