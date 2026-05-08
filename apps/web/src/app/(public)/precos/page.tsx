import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Preços · Kolo Família",
  description:
    "Trial de 30 dias grátis sem cartão. Depois, mensalidade ou anual com desconto. Sem pegadinhas.",
};

// Lê de configuracao_precos no DB — admin pode ajustar sem redeploy
export const dynamic = "force-dynamic";

const FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarBRL(valor_centavos: number): string {
  return FORMATTER.format(valor_centavos / 100);
}

export default async function PrecosPage() {
  // Service role pra ler sem sessão (página pública)
  const admin = createServiceRoleClient();
  const { data: rows } = await admin
    .from("configuracao_precos")
    .select("chave, valor_centavos, descricao");

  const planos = new Map<string, { valor_centavos: number; descricao: string | null }>();
  for (const r of rows ?? []) {
    planos.set(r.chave as string, {
      valor_centavos: r.valor_centavos as number,
      descricao: (r.descricao as string) ?? null,
    });
  }
  const mensal = planos.get("plano_mensal");
  const anual = planos.get("plano_anual");

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-10 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Preços simples
        </h1>
        <p className="mt-2 text-muted-foreground">
          30 dias grátis pra sentir se vale. Depois, você decide.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-3xl font-semibold">
              {mensal ? formatarBRL(mensal.valor_centavos) : "—"}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / mês
              </span>
            </p>
            <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
              <li>App completo + Ayla no WhatsApp</li>
              <li>Conteúdo personalizado ilimitado</li>
              <li>Relatórios pra terapeuta e escola</li>
              <li>Cancela a qualquer momento</li>
            </ul>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "mt-2 w-full")}
            >
              Começar 30 dias grátis
            </Link>
          </CardContent>
        </Card>

        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle className="text-base">
              Anual{" "}
              {anual && mensal && (
                <span className="ml-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                  economia de ~20%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="font-mono text-3xl font-semibold">
              {anual ? formatarBRL(anual.valor_centavos) : "—"}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / ano
              </span>
            </p>
            {anual && (
              <p className="text-xs text-muted-foreground">
                Equivalente a {formatarBRL(Math.round(anual.valor_centavos / 12))} por mês.
              </p>
            )}
            <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
              <li>Tudo do plano mensal</li>
              <li>~2 meses grátis comparado ao mensal</li>
              <li>Pagamento único anual</li>
              <li>Cancela a qualquer momento</li>
            </ul>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-2 w-full",
              )}
            >
              Começar 30 dias grátis
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 rounded-md border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Sem cartão pra começar</p>
        <p className="text-muted-foreground">
          O trial não pede cartão. Você decide se gosta antes de pagar — não
          existe risco de cobrança automática que você esqueceu.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Pagamento processado pelo Stripe. Reembolsos não automáticos —
        contate-nos por <a href="/contato" className="underline">/contato</a>.
      </p>
    </div>
  );
}
