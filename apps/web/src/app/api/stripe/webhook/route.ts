import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEvent, logServerError } from "@/lib/log";
import {
  mapStripeStatus,
  isoFromUnix,
  getSubPeriodEnd,
  forcaDaEvidencia,
} from "@/lib/stripe/status";
import {
  conferirEscrita,
  exigirFamiliaResolvida,
  avisarFamiliaNaoResolvida,
} from "@/lib/stripe/acesso";

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
 * DUAS REGRAS GOVERNAM TUDO AQUI:
 *
 * 1. **Escrita crítica é conferida** (`conferirEscrita`, §7 do protocolo). O
 *    cliente Supabase devolve o erro em vez de lançar; sem conferir, a falha
 *    vira 2xx e o Stripe nunca reenvia.
 * 2. **Autoridade da evidência** (`forcaDaEvidencia`). Quem decide sobre acesso
 *    é a força do que o Stripe afirma, não o último evento que escreveu.
 *    Evidência neutra (`incomplete`) atualiza vínculos e NÃO mexe no status.
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
        await onCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          admin,
          stripe,
          event,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription, admin, event);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription, admin, event);
        break;
      case "invoice.payment_succeeded":
        await onInvoiceSucceeded(event.data.object as Stripe.Invoice, admin, stripe, event);
        break;
      case "invoice.payment_failed":
        await onInvoiceFailed(event.data.object as Stripe.Invoice, admin, event);
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
    // 500 faz Stripe retentar. Útil pra falhas transitórias — e agora também
    // pra falha de persistência, que antes terminava como sucesso.
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
  event: Stripe.Event,
) {
  // Evento de DINHEIRO: sem família resolvível, falha visível. Antes era um
  // `console.warn` + `return` — pagamento entrava e ninguém ficava sabendo.
  const familyId = await exigirFamiliaResolvida(
    pickFamilyId(session.metadata, session.client_reference_id),
    { kind: "stripe_checkout_sem_familia", eventId: event.id, eventType: event.type },
  );

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

  // Sessão concluída SEM pagamento (fluxo assíncrono ainda pendente) não
  // concede acesso — quem concede é o `async_payment_succeeded` ou o
  // `invoice.payment_succeeded` que vêm depois. Grava só o vínculo.
  const pago =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";

  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: false,
  };
  if (pago) {
    patch.status = "active";
    // Regularizou pagando de novo → limpa o carimbo de dunning, senão a linha
    // fica active com carimbo antigo e o cron de exclusão pode encontrá-la
    // depois de um cancelamento futuro.
    patch.pagamento_falhou_em = null;
  }

  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update(patch)
      .eq("family_account_id", familyId)
      .select("family_account_id"),
    {
      kind: "stripe_checkout_completed",
      familyId,
      eventId: event.id,
      eventType: event.type,
      decisao: pago ? "concede" : "vinculo",
      campos: Object.keys(patch),
      stripeStatus: session.payment_status ?? null,
    },
  );
}

async function onSubscriptionChanged(
  sub: Stripe.Subscription,
  admin: AdminClient,
  event: Stripe.Event,
) {
  const familyId = pickFamilyId(sub.metadata);
  if (!familyId) {
    // Ciclo de vida, não dinheiro: retry não faria a metadata aparecer.
    // Fica observável e o processamento segue.
    await avisarFamiliaNaoResolvida({
      kind: "stripe_subscription_sem_familia",
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  const forca = forcaDaEvidencia(sub.status);
  const patch: Record<string, unknown> = {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: isoFromUnix(getSubPeriodEnd(sub)),
    cancel_at_period_end: sub.cancel_at_period_end,
  };

  const { data: atual } = await admin
    .from("subscription_accesses")
    .select("status")
    .eq("family_account_id", familyId)
    .maybeSingle();
  const statusAnterior = (atual?.status as string | null) ?? null;

  let decisao = "vinculo";
  const statusMapeado = mapStripeStatus(sub.status);
  if (forca === "paga" && statusMapeado === "trialing" && statusAnterior === "active") {
    // `trialing` é evidência positiva, mas MAIS FRACA que `active`: trocar um
    // pelo outro tiraria o acesso de quem pagou, porque o trial interno vale
    // até `trial_ends_at` — que pode estar no passado. Mantém.
    decisao = "mantem";
  } else if (forca === "paga") {
    patch.status = statusMapeado;
    if (patch.status === "active") patch.pagamento_falhou_em = null;
    decisao = "concede";
  } else if (forca === "negativa" && statusAnterior !== "active") {
    patch.status = statusMapeado;
    decisao = "remove";
  } else if (forca === "negativa") {
    // Sincronização de ciclo de vida NÃO rebaixa quem já tem evidência
    // positiva aplicada. Quem tira o acesso de um pagante é o
    // `invoice.payment_failed` (que carimba a falha e abre a graça) ou o
    // `subscription.deleted` — os dois têm autoridade total logo abaixo.
    decisao = "mantem";
  }
  // forca === "neutra" → decisao segue "vinculo": grava os ids e o período,
  // não toca no status. É aqui que a classe Rochelle morre.

  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update(patch)
      .eq("family_account_id", familyId)
      .select("family_account_id"),
    {
      kind: "stripe_subscription_changed",
      familyId,
      eventId: event.id,
      eventType: event.type,
      decisao,
      campos: Object.keys(patch),
      statusAnterior,
      stripeStatus: sub.status,
    },
  );
}

async function onSubscriptionDeleted(
  sub: Stripe.Subscription,
  admin: AdminClient,
  event: Stripe.Event,
) {
  const familyId = pickFamilyId(sub.metadata);
  if (!familyId) {
    await avisarFamiliaNaoResolvida({
      kind: "stripe_subscription_sem_familia",
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }
  // Cancelamento real: autoridade total, rebaixa inclusive quem está active.
  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update({ status: "canceled", cancel_at_period_end: false })
      .eq("family_account_id", familyId)
      .select("family_account_id"),
    {
      kind: "stripe_subscription_deleted",
      familyId,
      eventId: event.id,
      eventType: event.type,
      decisao: "remove",
      campos: ["status", "cancel_at_period_end"],
      stripeStatus: sub.status,
    },
  );
}

async function onInvoiceSucceeded(
  invoice: Stripe.Invoice,
  admin: AdminClient,
  stripe: Stripe,
  event: Stripe.Event,
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  // Evento de DINHEIRO: sem família resolvível, falha visível.
  const familyId = await exigirFamiliaResolvida(pickFamilyId(sub.metadata), {
    kind: "stripe_invoice_sem_familia",
    eventId: event.id,
    eventType: event.type,
  });
  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update({
        status: "active",
        current_period_end: isoFromUnix(getSubPeriodEnd(sub)),
        pagamento_falhou_em: null, // regularizou → limpa o carimbo (não apaga dados)
      })
      .eq("family_account_id", familyId)
      .select("family_account_id"),
    {
      kind: "stripe_invoice_succeeded",
      familyId,
      eventId: event.id,
      eventType: event.type,
      decisao: "concede",
      campos: ["status", "current_period_end", "pagamento_falhou_em"],
      stripeStatus: sub.status,
    },
  );
}

async function onInvoiceFailed(
  invoice: Stripe.Invoice,
  admin: AdminClient,
  event: Stripe.Event,
) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  // Evidência negativa REAL — dunning. Casa por cliente porque a fatura não
  // carrega a metadata da família. Zero linhas aqui significa cliente do
  // Stripe sem linha na Kolo (conta já excluída, por exemplo): fica
  // registrado, mas não adianta o Stripe retentar — por isso não lança.
  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update({ status: "past_due" })
      .eq("stripe_customer_id", customerId)
      .select("family_account_id"),
    {
      kind: "stripe_invoice_failed",
      eventId: event.id,
      eventType: event.type,
      decisao: "remove",
      campos: ["status"],
      exigirLinha: false,
    },
  );
  // Carimba a 1ª falha (só se ainda não houver) — inicia a contagem dos 7 dias
  // de graça/retenção. Não sobrescreve numa 2ª retentativa que também falha —
  // e por isso zero linhas aqui é resultado esperado, não falha.
  await conferirEscrita(
    admin
      .from("subscription_accesses")
      .update({ pagamento_falhou_em: new Date().toISOString() })
      .eq("stripe_customer_id", customerId)
      .is("pagamento_falhou_em", null)
      .select("family_account_id"),
    {
      kind: "stripe_invoice_failed_carimbo",
      eventId: event.id,
      eventType: event.type,
      decisao: "remove",
      campos: ["pagamento_falhou_em"],
      exigirLinha: false,
    },
  );
}

async function registrarEvento(event: Stripe.Event, admin: AdminClient) {
  // Tenta extrair family_account_id; se não conseguir, ainda registra
  // (legítimos eventos como customer.created não têm esse vínculo).
  const obj = event.data.object as { metadata?: Record<string, string> | null };
  const familyId = pickFamilyId(obj.metadata ?? null);
  if (!familyId) return;
  // `stripe_event_id` é UNIQUE: o reenvio do mesmo evento bate na constraint e
  // é tratado como replay, não como falha.
  await conferirEscrita(
    admin
      .from("assinaturas")
      .insert({
        family_account_id: familyId,
        stripe_event_id: event.id,
        evento: event.type,
        payload: event as unknown as Record<string, unknown>,
      })
      .select("id"),
    {
      kind: "stripe_evento_registrado",
      familyId,
      eventId: event.id,
      eventType: event.type,
      exigirLinha: false,
      tolerarDuplicata: true,
    },
  );
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

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Stripe API: subscription pode vir como string ou objeto, dependendo da
  // versão.
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}
