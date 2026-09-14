import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarTexto, parseZapiWebhook } from "@/lib/ayla/whatsappSender";
import { processInbound, idiomaPorTelefone } from "@/lib/ayla/orchestrator";
import { transcreverAudio } from "@/lib/ayla/transcribe";

// A resposta da Ayla passa por IA (Sonnet) e, num pedido de plano, ainda
// dispara a geração completa do plano (chamada única de até 12k tokens, ~40–90s)
// dentro do `after()`. Com 60s a função era morta no meio da geração e o plano
// nunca chegava. 300s (máx. do plano Pro) dá fôlego pra terminar.
export const maxDuration = 300;

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

  /**
   * ⚠️ AS CHAVES DO PAYLOAD, QUANDO O REMETENTE VEM COMO LID — 14/09/2026.
   *
   * O `console.log` acima trunca em 600 caracteres e morre com a retenção da
   * Vercel. Para consertar o LID de verdade é preciso saber SE a Z-API manda o
   * telefone real em algum outro campo — e essa pergunta não tinha como ser
   * respondida sem olhar um payload ao vivo no minuto certo.
   *
   * Aqui vão só os NOMES dos campos de primeiro nível. Nenhum valor: nome de
   * campo é forma do protocolo, não dado de ninguém.
   */
  const identificador =
    (typeof (payload as Record<string, unknown>)?.phone === "string"
      ? ((payload as Record<string, unknown>).phone as string)
      : "") || "";
  if (identificador.includes("@")) {
    console.error(
      "[ayla webhook] IDENTIFICADOR NÃO-TELEFONE — campos do payload:",
      JSON.stringify(Object.keys(payload as Record<string, unknown>)),
    );
  }

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
        // Dica de idioma pro Whisper pela língua da família (pt/es/en) — assim
        // áudio em espanhol transcreve em espanhol sem arriscar o português.
        const idiomaFamilia = await idiomaPorTelefone(supabase, inbound.phoneE164);
        const transcrito = await transcreverAudio(
          inbound.midiaUrl,
          {
            supabase,
            family_account_id: null,
            feature: "ayla_audio",
          },
          idiomaFamilia,
        );
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
