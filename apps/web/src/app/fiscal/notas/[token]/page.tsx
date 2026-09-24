import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

/**
 * Link fiscal administrativo de uso único. Só o hash do token fica no banco;
 * os dados pessoais são lidos do Customer Stripe no momento da abertura.
 */
export default async function NotaFiscalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) notFound();

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const agora = new Date().toISOString();
  const admin = createServiceRoleClient();

  // Consome antes de exibir: duas abas concorrentes não recebem o mesmo dado.
  const { data: alertas, error } = await admin
    .from("fiscal_alertas")
    .update({ token_hash: null, token_expira_em: null, acessado_em: agora, updated_at: agora })
    .eq("token_hash", tokenHash)
    .gt("token_expira_em", agora)
    .select("stripe_invoice_id, stripe_customer_id");
  if (error || alertas?.length !== 1) notFound();
  const alerta = alertas[0] as { stripe_invoice_id: string; stripe_customer_id: string };

  const stripe = getStripeClient();
  const [invoice, customer, taxIds] = await Promise.all([
    stripe.invoices.retrieve(alerta.stripe_invoice_id),
    stripe.customers.retrieve(alerta.stripe_customer_id),
    stripe.customers.listTaxIds(alerta.stripe_customer_id, { limit: 100 }),
  ]);
  if (customer.deleted) notFound();

  const cpf = taxIds.data
    .filter((taxId) => taxId.type === "br_cpf")
    .sort((a, b) => b.created - a.created)[0]?.value ?? null;
  const endereco = customer.address;
  const cidadeUf = [endereco?.city, endereco?.state].filter(Boolean).join(" / ");

  return (
    <main className="mx-auto max-w-xl p-6 text-foreground">
      <h1 className="text-2xl font-semibold">Dados para nota fiscal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este link foi consumido e não poderá ser aberto novamente.
      </p>
      <dl className="mt-6 grid gap-4 rounded-xl border p-5 text-sm">
        <Linha titulo="Nome completo" valor={customer.name ?? "Não informado"} />
        <Linha titulo="CPF" valor={cpf ?? "Não informado"} />
        <Linha titulo="E-mail" valor={customer.email ?? "Não informado"} />
        <Linha titulo="Endereço" valor={endereco?.line1 ?? "Não informado"} />
        <Linha titulo="Bairro / complemento" valor={endereco?.line2 ?? "Não informado"} />
        <Linha titulo="Cidade / UF" valor={cidadeUf || "Não informado"} />
        <Linha titulo="CEP" valor={endereco?.postal_code ?? "Não informado"} />
        <Linha
          titulo="Valor pago"
          valor={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: invoice.currency.toUpperCase(),
          }).format(invoice.amount_paid / 100)}
        />
        <Linha titulo="Invoice Stripe" valor={invoice.id} />
      </dl>
    </main>
  );
}

function Linha({ titulo, valor }: { titulo: string; valor: string }) {
  return <div><dt className="text-muted-foreground">{titulo}</dt><dd className="font-medium">{valor}</dd></div>;
}
