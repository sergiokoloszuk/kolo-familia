import { requireAdmin } from "@/lib/auth/require-admin";
import { PainelPlanoV51 } from "@/components/plano-v51/painel-interno";

export default async function PlanoV51InternoPage() {
  await requireAdmin();
  // Sem leituras de famílias, flags ou geração externa. Não substituir /planos.
  return <PainelPlanoV51 />;
}
