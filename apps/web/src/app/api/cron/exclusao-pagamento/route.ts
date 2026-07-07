import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { logEvent } from "@/lib/log";
import { RETENCAO_DIAS } from "@/lib/auth/assinatura";

/**
 * Cron diário do DUNNING: apaga os dados de quem falhou o pagamento há mais de
 * RETENCAO_DIAS (7) e AINDA não regularizou. O gatilho é o carimbo
 * `pagamento_falhou_em` + status past_due/canceled — NUNCA o webhook de
 * cancelamento (que também dispara em cancelamento involuntário).
 *
 * ⚠️ TRAVA DE SEGURANÇA: só apaga de verdade se DUNNING_DELETE_ENABLED === "true".
 * Sem isso, roda em DRY-RUN (só lista/loga quem SERIA apagado) — pra validar o
 * fluxo com calma antes de ligar a exclusão real de dado sensível.
 *
 * Protegido por CRON_SECRET (Authorization: Bearer <secret>).
 */
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const apagarDeVerdade = process.env.DUNNING_DELETE_ENABLED === "true";
  const admin = createServiceRoleClient();
  const limite = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();

  // Falha há mais de 7 dias e ainda em dunning (regularizou → carimbo já foi limpo).
  const { data: alvos } = await admin
    .from("subscription_accesses")
    .select("family_account_id, stripe_subscription_id, status, cortesia, pagamento_falhou_em")
    .not("pagamento_falhou_em", "is", null)
    .lte("pagamento_falhou_em", limite)
    .in("status", ["past_due", "canceled"]);

  const candidatos = (alvos ?? []).filter((a) => a.cortesia !== true && a.family_account_id);
  let apagados = 0;
  const alvosLog: string[] = [];

  for (const a of candidatos) {
    const familyId = a.family_account_id as string;
    const { data: fam } = await admin
      .from("family_accounts")
      .select("user_id")
      .eq("id", familyId)
      .maybeSingle();
    const userId = fam?.user_id as string | null;
    if (!userId) continue;
    alvosLog.push(familyId);

    if (!apagarDeVerdade) continue; // DRY-RUN: só lista

    // Cancela a assinatura no Stripe (best-effort) antes de apagar.
    const subId = a.stripe_subscription_id as string | null;
    if (subId) {
      try {
        await getStripeClient().subscriptions.cancel(subId);
      } catch {
        /* best-effort */
      }
    }
    // Apaga o usuário → cascateia tudo (mesma engine da exclusão explícita).
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (!error) {
      apagados += 1;
      await logEvent({
        kind: "conta_excluida_dunning",
        severity: "warn",
        user_id: userId,
        family_account_id: familyId,
        message: `Dados apagados após ${RETENCAO_DIAS} dias de falha de pagamento sem regularizar.`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: !apagarDeVerdade,
    candidatos: candidatos.length,
    apagados,
    familias: alvosLog,
  });
}
