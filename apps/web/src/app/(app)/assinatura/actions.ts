"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, priceIdFor, type PlanoTipo } from "@/lib/stripe/client";

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

export async function iniciarCheckout(input: { plano: PlanoTipo }) {
  const { plano } = planoSchema.parse(input);
  const { familyId, userEmail, origin } = await requireFamilyAndOrigin();

  const supabase = await createClient();
  const { data: subAcc } = await supabase
    .from("subscription_accesses")
    .select("stripe_customer_id")
    .eq("family_account_id", familyId)
    .maybeSingle();

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plano), quantity: 1 }],
    customer: subAcc?.stripe_customer_id ?? undefined,
    customer_email: subAcc?.stripe_customer_id ? undefined : userEmail ?? undefined,
    client_reference_id: familyId,
    metadata: { family_account_id: familyId, plano },
    subscription_data: { metadata: { family_account_id: familyId, plano } },
    allow_promotion_codes: true,
    success_url: `${origin}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/assinatura?status=canceled`,
  });

  if (!session.url) throw new Error("Stripe não retornou URL");
  redirect(session.url);
}

export async function abrirPortal() {
  const { familyId, origin } = await requireFamilyAndOrigin();
  const supabase = await createClient();
  const { data: subAcc } = await supabase
    .from("subscription_accesses")
    .select("stripe_customer_id")
    .eq("family_account_id", familyId)
    .maybeSingle();

  if (!subAcc?.stripe_customer_id) {
    throw new Error("Você ainda não tem assinatura paga. Use 'Assinar agora' primeiro.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subAcc.stripe_customer_id,
    return_url: `${origin}/assinatura`,
  });
  redirect(session.url);
}
