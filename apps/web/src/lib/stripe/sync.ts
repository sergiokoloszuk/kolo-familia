import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "./client";
import { mapStripeStatus, isoFromUnix, getSubPeriodEnd, forcaDaEvidencia } from "./status";

export type SyncResult =
  | {
      ok: true;
      antes: string | null;
      depois: string;
      stripeStatus: string;
      via: "subscription" | "customer";
      mudou: boolean;
    }
  | { ok: false; error: string };

// Prioridade pra escolher a assinatura "mais relevante" quando o cliente tem
// várias (a que dá acesso primeiro; entre iguais, a mais recente).
const PRIORIDADE: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  paused: 3,
  unpaid: 4,
  incomplete: 5,
  incomplete_expired: 8,
  canceled: 9,
};

/**
 * Re-sincroniza o status da assinatura de UMA família a partir do Stripe (a
 * FONTE DA VERDADE). Conserta o descompasso quando o webhook não chegou/atrasou
 * (ex.: pagou no Stripe mas o app ficou em past_due). Usa os MESMOS mapeamentos
 * do webhook. Nunca inventa: se não há vínculo com o Stripe, devolve erro claro.
 */
export async function sincronizarAssinaturaDoStripe(
  admin: SupabaseClient,
  familyId: string,
): Promise<SyncResult> {
  const { data: sa } = await admin
    .from("subscription_accesses")
    .select("status, stripe_customer_id, stripe_subscription_id")
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (!sa) return { ok: false, error: "Família sem linha de assinatura." };

  const antes = (sa.status as string | null) ?? null;
  const stripe = getStripeClient();

  let sub: Stripe.Subscription | null = null;
  let via: "subscription" | "customer" = "subscription";
  try {
    if (sa.stripe_subscription_id) {
      sub = await stripe.subscriptions.retrieve(sa.stripe_subscription_id as string);
    } else if (sa.stripe_customer_id) {
      via = "customer";
      const list = await stripe.subscriptions.list({
        customer: sa.stripe_customer_id as string,
        status: "all",
        limit: 10,
      });
      sub =
        [...list.data].sort(
          (a, b) =>
            (PRIORIDADE[a.status] ?? 7) - (PRIORIDADE[b.status] ?? 7) || b.created - a.created,
        )[0] ?? null;
    } else {
      return {
        ok: false,
        error: "Sem vínculo com o Stripe (nem customer nem subscription id). Confira se o checkout foi concluído.",
      };
    }
  } catch (e) {
    return { ok: false, error: `Falha ao consultar o Stripe: ${e instanceof Error ? e.message : "erro"}` };
  }
  if (!sub) return { ok: false, error: "Nenhuma assinatura encontrada no Stripe pra este cliente." };

  // MESMA regra de autoridade do webhook — uma política só, não duas. Um
  // `incomplete` no Stripe (checkout em curso) não afirma nada sobre direito de
  // uso: sincroniza os vínculos e deixa o status como está.
  const forca = forcaDaEvidencia(sub.status);
  const status =
    forca === "neutra" ? antes ?? mapStripeStatus(sub.status) : mapStripeStatus(sub.status);
  const patch: Record<string, unknown> = {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: isoFromUnix(getSubPeriodEnd(sub)),
    cancel_at_period_end: sub.cancel_at_period_end,
  };
  if (forca !== "neutra") {
    patch.status = status;
    // Voltou/está active → limpa o carimbo de falha (mesma lógica do webhook).
    if (status === "active") patch.pagamento_falhou_em = null;
  }

  const { error } = await admin
    .from("subscription_accesses")
    .update(patch)
    .eq("family_account_id", familyId);
  if (error) return { ok: false, error: `Falha ao gravar no banco: ${error.message}` };

  return { ok: true, antes, depois: status, stripeStatus: sub.status, via, mudou: antes !== status };
}
