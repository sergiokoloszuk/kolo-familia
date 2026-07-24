import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEvent, logServerError } from "@/lib/log";

/**
 * Webhook do Stripe — recebe eventos de assinatura e atualiza
 * subscription_accesses. Usa service role pra bypassar RLS, já que o
 * Stripe não tem sessão de usuário.
 *
 * Eventos tratados (PRD §5.2):
 *   - checkout.session.completed       → primeira ativação
 *   - customer.subscription.created    → reforço (idempotente com o anterior)
 *   - customer.subscription.updated    → mudanças de plano, cancel scheduled
 *   - customer.subscription.deleted    → status=canceled
 *   - invoice.payment_succeeded        → status=active, atualiza period_end
 *   - invoice.payment_failed           → status=past_due
 *
 * Configurar no Stripe Dashboard → Developers → Webhooks com a URL
 * https://seu-dominio/api/stripe/webhook e o STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "webhook secret missing" }, { status: 500 });
  }

  const body = await request.text();

  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[stripe webhook] verificação falhou: ${message}`);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, admin, stripe);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription, admin);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription, admin);
        break;
      case "invoice.payment_succeeded":
        await onInvoiceSucceeded(event.data.object as Stripe.Invoice, admin, stripe);
        break;
      case "invoice.payment_failed":
        await onInvoiceFailed(event.data.object as Stripe.Invoice, admin);
        break;
      default:
        // Não-tratado, mas reconhecido. Stripe espera 2xx pra parar de retentar.
        break;
    }

    // Auditoria — registra todos os eventos relevantes em assinaturas
    await registrarEvento(event, admin);
  } catch (err) {
    await logServerError("stripe_webhook", err, {
      payload: { event_type: event.type, event_id: event.id },
    });
    const message = err instanceof Error ? err.message : "unknown";
    // 500 faz Stripe retentar. Útil pra falhas transitórias.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await logEvent({
    kind: "stripe_webhook",
    severity: "info",
    message: `processed ${event.type}`,
    payload: { event_type: event.type, event_id: event.id },
  });
  return NextResponse.json({ received: true });
}

// ---------- handlers ----------

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function onCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  admin: AdminClient,
  stripe: Stripe,
) {
  const familyId = pickFamilyId(session.metadata, session.client_reference_id);
  if (!familyId) {
    console.warn("[stripe webhook] checkout sem family_account_id na metadata");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let currentPeriodEnd: string | null = null;
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEnd = isoFromUnix(getSubPeriodEnd(sub));
  }

  await admin
    .from("subscription_accesses")
    .update({
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: false,
    })
    .eq("family_account_id", familyId);
}

async function onSubscriptionChanged(sub: Stripe.Subscription, admin: AdminClient) {
  const familyId = pickFamilyId(sub.metadata);
  if (!familyId) return;

  const status = mapStripeStatus(sub.status);
  const patch: Record<string, unknown> = {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: isoFromUnix(getSubPeriodEnd(sub)),
    cancel_at_period_end: sub.cancel_at_period_end,
  };

  // GUARDA CONTRA CORRIDA DE EVENTOS: um subscription.created/updated atrasado
  // (ou com status transitório tipo 'incomplete' durante o processamento) NÃO
  // pode rebaixar um 'active' já confirmado pelo checkout. Quem rebaixa por falta
  // de pagamento é o invoice.payment_failed (que carimba pagamento_falhou_em);
  // cancelamento é o subscription.deleted. Sem esta guarda, o pagante paga, o
  // checkout ativa, e um evento atrasado o tranca em past_due — foi o caso da
  // Rochelle (current_period_end um mês à frente, mas status past_due).
  if (status === "past_due") {
    const { data: atual } = await admin
      .from("subscription_accesses")
      .select("status")
      .eq("family_account_id", familyId)
      .maybeSingle();
    if (atual?.status === "active") {
      await admin.from("subscription_accesses").update(patch).eq("family_account_id", familyId);
      return;
    }
  }

  patch.status = status;
  // Voltou a active (ex.: retentativa deu certo) → limpa o carimbo de falha.
  if (status === "active") patch.pagamento_falhou_em = null;
  await admin.from("subscription_accesses").update(patch).eq("family_account_id", familyId);
}

async function onSubscriptionDeleted(sub: Stripe.Subscription, admin: AdminClient) {
  const familyId = pickFamilyId(sub.metadata);
  if (!familyId) return;
  await admin
    .from("subscription_accesses")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
    })
    .eq("family_account_id", familyId);
}

async function onInvoiceSucceeded(
  invoice: Stripe.Invoice,
  admin: AdminClient,
  stripe: Stripe,
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const familyId = pickFamilyId(sub.metadata);
  if (!familyId) return;
  await admin
    .from("subscription_accesses")
    .update({
      status: "active",
      current_period_end: isoFromUnix(getSubPeriodEnd(sub)),
      pagamento_falhou_em: null, // regularizou → limpa o carimbo (não apaga dados)
    })
    .eq("family_account_id", familyId);
}

async function onInvoiceFailed(invoice: Stripe.Invoice, admin: AdminClient) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  await admin
    .from("subscription_accesses")
    .update({ status: "past_due" })
    .eq("stripe_customer_id", customerId);
  // Carimba a 1ª falha (só se ainda não houver) — inicia a contagem dos 7 dias
  // de graça/retenção. Não sobrescreve numa 2ª retentativa que também falha.
  await admin
    .from("subscription_accesses")
    .update({ pagamento_falhou_em: new Date().toISOString() })
    .eq("stripe_customer_id", customerId)
    .is("pagamento_falhou_em", null);
}

async function registrarEvento(event: Stripe.Event, admin: AdminClient) {
  // Tenta extrair family_account_id; se não conseguir, ainda registra
  // (legítimos eventos como customer.created não têm esse vínculo).
  const obj = event.data.object as { metadata?: Record<string, string> | null };
  const familyId = pickFamilyId(obj.metadata ?? null);
  if (!familyId) return;
  await admin.from("assinaturas").insert({
    family_account_id: familyId,
    stripe_event_id: event.id,
    evento: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
}

// ---------- helpers ----------

function pickFamilyId(
  metadata: Stripe.Metadata | null | undefined,
  clientReferenceId?: string | null,
): string | null {
  if (metadata && typeof metadata.family_account_id === "string") {
    return metadata.family_account_id;
  }
  return clientReferenceId ?? null;
}

function mapStripeStatus(s: Stripe.Subscription.Status): string {
  // Mapa Stripe → status interno do PRD §5.2
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "unpaid":
      return "past_due";
    default:
      return "past_due";
  }
}

function isoFromUnix(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

function getSubPeriodEnd(sub: Stripe.Subscription): number | null {
  // Em diferentes versões da API o período fica em lugares diferentes.
  // Os types do SDK v17+ removeram do top-level, mas o campo ainda chega
  // no payload. Acesso defensivo cobre os dois casos.
  const subEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof subEnd === "number") return subEnd;
  const itemEnd = (sub.items?.data?.[0] as unknown as { current_period_end?: number })
    ?.current_period_end;
  return typeof itemEnd === "number" ? itemEnd : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Stripe API: subscription pode vir como string ou objeto, dependendo da versão.
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}
