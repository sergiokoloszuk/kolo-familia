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

/**
 * FORÇA DA EVIDÊNCIA — a autoridade de um evento do Stripe sobre o acesso.
 *
 * `mapStripeStatus` responde "que status interno este status do Stripe
 * significa?". Ela não responde "este evento tem autoridade para decidir?" —
 * e era essa a pergunta que faltava.
 *
 *   paga     o Stripe afirma que há direito de uso (active/trialing)
 *   neutra   checkout EM CURSO: `incomplete` não afirma nada sobre direito.
 *            Status desconhecido também não decide — antes caía em past_due
 *            por `default`, ou seja, um status novo do Stripe tirava acesso.
 *   negativa o Stripe afirma que o direito acabou ou falhou
 *
 * Por que isto existe: `incomplete` é transitório e aparece em TODO checkout.
 * Traduzido para `past_due`, ele fazia todo pagamento passar, por alguns
 * segundos, por um estado que a Kolo lê como inadimplência — e, se o evento
 * positivo não chegasse ou não gravasse, a família ficava trancada ali. Foi o
 * caso da Rochelle: `trialing` vencida quando o `incomplete` chegou, e a guarda
 * de então só protegia quem já estava `active`.
 */
export type ForcaEvidencia = "paga" | "neutra" | "negativa";

export function forcaDaEvidencia(s: Stripe.Subscription.Status): ForcaEvidencia {
  switch (s) {
    case "active":
    case "trialing":
      return "paga";
    case "incomplete":
      return "neutra";
    case "past_due":
    case "unpaid":
    case "paused":
    case "canceled":
    case "incomplete_expired":
      return "negativa";
    default:
      return "neutra";
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
