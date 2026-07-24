import { requireAdmin } from "@/lib/auth/require-admin";
import { listarCortesias } from "./actions";
import { CortesiaForm } from "./cortesia-form";
import { SincronizarStripeForm } from "./sincronizar-stripe-form";

export default async function AdminCortesiasPage() {
  await requireAdmin();
  const cortesias = await listarCortesias();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Cortesias e assinaturas</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Acesso cortesia (grátis) por e-mail — <strong>vitalícia</strong> ou por{" "}
          <strong>período</strong>. A pessoa precisa já ter conta (ela define a própria
          senha ao se cadastrar); aqui você só liga/desliga a cortesia. Vale na hora e
          independe do Stripe. E, quando um pagamento não liberou, o <strong>re-sync do
          Stripe</strong> conserta.
        </p>
      </header>

      <SincronizarStripeForm />
      <CortesiaForm cortesias={cortesias} />
    </div>
  );
}
