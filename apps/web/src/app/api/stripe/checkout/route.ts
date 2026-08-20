import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, type PlanoTipo } from "@/lib/stripe/client";
import { exigirPlanoCobravel } from "@/lib/billing/planos";
import { logServerError } from "@/lib/log";

const inputSchema = z.object({
  plano: z.enum(["mensal", "anual"]),
});

/**
 * Cria uma Stripe Checkout Session pra a família atual e retorna a URL.
 *
 * Fluxo:
 *   - precisa estar logado e ter family_account
 *   - reusa stripe_customer_id se já existir
 *   - passa client_reference_id + metadata.family_account_id pro webhook
 *   - sucesso → /assinatura?status=success ; cancel → /assinatura?status=canceled
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
  }
  const plano: PlanoTipo = parsed.data.plano;

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) {
    return NextResponse.json(
      { error: "Família não inicializada" },
      { status: 400 },
    );
  }

  const { data: subAcc } = await supabase
    .from("subscription_accesses")
    .select("stripe_customer_id")
    .eq("family_account_id", family.id)
    .maybeSingle();

  // ⛔ MESMA TRAVA FAIL-CLOSED do server action de `/assinatura` — 20/08/2026.
  //
  // Existem DOIS caminhos de checkout neste repositório, e uma trava que vale
  // só em um não vale em nenhum: bastaria a chamada entrar por aqui para a
  // cobrança errada passar. Ver o porquê inteiro em `lib/billing/planos.ts`.
  let precoConferido;
  try {
    precoConferido = await exigirPlanoCobravel(plano);
  } catch (e) {
    await logServerError("checkout_preco_invalido", e, { family_account_id: family.id });
    return NextResponse.json(
      { error: "Configuração do plano indisponível no momento." },
      { status: 503 },
    );
  }

  const stripe = getStripeClient();
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: precoConferido.priceId as string, quantity: 1 }],
    customer: subAcc?.stripe_customer_id ?? undefined,
    customer_email: subAcc?.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: family.id,
    metadata: { family_account_id: family.id, plano },
    subscription_data: {
      metadata: { family_account_id: family.id, plano },
    },
    allow_promotion_codes: true,
    success_url: `${origin}/assinatura?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/assinatura?status=canceled`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe não retornou URL de checkout" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
