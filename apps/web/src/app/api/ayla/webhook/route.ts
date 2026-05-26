import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarTexto, parseZapiWebhook } from "@/lib/ayla/whatsappSender";
import { processInbound } from "@/lib/ayla/orchestrator";
import { transcreverAudio } from "@/lib/ayla/transcribe";

// A resposta da Ayla agora passa por IA (Sonnet), que leva alguns segundos.
// Damos tempo ao processamento em background; ver `after()` abaixo.
export const maxDuration = 60;

/**
 * Webhook da Ayla — recebe mensagens do Z-API (direto ou via n8n).
 *
 * Z-API não exige assinatura criptográfica nos webhooks; pra impedir
 * spam, validamos um header secreto AYLA_WEBHOOK_SECRET. n8n manda esse
 * header na chamada; Z-API direto pode ser configurado pra mandar header
 * customizado também.
 *
 * Usa service role: a Ayla é "outro mundo" sem sessão de usuário.
 * Comunicação com o app é só via banco.
 */
export async function POST(request: NextRequest) {
  // Validação de origem
  const expectedSecret = process.env.AYLA_WEBHOOK_SECRET;
  if (expectedSecret) {
    const got = request.headers.get("x-ayla-secret");
    if (got !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  console.log("[ayla webhook] raw payload:", JSON.stringify(payload).slice(0, 600));

  const inbound = parseZapiWebhook(payload);
  if (!inbound) {
    console.log("[ayla webhook] parser retornou null — skipped");
    return NextResponse.json({ skipped: true });
  }
  console.log("[ayla webhook] parsed:", { phone: inbound.phoneE164, texto: inbound.texto });

  const supabase = createServiceRoleClient();

  // Confirma o recebimento na hora e processa em background. Assim a Z-API
  // recebe 200 em <1s e NÃO reenvia o webhook (era o que duplicava as
  // respostas quando o processamento ficava lento com a IA).
  after(async () => {
    try {
      let inboundFinal = inbound;

      // Áudio puro (sem texto) → STT via Whisper. Em caso de falha, manda
      // fallback amigável e não tenta processar (parser não funciona vazio).
      if (
        !inbound.texto.trim() &&
        inbound.midiaUrl &&
        inbound.midiaTipo === "audio"
      ) {
        const transcrito = await transcreverAudio(inbound.midiaUrl);
        if (transcrito) {
          console.log(
            `[ayla webhook] áudio transcrito (${transcrito.length} chars)`,
          );
          inboundFinal = { ...inbound, texto: transcrito };
        } else {
          console.warn("[ayla webhook] transcrição falhou — enviando fallback");
          try {
            await enviarTexto({
              phoneE164: inbound.phoneE164,
              texto:
                "Não consegui ouvir o áudio agora 🌿 Pode mandar de novo, ou escrever em texto?",
            });
          } catch {
            /* fallback é best-effort */
          }
          return;
        }
      }

      await processInbound(supabase, inboundFinal);
    } catch (e) {
      console.error(`[ayla webhook] erro no processamento:`, e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}
