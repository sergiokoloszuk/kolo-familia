import Link from "next/link";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

/**
 * Placeholder de /historias — NAV-2.
 *
 * A versão completa (portal mágico + galeria de livros + sugestões da
 * Ayla) chega na fase NAV-5. Por ora só uma página de "vem aí" pra que
 * o item do menu não caia em 404.
 */
export default async function HistoriasPage() {
  const { supabase, family } = await loadFamilyContext();
  const { data: criancas } = await supabase
    .from("membros_atipicos")
    .select("nome")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .limit(1);
  const nomePrimeira = criancas?.[0]?.nome ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <BookOpen aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Universo narrativo</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Histórias{" "}
            {nomePrimeira ? (
              <>
                que vão{" "}
                <em className="not-italic text-brand-purple">crescer com {nomePrimeira}</em>
              </>
            ) : (
              <em className="not-italic text-brand-purple">vem aí</em>
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Em breve, esse espaço vai abrigar histórias ilustradas com{" "}
            {nomePrimeira ?? "a criança"} como protagonista — pra antecipar
            momentos, celebrar conquistas e ensaiar o que está por vir.
          </p>
        </div>
      </header>

      <section className="rounded-3xl bg-gradient-to-br from-brand-purple-deep via-brand-purple-dark to-brand-purple px-8 py-12 text-white md:py-16 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,186,0,0.14) 1.2px, transparent 1.2px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center justify-center rounded-2xl bg-brand-yellow/20 p-3 backdrop-blur">
            <Sparkles className="size-6 text-brand-yellow" aria-hidden />
          </span>
          <h2 className="mt-6 font-heading text-2xl text-white md:text-3xl">
            Em construção
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/80">
            Estamos preparando o portal narrativo da Kolo. Cada história vai
            sair do contexto vivo — eventos da semana, padrões observados,
            momentos importantes — virando uma cena curta que ajuda a criança
            a antecipar o mundo.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/painel"
              className={cn(
                buttonVariants({ variant: "cta", size: "lg" }),
                "inline-flex items-center gap-2",
              )}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar pra Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
