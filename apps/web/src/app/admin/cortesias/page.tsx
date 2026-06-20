import { requireAdmin } from "@/lib/auth/require-admin";
import { listarCortesias } from "./actions";
import { CortesiaForm } from "./cortesia-form";

export default async function AdminCortesiasPage() {
  await requireAdmin();
  const cortesias = await listarCortesias();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Cortesias</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Acesso cortesia (grátis) por e-mail — <strong>vitalícia</strong> ou por{" "}
          <strong>período</strong>. A pessoa precisa já ter conta (ela define a própria
          senha ao se cadastrar); aqui você só liga/desliga a cortesia. Vale na hora e
          independe do Stripe.
        </p>
      </header>

      <CortesiaForm cortesias={cortesias} />
    </div>
  );
}
