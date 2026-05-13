import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
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

  const planos = new Map<
    string,
    { valor_centavos: number; descricao: string | null }
  >();
  for (const r of rows ?? []) {
    planos.set(r.chave as string, {
      valor_centavos: r.valor_centavos as number,
      descricao: (r.descricao as string) ?? null,
    });
  }
  const mensal = planos.get("plano_mensal");
  const anual = planos.get("plano_anual");

  const mensalFeatures = [
    "App completo + Ayla no WhatsApp",
    "Conteúdo personalizado ilimitado",
    "Relatórios pra terapeuta e escola",
    "Cancela a qualquer momento",
  ];

  const anualFeatures = [
    "Tudo do plano mensal",
    "~2 meses grátis comparado ao mensal",
    "Pagamento único anual",
    "Cancela a qualquer momento",
  ];

  return (
    <div className="bg-brand-soft">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 md:px-8 md:py-20">
        <header className="mx-auto mb-12 max-w-3xl text-center">
          <span className="rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-purple">
            Preços simples
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-gray-800 md:text-5xl">
            30 dias grátis pra sentir se vale.
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Sem cartão pra começar. Depois você decide.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Plano mensal — card branco */}
          <div className="flex flex-col gap-6 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm">
            <div>
              <h2 className="font-heading text-xl font-bold text-gray-800">
                Mensal
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Flexibilidade total. Cancela em um clique.
              </p>
            </div>
            <div>
              <p className="font-heading text-5xl font-bold text-brand-purple">
                {mensal ? formatarBRL(mensal.valor_centavos) : "—"}
                <span className="text-base font-normal text-gray-500">
                  {" "}
                  / mês
                </span>
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-gray-700">
              {mensalFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-emerald-500"
                    aria-hidden
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "outline", size: "xl" }),
                "mt-auto w-full justify-center border-brand-purple text-brand-purple hover:bg-purple-50",
              )}
            >
              Começar 30 dias grátis
            </Link>
          </div>

          {/* Plano anual — gradient destaque */}
          <div className="bg-brand-pricing relative flex flex-col gap-6 overflow-hidden rounded-3xl p-8 text-white shadow-2xl">
            <div className="absolute right-6 top-6">
              {anual && mensal && (
                <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-gray-900">
                  ECONOMIA ~20%
                </span>
              )}
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold">Anual</h2>
              <p className="mt-1 text-sm text-white/80">
                Mais econômico. Para quem já decidiu.
              </p>
            </div>
            <div>
              <p className="font-heading text-5xl font-bold">
                {anual ? formatarBRL(anual.valor_centavos) : "—"}
                <span className="text-base font-normal text-white/70">
                  {" "}
                  / ano
                </span>
              </p>
              {anual && (
                <p className="mt-1 text-sm text-white/70">
                  Equivalente a{" "}
                  {formatarBRL(Math.round(anual.valor_centavos / 12))} por mês.
                </p>
              )}
            </div>
            <ul className="flex flex-col gap-3 text-sm text-white/90">
              {anualFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-brand-yellow-light"
                    aria-hidden
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "cta", size: "xl" }),
                "mt-auto w-full justify-center",
              )}
            >
              Começar 30 dias grátis
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-purple-100 bg-white p-6 text-sm shadow-sm">
          <p className="font-heading font-bold text-gray-800">
            Sem cartão pra começar
          </p>
          <p className="mt-2 text-gray-600">
            O trial não pede cartão. Você decide se gosta antes de pagar — não
            existe risco de cobrança automática que você esqueceu.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Pagamento processado pelo Stripe. Reembolsos não automáticos —
          contate-nos por{" "}
          <Link href="/contato" className="text-brand-purple underline">
            /contato
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
