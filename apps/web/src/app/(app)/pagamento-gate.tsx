import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/**
 * Bloqueio por FALHA DE PAGAMENTO (dunning). Aparece quando o pagamento falhou,
 * passou a graça e ainda não regularizou. Diz que os dados ficam guardados por X
 * dias e leva pra atualizar o cartão (que reabre o acesso na hora). Depois do
 * prazo, o cron apaga os dados.
 */
export function PagamentoGate({ diasRestantes }: { diasRestantes: number | null }) {
  const dias = diasRestantes ?? 7;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kolo-page px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-foreground/[0.08] bg-white px-6 py-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <Logo size={28} />
        </div>
        <h1 className="font-heading text-2xl text-foreground">Seu pagamento não passou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O acesso está pausado enquanto o pagamento não é regularizado. Seus dados continuam
          guardados por <strong className="text-foreground">{dias} {dias === 1 ? "dia" : "dias"}</strong> —
          é só atualizar o cartão que tudo volta na hora.
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Passado esse prazo sem regularizar, os dados são apagados definitivamente.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/assinatura"
            className="rounded-full bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
          >
            Atualizar cartão
          </Link>
        </div>
      </div>
    </div>
  );
}
