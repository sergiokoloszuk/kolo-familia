import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Cria uma Stripe Customer Portal session — pra mãe gerenciar pagamento,
 * trocar cartão, cancelar etc. Customer Portal precisa ser habilitado
 * no dashboard Stripe (Settings → Billing → Customer Portal).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) {
    return NextResponse.json({ error: "Família não inicializada" }, { status: 400 });
  }

  const { data: subAcc } = await supabase
    .from("subscription_accesses")
    .select("stripe_customer_id")
    .eq("family_account_id", family.id)
    .maybeSingle();

  if (!subAcc?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Sem assinatura Stripe ainda. Use Checkout primeiro." },
      { status: 400 },
    );
  }

  const stripe = getStripeClient();
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: subAcc.stripe_customer_id,
    return_url: `${origin}/assinatura`,
  });

  return NextResponse.json({ url: session.url });
}
