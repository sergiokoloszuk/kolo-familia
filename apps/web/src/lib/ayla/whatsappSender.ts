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
 *
 * ⚠️ O QUE `messageId` PROVA, E O QUE ELE NÃO PROVA. Ele prova que a Z-API
 * ACEITOU a mensagem (HTTP 200 + id). Não prova entrega no aparelho, não prova
 * que a pessoa recebeu e não prova que leu — isso viria de webhook de status,
 * que não escutamos. Quem for usar este valor: chame de "aceito pelo provedor".
 *
 * `null` quando a Z-API responde 200 sem id nenhum. Antes isto virava a string
 * "unknown", que é pior que nada em dois sentidos: mente sobre existir um id, e
 * colide no índice ÚNICO de `ayla_messages.zaap_message_id` (0053) na segunda
 * ocorrência — o que derrubaria o registro da mensagem.
 */
export async function enviarTexto(params: {
  phoneE164: string;
  texto: string;
  /**
   * Segundos exibindo "Digitando..." antes da mensagem aparecer.
   * Z-API: delayTyping MOSTRA o "digitando"; delayMessage só atrasa em
   * silêncio (não confundir — usar delayTyping).
   */
  delaySegundos?: number;
}): Promise<{ messageId: string | null; raw: unknown }> {
  const { instanceId, token, clientToken } = getZapiConfig();

  // Z-API espera o telefone sem o '+', no formato E.164 sem prefixo.
  const phone = params.phoneE164.replace(/^\+/, "");

  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/send-text`;
  const body: Record<string, unknown> = { phone, message: params.texto };
  if (params.delaySegundos && params.delaySegundos > 0) {
    body.delayTyping = Math.min(Math.round(params.delaySegundos), 15);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Z-API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as { messageId?: string; zaapId?: string };
  return { messageId: json.messageId ?? json.zaapId ?? null, raw: json };
}

/**
 * Envia um DOCUMENTO (ex.: PDF do plano) via Z-API.
 * Endpoint: POST /send-document/{extensao}  body { phone, document, fileName }.
 * `document` aceita uma URL pública ou data URI base64.
 *
 * Mesma leitura de `messageId` do `enviarTexto`: aceito pelo provedor, não
 * entregue. E `null` quando não vem id — nunca "unknown".
 */
export async function enviarDocumento(params: {
  phoneE164: string;
  url: string;
  fileName: string;
  extensao?: string;
  caption?: string;
}): Promise<{ messageId: string | null; raw: unknown }> {
  const { instanceId, token, clientToken } = getZapiConfig();
  const phone = params.phoneE164.replace(/^\+/, "");
  const ext = params.extensao ?? "pdf";

  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/send-document/${ext}`;
  const body: Record<string, unknown> = {
    phone,
    document: params.url,
    fileName: params.fileName,
  };
  if (params.caption) body.caption = params.caption;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Z-API send-document ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as { messageId?: string; zaapId?: string };
  return { messageId: json.messageId ?? json.zaapId ?? null, raw: json };
}

/**
 * Checa se o Z-API está CONECTADO (monitor de saúde). Retorna connected=false
 * em qualquer falha (HTTP, sessão caída) — nunca lança.
 */
export async function verificarStatusZapi(): Promise<{ connected: boolean; raw: unknown }> {
  try {
    const { instanceId, token, clientToken } = getZapiConfig();
    const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/status`;
    const res = await fetch(url, { headers: { "Client-Token": clientToken } });
    if (!res.ok) return { connected: false, raw: `HTTP ${res.status}` };
    const json = (await res.json()) as { connected?: boolean; error?: unknown };
    return { connected: json.connected === true, raw: json };
  } catch (e) {
    return { connected: false, raw: e instanceof Error ? e.message : "erro" };
  }
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
  /** Id da mensagem da Z-API — trava de idempotência contra reenvio. */
  messageId?: string;
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
    // Legenda de imagem — a Z-API manda em image.caption (antes a foto+legenda
    // virava "sem texto" e a mensagem inteira era IGNORADA).
    pickString((p.image as Record<string, unknown> | undefined)?.caption) ??
    // ⚠️ A LEGENDA DO VÍDEO FALTAVA AQUI (13/08/2026). A mãe que escrevia junto
    // do vídeo perdia o próprio texto: a mensagem virava "sem texto" e sumia
    // inteira. Era o pior dos casos — ela disse o que queria e não houve
    // resposta nenhuma.
    pickString((p.video as Record<string, unknown> | undefined)?.caption) ??
    pickString(p.caption) ??
    "";

  // Mídia (opcional)
  const midiaUrl =
    pickString(p.mediaUrl) ??
    pickString((p.image as Record<string, unknown> | undefined)?.imageUrl) ??
    pickString((p.audio as Record<string, unknown> | undefined)?.audioUrl) ??
    pickString((p.video as Record<string, unknown> | undefined)?.videoUrl);
  // ⚠️ O TIPO DEIXOU DE DEPENDER DA URL (13/08/2026). Um vídeo com metadata
  // incompleta — sem `videoUrl` — continua sendo um vídeo, e a família continua
  // merecendo resposta. Antes ele saía daqui como `undefined` e morria calado.
  const midiaTipo =
    (typeof p.mediaType === "string" && p.mediaType) ||
    (p.image
      ? "image"
      : p.audio
        ? "audio"
        : p.video
          ? "video"
          : midiaUrl
            ? "outro"
            : undefined);

  // Aceita mensagem se tem texto OU áudio (transcrito downstream) OU IMAGEM
  // (a Ayla lê a foto — lição, rótulo, agenda) OU VÍDEO.
  //
  // ⚠️ VÍDEO ENTRA, E ENTRA ATÉ SEM URL. Não é para assistir — a Kolo não baixa
  // nem analisa vídeo. É para não emudecer: até 13/08/2026 este `return null`
  // fazia o webhook responder `{skipped:true}` e a mãe que mandou o filho em
  // crise não recebia nem um "recebi". Áudio e imagem seguem exigindo URL,
  // porque para eles a URL é o conteúdo.
  const ehAudio = Boolean(midiaUrl) && midiaTipo === "audio";
  const ehImagem = Boolean(midiaUrl) && midiaTipo === "image";
  const ehVideo = midiaTipo === "video";
  if (!texto.trim() && !ehAudio && !ehImagem && !ehVideo) return null;

  // Timestamp
  const tsMs =
    typeof p.timestamp === "number"
      ? p.timestamp * (p.timestamp < 1e12 ? 1000 : 1)
      : Date.now();

  // Id da mensagem (varia entre Z-API e n8n) — trava de idempotência.
  const messageId =
    pickString(p.messageId) ??
    pickString(p.zaapId) ??
    pickString(p.id) ??
    pickString((p.message as Record<string, unknown> | undefined)?.id) ??
    undefined;

  return {
    phoneE164,
    texto,
    recebidaEm: new Date(tsMs),
    midiaUrl,
    midiaTipo,
    messageId,
  };
}

function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
