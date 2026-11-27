import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DURACAO_MIN, MAX_TURNOS } from "@/lib/demo/regras";
import { demoHabilitada } from "@/lib/demo/http";
import { SimuladorDemo } from "./simulador-demo";

export const dynamic = "force-dynamic";

/**
 * SIMULADOR DA DEMONSTRAÇÃO DA LANDING (PEND-259).
 *
 * Mesma Ayla e mesma montagem de prompt que a visitante vai encontrar. A
 * condução é o documento “Demonstração (landing)” de `/admin/documentos`:
 * editar e ativar continua lá; aqui só se experimenta, sem limite e sem gravar.
 */
export default async function DemonstracaoAdminPage() {
  await requireAdmin();
  const ligada = demoHabilitada();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-purple">Comercial</p>
        <h1 className="mt-2 font-heading text-3xl">Demonstração da Ayla (landing)</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Na landing, cada WhatsApp confirmado faz uma única demonstração de até {DURACAO_MIN} minutos
          ({MAX_TURNOS} mensagens no máximo) e recebe o resumo no fim. Aqui você conversa à vontade:
          nada é gravado, nenhum código é pedido e nenhuma mensagem sai.
        </p>
        <p className="mt-2 text-sm">
          A condução é editada em{" "}
          <Link href="/admin/documentos" className="underline">
            /admin/documentos → Demonstração (landing)
          </Link>
          . Salve como rascunho, teste aqui e ative quando estiver bom.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-4 text-sm">
        <span className="font-semibold">Demonstração na landing: </span>
        {ligada ? "ligada (DEMO_AYLA_HABILITADA=1)." : "desligada — a landing recebe “indisponível” até a variável DEMO_AYLA_HABILITADA=1 existir na Vercel."}
      </div>

      <SimuladorDemo />
    </div>
  );
}
