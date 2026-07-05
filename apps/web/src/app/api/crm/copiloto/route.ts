import { NextResponse, type NextRequest } from "next/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "@/lib/ayla/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { PLAYBOOK_COPILOTO } from "@/lib/crm/playbook";
import { carregarContextoLead } from "@/lib/crm/contexto";
import { carregarTimelineLead } from "@/lib/crm/timeline";

/**
 * Copiloto comercial — um turno de conversa. Só admin. Recebe o histórico do
 * chat e devolve a sugestão da IA (estratégia + mensagem/roteiro), ancorada no
 * playbook da agência + no contexto real do lead.
 */
export async function POST(request: NextRequest) {
  if (!(await ehAdmin())) {
    return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 403 });
  }

  let body: { familyId?: unknown; mensagens?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  const familyId = typeof body.familyId === "string" ? body.familyId : null;
  const mensagens = Array.isArray(body.mensagens) ? body.mensagens : [];
  if (!familyId) return NextResponse.json({ ok: false, error: "familyId ausente" }, { status: 400 });

  const historico = mensagens
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        (((m as { role?: unknown }).role === "user") || ((m as { role?: unknown }).role === "assistant")) &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-20);

  if (historico.length === 0) {
    return NextResponse.json({ ok: false, error: "sem mensagem" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const [ctx, timeline] = await Promise.all([
    carregarContextoLead(admin, familyId),
    carregarTimelineLead(admin, familyId),
  ]);
  const recentes = timeline
    .slice(-8)
    .map((t) => `- ${t.rotulo}: ${t.texto}`)
    .join("\n");
  const system =
    `${PLAYBOOK_COPILOTO}\n\n# Contexto do lead (real)\n${ctx.resumo}` +
    (recentes
      ? `\n\n# Conversa recente (NÃO repita o que a Ayla já disse; complemente)\n${recentes}`
      : "");

  try {
    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 900,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: historico,
    });
    await logarUsoApi(admin, {
      family_account_id: familyId,
      provider: "anthropic",
      model: AYLA_MODEL_FALLBACK,
      feature: "crm_copiloto",
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
    });
    const bloco = resp.content[0];
    const texto = bloco?.type === "text" ? bloco.text.trim() : "";
    return NextResponse.json({ ok: true, resposta: texto });
  } catch (e) {
    console.error("[crm:copiloto] falha:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "falha na IA" }, { status: 500 });
  }
}
