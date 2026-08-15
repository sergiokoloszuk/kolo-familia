import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { familiasExperimentais } from "@/lib/ayla/experimental";
import { versoesDoCore } from "./actions";
import { Simulador } from "./simulador";

/**
 * SIMULADOR DA AYLA — testar um Core antes de ativá-lo.
 *
 * ⚠️ Esta tela NÃO edita e NÃO ativa. O conteúdo vive em
 * `/admin/documentos`; aqui só se experimenta. A separação existe porque as
 * duas coisas já se confundiram na prática.
 */
export default async function SimuladorPage() {
  const { supabase } = await requireAdmin();
  const versoes = await versoesDoCore();

  const ids = familiasExperimentais();
  const { data: perfis } = ids.length
    ? await supabase
        .from("family_profiles")
        .select("family_account_id, nome_mae")
        .in("family_account_id", ids)
    : { data: [] };
  const nomePorId = new Map(
    (perfis ?? []).map((p) => [p.family_account_id as string, (p.nome_mae as string) || ""]),
  );
  const familias = ids.map((id) => ({
    id,
    nome: nomePorId.get(id) || `família ${id.slice(0, 8)}`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Simulador da Ayla</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Conversa de teste com uma família de QA, usando a versão de Core que
          você escolher. Lê o contexto real e chama o modelo —{" "}
          <strong>não envia WhatsApp, não entra no histórico da conversa e não
          registra aprendizado.</strong>
        </p>
      </header>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        Esta tela <strong>não edita e não ativa</strong> nada. Para escrever,
        versionar ou colocar no ar, vá em{" "}
        <Link href="/admin/documentos" className="font-semibold underline">
          Documentos da Ayla
        </Link>
        .
      </div>

      {versoes.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhuma versão de Core cadastrada. A Ayla está usando o Core do código
          (fallback) — cadastre em Documentos da Ayla para poder testar versões.
        </div>
      ) : null}

      <Simulador familias={familias} versoes={versoes} />
    </div>
  );
}
