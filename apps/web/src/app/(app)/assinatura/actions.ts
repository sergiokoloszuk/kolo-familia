"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { trackFeature } from "@/lib/analytics/track";
import { logServerError } from "@/lib/log";
import { criarCheckoutFiscal } from "@/lib/fiscal/checkout";
import {
  dadosFiscaisSchema,
  primeiraMensagemDeErro,
  type DadosFiscaisInput,
} from "@/lib/fiscal/dados";

async function requireFamilyAndOrigin(): Promise<{
  familyId: string;
  origin: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");

  // Deriva origin do request (Stripe live exige HTTPS em success_url/cancel_url).
  // Cai em NEXT_PUBLIC_APP_URL só se header faltar; localhost só em dev.
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    familyId: family.id,
    origin,
  };
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Não existe mais Checkout sem dados fiscais: esta é a única ação da tela.
 * Retorna Result porque o Next esconde mensagens de exceção em produção.
 */
export async function iniciarCheckoutComDadosFiscais(
  input: DadosFiscaisInput,
): Promise<CheckoutResult> {
  const validacao = dadosFiscaisSchema.safeParse(input);
  if (!validacao.success) {
    return { ok: false, error: primeiraMensagemDeErro(validacao.error) };
  }

  let familyId: string | null = null;
  try {
    const contexto = await requireFamilyAndOrigin();
    familyId = contexto.familyId;
    const supabase = await createClient();
    const { data: subAcc, error: subError } = await supabase
      .from("subscription_accesses")
      .select("stripe_customer_id")
      .eq("family_account_id", familyId)
      .maybeSingle();
    if (subError) throw subError;

    const checkout = await criarCheckoutFiscal({
      familyId,
      origin: contexto.origin,
      stripeCustomerId: (subAcc?.stripe_customer_id as string | null) ?? null,
      dados: validacao.data,
    });
    await trackFeature({
      familyId,
      evento: "checkout_iniciado",
      detalhe: { plano: checkout.plano, fiscal: true },
    });
    return { ok: true, url: checkout.url };
  } catch (e) {
    await logServerError(
      "checkout_fiscal_falhou",
      e,
      familyId ? { family_account_id: familyId } : undefined,
    );
    return {
      ok: false,
      error: "Não consegui abrir o pagamento agora. Confira os dados e tente novamente.",
    };
  }
}

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function abrirPortal(): Promise<PortalResult> {
  try {
    const { familyId, origin } = await requireFamilyAndOrigin();
    const supabase = await createClient();
    const { data: subAcc } = await supabase
      .from("subscription_accesses")
      .select("stripe_customer_id")
      .eq("family_account_id", familyId)
      .maybeSingle();

    if (!subAcc?.stripe_customer_id) {
      return {
        ok: false,
        error: "Você ainda não tem assinatura paga. Use 'Assinar agora' primeiro.",
      };
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subAcc.stripe_customer_id,
      return_url: `${origin}/assinatura`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro desconhecido ao abrir o portal",
    };
  }
}
