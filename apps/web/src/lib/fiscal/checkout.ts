import { exigirPlanoCobravel } from "@/lib/billing/planos";
import { getStripeClient } from "@/lib/stripe/client";
import { dadosFiscaisSchema, enderecoStripe, type DadosFiscaisInput } from "./dados";
import { normalizarCpf } from "./cpf";

type CriarCheckoutFiscalArgs = {
  familyId: string;
  origin: string;
  stripeCustomerId: string | null;
  dados: DadosFiscaisInput;
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
}: CriarCheckoutFiscalArgs): Promise<{ url: string; plano: "mensal" | "anual" }> {
  const dados = dadosFiscaisSchema.parse(entrada);

  // Confere o preço antes de gravar qualquer dado fiscal no processador.
  const precoConferido = await exigirPlanoCobravel(dados.plano);
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: precoConferido.priceId as string, quantity: 1 }],
    customer: customerId,
    client_reference_id: familyId,
    metadata: { family_account_id: familyId, plano: dados.plano },
    subscription_data: { metadata: { family_account_id: familyId, plano: dados.plano } },
    allow_promotion_codes: true,
    success_url: `${origin}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/assinatura?status=canceled`,
  });

  if (!session.url) throw new Error("Stripe não retornou URL de checkout");
  return { url: session.url, plano: dados.plano };
}
