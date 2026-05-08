import Stripe from "stripe";

let _client: Stripe | null = null;

/**
 * Cliente Stripe em singleton. Lança erro claro se a chave não estiver
 * configurada — pra não falhar com mensagem opaca em produção.
 */
export function getStripeClient(): Stripe {
  if (_client) return _client;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "STRIPE_SECRET_KEY não configurada. Adicione em apps/web/.env.local.",
    );
  }
  // apiVersion: usar a default — atualiza junto com o pacote stripe.
  _client = new Stripe(apiKey);
  return _client;
}

export const STRIPE_PRICE = {
  mensal: process.env.STRIPE_PRICE_ID_MENSAL || "",
  anual: process.env.STRIPE_PRICE_ID_ANUAL || "",
} as const;

export type PlanoTipo = keyof typeof STRIPE_PRICE;

export function priceIdFor(plano: PlanoTipo): string {
  const id = STRIPE_PRICE[plano];
  if (!id) {
    throw new Error(
      `STRIPE_PRICE_ID_${plano.toUpperCase()} não configurado em .env.local.`,
    );
  }
  return id;
}
