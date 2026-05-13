import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseZapiWebhook } from "@/lib/ayla/whatsappSender";
import { processInbound } from "@/lib/ayla/orchestrator";

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

  try {
    const result = await processInbound(supabase, inbound);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro desconhecido";
    console.error(`[ayla webhook] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
