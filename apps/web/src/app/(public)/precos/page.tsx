import Link from "next/link";
import type { Metadata } from "next";
import { Check, Sparkles, MessageCircle, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { cn } from "@/lib/utils";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  formatarBRL,
  lerPlanosParaExibir,
  seloEconomiaAnual,
} from "@/lib/billing/planos";
import { ctaDoEstado, estadoComercialDoVisitante } from "./cta-por-estado";
import { MarcoOrigem } from "./marco-origem";
import { origemValida } from "./origem";

export const metadata: Metadata = {
  title: "Preços · Kolo Família",
  description:
    "Trial de 7 dias grátis sem cartão. Depois, mensalidade ou anual com desconto. Sem pegadinhas.",
};

// O preço vem do Stripe, espelhado em configuracao_precos. Ver lib/billing/planos.ts.
export const dynamic = "force-dynamic";

export default async function PrecosPage({
  searchParams,
}: {
  // ⚠️ SÓ A ORIGEM. Nenhum identificador de família na URL — ver `marco-origem`.
  searchParams: Promise<{ de?: string | string[] }>;
}) {
  const origem = origemValida((await searchParams)?.de);
  const admin = createServiceRoleClient();
  // ⚠️ O CTA depende de quem está olhando — ver `cta-por-estado.ts`. Quem chega
  // pelo convite de fim de teste não pode receber "comece um teste".
  const [planos, estado] = await Promise.all([
    lerPlanosParaExibir(admin),
    estadoComercialDoVisitante(),
  ]);
  const cta = ctaDoEstado(estado);
  const mensalCent = planos.mensal.centavos;
  const anualCent = planos.anual.centavos;
  const mensalLabel = formatarBRL(mensalCent);
  const anualLabel = formatarBRL(anualCent);
  // O selo do anual é DERIVADO dos dois preços. Ver o porquê em planos.ts:
  // aqui já esteve escrito "Economia ~20%" enquanto o desconto real era 8,33%.
  const selo = seloEconomiaAnual(mensalCent, anualCent);
  const equivalenteMes = anualCent != null ? formatarBRL(Math.round(anualCent / 12)) : null;

  const mensalFeatures = [
    "App completo + Ayla no WhatsApp",
    "Conteúdo personalizado ilimitado",
    "Relatórios pra terapeuta e escola",
    "Cancela a qualquer momento",
  ];

  // ⚠️ NENHUM NÚMERO DE DESCONTO ESCRITO À MÃO AQUI. Esta lista já disse
  // "~2 meses grátis" quando o desconto real era de 1 mês. O selo derivado
  // (`selo`) é o único lugar que fala em economia, e ele vem da conta.
  const anualFeatures = [
    "Tudo do plano mensal",
    ...(selo ? [`${selo} em relação ao mensal`] : []),
    "Pagamento único anual",
    "Cancela a qualquer momento",
  ];

  const incluido = [
    {
      icon: Sparkles,
      titulo: "Conteúdo personalizado",
      texto:
        "Brincadeiras, rotinas e roteiros gerados pelo perfil da sua família.",
    },
    {
      icon: MessageCircle,
      titulo: "Ayla no WhatsApp",
      texto:
        "Acolhe primeiro, organiza depois. Máx. 2 mensagens proativas por dia.",
    },
    {
      icon: FileText,
      titulo: "Relatórios prontos",
      texto: "Pra terapeuta e escola, em PDF ou link vivo compartilhável.",
    },
  ];

  return (
    <>
      {/* HERO de preços — lilás claro com eyebrow + H1 (Manual §11/§15). */}
      <section className="bg-kolo-lilas-2">
        <div className="mx-auto w-full max-w-7xl px-6 py-16 text-center md:px-8 md:py-24">
          <Eyebrow className="justify-center">Preços simples</Eyebrow>
          <h1 className="mt-4 font-heading text-4xl text-foreground md:text-6xl">
            7 dias grátis{" "}
            <em className="not-italic text-brand-purple">pra sentir se vale</em>
            .
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem cartão pra começar. Depois você decide.
          </p>
        </div>
      </section>

      {/* PLANOS — 2 cards lado a lado. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-16 md:px-8 md:py-20">
          <MarcoOrigem origem={origem} />

          {/* Quem já tem conta chega aqui vindo do convite da Ayla. Dizer em
              que ponto ela está evita o estranhamento de ver uma página de
              aquisição depois de já ter usado o produto por uma semana. */}
          {cta.nota ? (
            <p className="mx-auto mb-8 max-w-2xl rounded-2xl bg-kolo-lilas-bg-2 px-6 py-4 text-center text-sm text-foreground/85">
              {cta.nota}
            </p>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Plano mensal — card lilás (não destacado). */}
            <div className="flex flex-col gap-6 rounded-3xl bg-kolo-lilas-bg-2 p-8 transition-all hover:-translate-y-1 hover:shadow-lg md:p-10">
              <div>
                <h2 className="font-heading text-2xl text-foreground">
                  Mensal
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Flexibilidade total. Cancela em um clique.
                </p>
              </div>
              <div>
                <p className="font-heading text-5xl text-brand-purple-dark">
                  {mensalLabel ?? "—"}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / mês
                  </span>
                </p>
              </div>
              <ul className="flex flex-col gap-3 text-sm text-foreground/85">
                {mensalFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-5 shrink-0 text-brand-purple"
                      aria-hidden
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={cta.destino}
                className={cn(
                  buttonVariants({ variant: "outline", size: "xl" }),
                  "mt-auto w-full justify-center rounded-full border-brand-purple text-brand-purple hover:bg-kolo-lilas hover:text-brand-purple-dark",
                )}
              >
                {cta.rotulo}
              </Link>
            </div>

            {/* Plano anual — destacado em gradient roxo Kolo. */}
            <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple to-brand-purple-dark p-8 text-white shadow-2xl md:p-10">
              {selo && (
                <span className="absolute right-6 top-6 rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-purple-dark">
                  {selo}
                </span>
              )}
              <div>
                <h2 className="font-heading text-2xl">Anual</h2>
                <p className="mt-1 text-sm text-white/75">
                  Mais econômico. Para quem já decidiu.
                </p>
              </div>
              <div>
                <p className="font-heading text-5xl">
                  <span style={{ fontWeight: 500 }}>
                    {anualLabel ?? "—"}
                  </span>
                  <span className="text-base font-normal text-white/70">
                    {" "}
                    / ano
                  </span>
                </p>
                {equivalenteMes && (
                  <p className="mt-1 text-sm text-white/75">
                    Equivalente a {equivalenteMes} por mês.
                  </p>
                )}
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {anualFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-5 shrink-0 text-brand-yellow"
                      aria-hidden
                    />
                    <span className="text-white/90">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={cta.destino}
                className={cn(
                  buttonVariants({ variant: "cta", size: "xl" }),
                  "mt-auto w-full justify-center",
                )}
              >
                {cta.rotulo}
              </Link>
            </div>
          </div>

          {/* Reassurance card. */}
          <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-kolo-lilas-bg-2 p-6 text-center md:p-8">
            <p className="font-heading text-xl font-semibold text-foreground">
              Sem cartão pra começar
            </p>
            <p className="mt-2 text-muted-foreground">
              O trial não pede cartão. Você decide se gosta antes de pagar — não
              existe risco de cobrança automática que você esqueceu.
            </p>
          </div>
        </div>
      </section>

      {/* O QUE ESTÁ INCLUÍDO — lilás, 3 cards com IconCards. */}
      <section className="bg-kolo-lilas">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="justify-center">O que está incluído</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
              Os dois planos têm{" "}
              <em className="not-italic text-brand-purple">tudo isso</em>.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {incluido.map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm"
              >
                <IconCard tone="light">
                  <Icon aria-hidden />
                </IconCard>
                <h3 className="font-heading text-xl text-foreground">
                  {titulo}
                </h3>
                <p className="text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer Stripe. */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-12 text-center md:px-8">
          <p className="text-xs text-muted-foreground">
            Pagamento processado pelo Stripe. Reembolsos não automáticos —
            contate-nos por{" "}
            <Link
              href="/contato"
              className="text-brand-purple underline underline-offset-2 hover:text-brand-purple-dark"
            >
              /contato
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
