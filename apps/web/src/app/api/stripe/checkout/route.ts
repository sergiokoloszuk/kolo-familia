import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarCheckoutFiscal } from "@/lib/fiscal/checkout";
import { dadosFiscaisSchema, primeiraMensagemDeErro } from "@/lib/fiscal/dados";
import { trackFeature } from "@/lib/analytics/track";
import { logServerError } from "@/lib/log";

/**
 * Compatibilidade com o cliente antigo. Usa a mesma porta fiscal da tela:
 * nenhuma sessão é criada sem nome completo, CPF e endereço validados.
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
  const parsed = dadosFiscaisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: primeiraMensagemDeErro(parsed.error) }, { status: 400 });
  }

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

  const { data: subAcc, error: subError } = await supabase
    .from("subscription_accesses")
    .select("stripe_customer_id")
    .eq("family_account_id", family.id)
    .maybeSingle();
  if (subError) {
    await logServerError("checkout_fiscal_cliente_falhou", subError, {
      family_account_id: family.id,
    });
    return NextResponse.json(
      { error: "Não consegui preparar o pagamento agora." },
      { status: 500 },
    );
  }

  try {
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const checkout = await criarCheckoutFiscal({
      familyId: family.id,
      origin,
      stripeCustomerId: (subAcc?.stripe_customer_id as string | null) ?? null,
      dados: parsed.data,
    });
    await trackFeature({
      familyId: family.id,
      evento: "checkout_iniciado",
      detalhe: { plano: checkout.plano, fiscal: true },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    await logServerError("checkout_fiscal_api_falhou", e, {
      family_account_id: family.id,
    });
    return NextResponse.json(
      { error: "Não consegui abrir o pagamento agora. Confira os dados e tente novamente." },
      { status: 503 },
    );
  }
}
