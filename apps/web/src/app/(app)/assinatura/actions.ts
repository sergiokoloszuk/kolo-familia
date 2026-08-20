"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, type PlanoTipo } from "@/lib/stripe/client";
import { exigirPlanoCobravel } from "@/lib/billing/planos";
import { trackFeature } from "@/lib/analytics/track";
import { logServerError } from "@/lib/log";

async function requireFamilyAndOrigin(): Promise<{
  familyId: string;
  userEmail: string | null;
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
    userEmail: user.email ?? null,
    origin,
  };
}

const planoSchema = z.object({ plano: z.enum(["mensal", "anual"]) });

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Cria a sessão de checkout do Stripe e devolve a URL. O Next esconde a
 * mensagem de exceções em produção ("Server Components render") — por isso
 * retornamos Result em vez de throw, pra mãe ver o motivo real.
 */
export async function iniciarCheckout(
  input: { plano: PlanoTipo },
): Promise<CheckoutResult> {
  try {
    const { plano } = planoSchema.parse(input);
    const { familyId, userEmail, origin } = await requireFamilyAndOrigin();

    const supabase = await createClient();
    const { data: subAcc } = await supabase
      .from("subscription_accesses")
      .select("stripe_customer_id")
      .eq("family_account_id", familyId)
      .maybeSingle();

    // ⛔ TRAVA FAIL-CLOSED — 20/08/2026. NÃO REMOVER.
    //
    // O plano anual esteve configurado no Stripe como `month × 1` a R$ 603,90:
    // quem clicasse aqui seria cobrado R$ 603,90 POR MÊS, com a tela dizendo
    // "por ano". Depois, a primeira correção criou um price `one_time`, que o
    // `mode: "subscription"` recusa — o botão daria erro na cara da mãe.
    //
    // Nenhum dos dois casos era detectável antes de cobrar. Agora é: esta
    // chamada confere, AO VIVO no Stripe, que o price tem a recorrência que o
    // nome do plano promete. Não batendo, o checkout não abre.
    //
    // Endpoint que move dinheiro é fail-closed (§16): recusar custa uma venda
    // adiada; cobrar errado custa a confiança de uma família e um estorno.
    let precoConferido;
    try {
      precoConferido = await exigirPlanoCobravel(plano);
    } catch (e) {
      await logServerError("checkout_preco_invalido", e, { family_account_id: familyId });
      return {
        ok: false,
        error:
          "Não consegui abrir o pagamento agora — a configuração deste plano está sendo corrigida. Tente o outro plano ou volte em instantes.",
      };
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: precoConferido.priceId as string, quantity: 1 }],
      customer: subAcc?.stripe_customer_id ?? undefined,
      customer_email: subAcc?.stripe_customer_id ? undefined : userEmail ?? undefined,
      client_reference_id: familyId,
      metadata: { family_account_id: familyId, plano },
      subscription_data: { metadata: { family_account_id: familyId, plano } },
      allow_promotion_codes: true,
      success_url: `${origin}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinatura?status=canceled`,
    });

    if (!session.url) return { ok: false, error: "Stripe não retornou URL" };
    await trackFeature({
      familyId,
      evento: "checkout_iniciado",
      detalhe: { plano },
    });
    return { ok: true, url: session.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro desconhecido ao iniciar checkout",
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
