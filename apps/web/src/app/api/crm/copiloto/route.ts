import { NextResponse, type NextRequest } from "next/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "@/lib/ayla/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { PLAYBOOK_COPILOTO } from "@/lib/crm/playbook";
import { carregarContextoLead } from "@/lib/crm/contexto";
import { carregarFaseScripts } from "@/lib/crm/fase-scripts";

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
  const [ctx, scripts] = await Promise.all([
    carregarContextoLead(admin, familyId),
    carregarFaseScripts(admin),
  ]);
  // NÃO injetamos o conteúdo da conversa que o lead teve com a Ayla — a
  // abordagem é sobre o valor da plataforma, nunca ecoa a história privada
  // dela. O copiloto trabalha só com os SINAIS do contexto (usou/não usou,
  // recebeu plano, dia do teste...) + o roteiro por fase.
  const roteiro = scripts
    .filter((s) => s.textoSugestao.trim())
    .map((s) => `- ${s.label}: ${s.textoSugestao}`)
    .join("\n");
  const system =
    `${PLAYBOOK_COPILOTO}\n\n# Contexto do lead (só sinais, sem a história dela)\n${ctx.resumo}` +
    (roteiro
      ? `\n\n# Roteiro por fase (base da Karina — use como ponto de partida, adaptando ao dia/estado do lead)\n${roteiro}`
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
