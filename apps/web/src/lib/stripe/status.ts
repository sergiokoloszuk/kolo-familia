import type Stripe from "stripe";

/**
 * Mapeia o status do Stripe → status interno (PRD §5.2). Fonte ÚNICA usada pelo
 * webhook e pelo re-sync manual, pra os dois traduzirem igual.
 */
export function mapStripeStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "unpaid":
      return "past_due";
    default:
      return "past_due";
  }
}

export function isoFromUnix(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

/**
 * Em diferentes versões da API o período fica em lugares diferentes: os types do
 * SDK v17+ removeram do top-level, mas o campo ainda chega no payload/objeto.
 */
export function getSubPeriodEnd(sub: Stripe.Subscription): number | null {
  const subEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subEnd === "number") return subEnd;
  const itemEnd = (sub.items?.data?.[0] as unknown as { current_period_end?: number })
    ?.current_period_end;
  return typeof itemEnd === "number" ? itemEnd : null;
}
