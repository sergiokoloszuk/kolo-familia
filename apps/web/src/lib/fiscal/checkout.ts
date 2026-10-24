import type Stripe from "stripe";
import { exigirPlanoCobravel } from "@/lib/billing/planos";
import { getStripeClient } from "@/lib/stripe/client";
import { dadosFiscaisSchema, enderecoStripe, type DadosFiscaisInput } from "./dados";
import { normalizarCpf } from "./cpf";
import { BLACK_FRIDAY_2026, instanteValido } from "@/lib/billing/black-friday-2026";
import type { OfertaDaFamilia } from "@/lib/billing/oferta-familia";

type CriarCheckoutFiscalArgs = {
  familyId: string;
  origin: string;
  stripeCustomerId: string | null;
  dados: DadosFiscaisInput;
  ofertaBlackFriday?: OfertaDaFamilia | null;
  registrarCheckoutBlackFriday?: (sessionId: string) => Promise<boolean>;
};

/**
 * Única porta que cria Checkout de assinatura. Nome, CPF e endereço são
 * validados antes da sessão e ficam somente no Customer da Stripe.
 */
export async function criarCheckoutFiscal({
  familyId,
  origin,
  stripeCustomerId,
  dados: entrada,
  ofertaBlackFriday = null,
  registrarCheckoutBlackFriday,
}: CriarCheckoutFiscalArgs): Promise<{ url: string; plano: "mensal" | "anual" }> {
  const dados = dadosFiscaisSchema.parse(entrada);

  // Confere o preço antes de gravar qualquer dado fiscal no processador.
  if (ofertaBlackFriday && dados.plano !== "mensal") {
    throw new Error("A oferta Black Friday é somente mensal.");
  }
  if (ofertaBlackFriday?.priceId !== undefined &&
      ofertaBlackFriday.priceId !== BLACK_FRIDAY_2026.priceIdAprovado) {
    throw new Error("Preço promocional diferente do aprovado.");
  }
  const precoConferido = ofertaBlackFriday
    ? { priceId: ofertaBlackFriday.priceId }
    : await exigirPlanoCobravel(dados.plano);
  const stripe = getStripeClient();
  const customerPayload = {
    name: dados.nomeFiscal,
    email: dados.emailFiscal,
    address: enderecoStripe(dados),
    metadata: { family_account_id: familyId },
  };

  let customerId = stripeCustomerId;
  if (customerId) {
    await stripe.customers.update(customerId, customerPayload);
  } else {
    const customer = await stripe.customers.create(customerPayload);
    customerId = customer.id;
  }

  const existentes = await stripe.customers.listTaxIds(customerId, { limit: 100 });
  const jaExiste = existentes.data.some(
    (taxId) => taxId.type === "br_cpf" && normalizarCpf(taxId.value) === dados.cpf,
  );
  // Tax IDs anteriores são preservados como histórico no processador. A tela
  // fiscal seleciona o br_cpf mais recente.
  if (!jaExiste) {
    await stripe.customers.createTaxId(customerId, { type: "br_cpf", value: dados.cpf });
  }

  const agoraMs = ofertaBlackFriday
    ? instanteValido(ofertaBlackFriday.checkoutIniciadoEm)
    : null;
  const trialFimMs = ofertaBlackFriday
    ? instanteValido(ofertaBlackFriday.trialFimEm)
    : null;
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    metadata: {
      family_account_id: familyId,
      plano: dados.plano,
      ...(ofertaBlackFriday ? { campanha: BLACK_FRIDAY_2026.chave } : {}),
    },
  };
  // Se a família assina durante o teste, a Stripe só cobra depois dos 15 dias.
  // Se o teste já acabou, a assinatura começa normalmente e cobra no checkout.
  if (trialFimMs !== null && agoraMs !== null && trialFimMs > agoraMs) {
    subscriptionData.trial_end = Math.floor(trialFimMs / 1000);
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: precoConferido.priceId as string, quantity: 1 }],
    customer: customerId,
    client_reference_id: familyId,
    metadata: {
      family_account_id: familyId,
      plano: dados.plano,
      ...(ofertaBlackFriday ? {
        campanha: BLACK_FRIDAY_2026.chave,
        oferta_fim_exclusivo: ofertaBlackFriday.ofertaFimExclusivo,
      } : {}),
    },
    subscription_data: subscriptionData,
    allow_promotion_codes: ofertaBlackFriday ? false : true,
    ...(ofertaBlackFriday ? {
      expires_at: Math.floor(Date.parse(ofertaBlackFriday.checkoutExpiraEm) / 1000),
    } : {}),
    success_url: `${origin}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}${ofertaBlackFriday ? "&campanha=black-friday-2026" : ""}`,
    cancel_url: `${origin}/assinatura?status=canceled`,
  };
  const options: Stripe.RequestOptions | undefined = ofertaBlackFriday && agoraMs !== null ? {
    // Repetição do mesmo clique na mesma meia hora devolve a mesma sessão.
    idempotencyKey: `bf2026:${familyId}:${Math.floor(agoraMs / (30 * 60 * 1000))}`,
  } : undefined;
  const session = options
    ? await stripe.checkout.sessions.create(params, options)
    : await stripe.checkout.sessions.create(params);

  if (!session.url) throw new Error("Stripe não retornou URL de checkout");
  if (ofertaBlackFriday) {
    if (!session.id || !registrarCheckoutBlackFriday) {
      if (session.id) await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error("Checkout promocional não pôde ser registrado.");
    }
    const registrado = await registrarCheckoutBlackFriday(session.id).catch(() => false);
    if (!registrado) {
      // Não deixa uma sessão válida no Stripe quando o banco não confirmou o
      // prazo. Falha fechada entre os dois sistemas.
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw new Error("Checkout promocional não pôde ser registrado.");
    }
  }
  return { url: session.url, plano: dados.plano };
}
