import { BLACK_FRIDAY_2026 } from "./black-friday-2026";
import { getStripeClient } from "@/lib/stripe/client";

export type PricePromocional = {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: null | { interval: string; interval_count: number };
};

export type ConferenciaOferta = {
  ok: boolean;
  priceId: string | null;
  valorCentavos: number | null;
  problema: string | null;
};

export function priceIdBlackFriday(): string {
  return process.env.STRIPE_PRICE_ID_BLACK_FRIDAY?.trim() ?? "";
}

/**
 * A variável permite preparar preview e produção separadamente; o ID aprovado
 * impede que alguém aponte a campanha, por engano, para outro preço válido.
 */
export function conferirOfertaBlackFriday(
  price: PricePromocional,
  configurado = priceIdBlackFriday(),
): ConferenciaOferta {
  if (!configurado) {
    return { ok: false, priceId: null, valorCentavos: null, problema: "STRIPE_PRICE_ID_BLACK_FRIDAY não está configurada." };
  }
  if (configurado !== BLACK_FRIDAY_2026.priceIdAprovado) {
    return { ok: false, priceId: configurado, valorCentavos: null, problema: "O ID configurado não é o preço aprovado por Karina." };
  }
  if (price.id !== configurado) {
    return { ok: false, priceId: configurado, valorCentavos: null, problema: "O Stripe devolveu outro preço." };
  }
  if (!price.active) {
    return { ok: false, priceId: price.id, valorCentavos: null, problema: "O preço promocional está arquivado no Stripe." };
  }
  if (price.currency.toLowerCase() !== BLACK_FRIDAY_2026.moeda) {
    return { ok: false, priceId: price.id, valorCentavos: null, problema: "O preço promocional não está em reais." };
  }
  if (price.unit_amount !== BLACK_FRIDAY_2026.valorCentavos) {
    return { ok: false, priceId: price.id, valorCentavos: null, problema: "O preço promocional não é R$ 39,90." };
  }
  if (
    !price.recurring ||
    price.recurring.interval !== BLACK_FRIDAY_2026.intervalo ||
    price.recurring.interval_count !== BLACK_FRIDAY_2026.intervaloCount
  ) {
    return { ok: false, priceId: price.id, valorCentavos: null, problema: "O preço promocional não cobra uma vez por mês." };
  }
  return { ok: true, priceId: price.id, valorCentavos: price.unit_amount, problema: null };
}

/** Somente leitura: nunca cria Customer, checkout, assinatura ou cobrança. */
export async function lerOfertaBlackFridayNoStripe(): Promise<ConferenciaOferta> {
  const priceId = priceIdBlackFriday();
  if (!priceId) return conferirOfertaBlackFriday({
    id: "",
    active: false,
    currency: "",
    unit_amount: null,
    recurring: null,
  }, priceId);

  try {
    const price = await getStripeClient().prices.retrieve(priceId);
    return conferirOfertaBlackFriday(price, priceId);
  } catch {
    return { ok: false, priceId, valorCentavos: null, problema: "Não consegui consultar o preço promocional no Stripe." };
  }
}
