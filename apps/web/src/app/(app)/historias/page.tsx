import {
  Award,
  Clock,
  Lightbulb,
  Plus,
  Settings2,
  Sparkles,
  Star,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

/**
 * Histórias — universo narrativo personalizado.
 *
 * Conforme protótipo (19/05/2026):
 *   Portal mágico (gradient roxo deep + estrelas + lua)
 *   Elenco — galeria horizontal de personagens
 *   Sugestões — 3 cards contextuais ("celebrar", "antecipar", "ensaiar")
 *   Fase atual — agrupamento de livros com capa
 *
 * IMPORTANTE: a geração real de histórias depende de motor IA + tabelas
 * `ayla_historias` que ainda não existem. Esta página renderiza a
 * estrutura visual com dados leves (nome da criança) e CTAs em estado
 * "em construção" — funcional só quando a geração for implementada.
 *
 * Não usa o nome "Ayla" no UI: a web fala "Kolo sugere".
 */

export default async function HistoriasPage() {
  const { supabase, family } = await loadFamilyContext();
  const { data: criancas } = await supabase
    .from("membros_atipicos")
    .select("id, nome, idade")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const primeiraCrianca = criancas?.[0];
  const nome = primeiraCrianca?.nome ?? "a criança";
  const idade = primeiraCrianca?.idade as number | null | undefined;
  const inicial = primeiraCrianca?.nome?.[0]?.toUpperCase() ?? "?";

  // Quando o motor de histórias estiver implementado, esses números virão do banco.
  const totalHistorias = 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ============================================================
       * PORTAL MÁGICO — gradient roxo deep com estrelas + lua
       * ============================================================ */}
      <section
        aria-labelledby="historias-titulo"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep via-brand-purple-dark to-brand-purple px-8 py-10 text-white md:px-12 md:py-12"
      >
        {/* Estrelas decorativas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: [
              "radial-gradient(1.5px 1.5px at 18% 22%, rgba(255,255,255,0.6) 50%, transparent)",
              "radial-gradient(1px 1px at 72% 14%, rgba(255,255,255,0.5) 50%, transparent)",
              "radial-gradient(1.5px 1.5px at 92% 78%, rgba(255,255,255,0.45) 50%, transparent)",
              "radial-gradient(1px 1px at 38% 82%, rgba(255,186,0,0.55) 50%, transparent)",
              "radial-gradient(1px 1px at 58% 38%, rgba(255,255,255,0.4) 50%, transparent)",
              "radial-gradient(2px 2px at 8% 65%, rgba(255,186,0,0.6) 50%, transparent)",
            ].join(", "),
          }}
        />
        {/* Lua suave */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full opacity-80"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, rgba(255,186,0,0.7) 0%, rgba(255,186,0,0.2) 50%, transparent 75%)",
            filter: "blur(2px)",
          }}
        />

        <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-yellow/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-yellow backdrop-blur">
              <Star className="size-3.5 fill-current" aria-hidden />
              O universo de {nome}
            </p>
            <h1
              id="historias-titulo"
              className="font-heading text-4xl text-white md:text-5xl"
            >
              Histórias que{" "}
              <em className="not-italic bg-gradient-to-r from-brand-yellow to-brand-yellow-light bg-clip-text text-transparent">
                crescem com {primeiraCrianca ? "ela" : "a criança"}
              </em>
              .
            </h1>
            <p className="mt-4 max-w-xl text-white/75">
              Cada história é uma cena curta com{" "}
              {primeiraCrianca ? nome : "a criança"} como protagonista — pra
              antecipar o que vai acontecer, celebrar uma conquista ou ensaiar
              um momento difícil antes de viver de verdade.
            </p>
          </div>

          {/* Avatar circular — placeholder com inicial até termos asset visual */}
          <div className="shrink-0">
            <div
              className="relative flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark font-heading text-5xl font-semibold text-brand-purple-dark shadow-[0_12px_24px_rgba(0,0,0,0.25)] md:size-40 md:text-6xl"
              aria-hidden
            >
              {inicial}
              <span
                className="pointer-events-none absolute -inset-4 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,186,0,0.25) 0%, transparent 65%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Plano info — info bar no canto */}
        <div className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs text-white/80 backdrop-blur">
          <span className="font-bold text-brand-yellow">{totalHistorias}</span>
          <span>histórias no universo</span>
        </div>
      </section>

      {/* ============================================================
       * ELENCO — galeria de personagens (mostra protagonista + adicionar)
       * ============================================================ */}
      <section className="rounded-3xl bg-white p-6 shadow-sm md:p-7">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              O <em className="not-italic text-brand-purple">elenco</em> de{" "}
              {nome}
            </h2>
            <span className="text-sm text-muted-foreground">
              · quem mora no universo
            </span>
          </div>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-2">
          {/* Protagonista */}
          <div className="flex w-[88px] shrink-0 flex-col items-center text-center">
            <div className="relative">
              <span
                className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark font-heading text-xl font-semibold text-brand-purple-dark shadow-sm ring-2 ring-brand-yellow ring-offset-2 ring-offset-white"
                aria-hidden
              >
                {inicial}
              </span>
            </div>
            <p className="mt-2 truncate text-xs font-bold text-foreground">
              {nome}
            </p>
            <p className="text-[10px] text-muted-foreground">Protagonista</p>
          </div>

          {/* Adicionar — placeholder pra futuros personagens */}
          <button
            type="button"
            disabled
            className="flex w-[88px] shrink-0 cursor-not-allowed flex-col items-center text-center opacity-60"
            title="Em breve"
          >
            <span
              className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-kolo-linha bg-kolo-lilas-bg-2 text-muted-foreground"
              aria-hidden
            >
              <Plus className="size-5 stroke-[1.8]" />
            </span>
            <p className="mt-2 text-xs font-bold text-foreground">Adicionar</p>
            <p className="text-[10px] text-muted-foreground">Em breve</p>
          </button>
        </div>
      </section>

      {/* ============================================================
       * SUGESTÕES — 3 cards contextuais (sem nome "Ayla")
       * ============================================================ */}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Kolo sugere</Eyebrow>
            <h2 className="mt-2 font-heading text-2xl text-foreground md:text-3xl">
              Três histórias que{" "}
              <em className="not-italic text-brand-purple">
                fazem sentido agora
              </em>
              .
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Em breve, essas sugestões vão chegar baseadas no que aconteceu
              essa semana e no que está chegando.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SugestaoCard
            tipo="celebrar"
            icon={Award}
            motivo={`Quando ${nome} conquistar algo novo, vamos celebrar com uma história.`}
            categoria="Celebrar conquista"
            titulo={`O dia em que ${primeiraCrianca ? "ela" : "ela"} aceitou algo novo`}
            descricao="A história pode ser lida juntas pra reforçar o momento."
          />
          <SugestaoCard
            tipo="antecipar"
            icon={Clock}
            motivo="Antes de momentos importantes — consulta, visita, mudança — a história prepara."
            categoria="Antecipar momento"
            titulo="A consulta com o pediatra"
            descricao="Quem estará, onde sentar, quanto tempo dura. Sem surpresas."
          />
          <SugestaoCard
            tipo="ensaiar"
            icon={Lightbulb}
            motivo="Pra situações que ficam difíceis — banho, transição da TV, ir embora."
            categoria="Ensaiar comportamento"
            titulo="Quando o banho fica complicado"
            descricao={`${nome} se vê fazendo a transição. Vira possibilidade.`}
          />
        </div>
      </section>

      {/* ============================================================
       * FASE ATUAL — galeria por fase de vida (placeholder)
       * ============================================================ */}
      <section>
        <div className="mb-5">
          <Eyebrow>
            Fase atual{idade != null ? ` · ${idade} anos` : ""}
          </Eyebrow>
          <h2 className="mt-2 font-heading text-2xl text-foreground">
            As <em className="not-italic text-brand-purple">aventuras</em> de{" "}
            {nome}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aqui é onde as histórias criadas com {nome} vão morar — agrupadas
            por fase.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* 3 placeholders de livro */}
          <LivroPlaceholder
            cor="bg-gradient-to-br from-[#FFD4A3] via-[#F8A862] to-[#C77F00]"
            categoria="Alimentação"
            titulo="Sua primeira história sobre uma conquista"
          />
          <LivroPlaceholder
            cor="bg-gradient-to-br from-[#6B7A99] via-[#4A5878] to-[#2E0A52]"
            categoria="Rotina"
            titulo="Uma cena pra antecipar um momento difícil"
          />
          <LivroPlaceholder
            cor="bg-gradient-to-br from-[#F472B6] via-[#B0455B] to-[#6B1FA8]"
            categoria="Saúde"
            titulo="Um ensaio pra uma situação nova"
          />

          {/* Card criar do zero */}
          <button
            type="button"
            disabled
            className="group relative flex cursor-not-allowed flex-col rounded-3xl border-2 border-dashed border-brand-purple/25 bg-gradient-to-br from-kolo-creme to-kolo-lilas-bg-2 p-6 opacity-90 transition-all"
            title="Geração de histórias em construção"
          >
            <span
              className="relative inline-flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark text-brand-purple-dark shadow-md"
              aria-hidden
            >
              <Sparkles className="size-7 stroke-[1.6]" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
              Inventar uma{" "}
              <em className="not-italic text-brand-purple">nova aventura</em>
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Em breve você poderá pedir uma história sobre qualquer situação
              que vocês queiram ensaiar juntas.
            </p>
            <span className="mt-auto pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-brand-purple">
              Em construção
            </span>
          </button>
        </div>
      </section>

      {/* ============================================================
       * Nota inferior
       * ============================================================ */}
      <div className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2 p-6">
        <p className="text-sm text-foreground">
          <strong className="font-bold text-foreground">Histórias</strong> é
          uma área em construção. A geração real começa quando o sistema
          longitudinal estiver ativo. Por enquanto, esse é o lugar onde tudo
          vai morar.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function SugestaoCard({
  tipo,
  icon: Icon,
  motivo,
  categoria,
  titulo,
  descricao,
}: {
  tipo: "celebrar" | "antecipar" | "ensaiar";
  icon: typeof Award;
  motivo: string;
  categoria: string;
  titulo: string;
  descricao: string;
}) {
  const accent: Record<typeof tipo, { stripe: string; motivoBg: string; motivoIcon: string }> = {
    celebrar: {
      stripe: "before:bg-gradient-to-r before:from-brand-yellow before:to-brand-yellow-dark",
      motivoBg: "bg-brand-yellow/12 text-brand-purple-dark",
      motivoIcon: "bg-brand-yellow/20 text-brand-purple-dark",
    },
    antecipar: {
      stripe: "before:bg-gradient-to-r before:from-cat-rotina before:to-cat-social",
      motivoBg: "bg-cat-rotina-bg text-cat-rotina",
      motivoIcon: "bg-cat-rotina-bg text-cat-rotina",
    },
    ensaiar: {
      stripe: "before:bg-gradient-to-r before:from-cat-emocao before:to-cat-foco",
      motivoBg: "bg-cat-emocao-bg text-cat-emocao",
      motivoIcon: "bg-cat-emocao-bg text-cat-emocao",
    },
  };
  const cor = accent[tipo];

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-white p-6 shadow-sm transition-all",
        "before:absolute before:left-0 before:right-0 before:top-0 before:h-1",
        cor.stripe,
      )}
    >
      <div className={cn("flex items-start gap-3 rounded-xl p-3", cor.motivoBg)}>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            cor.motivoIcon,
          )}
          aria-hidden
        >
          <Icon className="size-3.5 stroke-[2]" />
        </span>
        <p className="text-xs leading-snug">{motivo}</p>
      </div>

      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">
        {categoria}
      </p>
      <h3 className="font-heading text-lg leading-snug text-foreground">
        {titulo}
      </h3>
      <p className="text-sm text-muted-foreground">{descricao}</p>

      <div className="mt-auto flex items-center gap-2 pt-2">
        <button
          type="button"
          disabled
          className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-brand-purple/30 px-4 py-2 text-xs font-bold text-white"
          title="Em breve"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Em breve
        </button>
        <button
          type="button"
          disabled
          aria-label="Ajustar (em breve)"
          className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-full bg-kolo-lilas-bg-2 text-muted-foreground"
          title="Em breve"
        >
          <Settings2 className="size-4 stroke-[1.8]" />
        </button>
      </div>
    </article>
  );
}

function LivroPlaceholder({
  cor,
  categoria,
  titulo,
}: {
  cor: string;
  categoria: string;
  titulo: string;
}) {
  return (
    <article className="group flex flex-col">
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-2xl shadow-md transition-all",
          cor,
        )}
      >
        {/* Efeito de borda esquerda (lombada do livro) */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 to-transparent"
        />

        {/* Tag de tema */}
        <span className="absolute right-4 top-4 inline-flex items-center rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-white backdrop-blur">
          {categoria}
        </span>

        {/* Estrela "em breve" */}
        <span
          aria-hidden
          className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-brand-yellow/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-purple-dark"
        >
          <Star className="size-3 fill-current" aria-hidden />
          Em breve
        </span>

        {/* Título sobre capa */}
        <div className="absolute inset-x-0 bottom-0 p-4 pt-12">
          <h3
            className="font-heading text-base font-medium leading-tight text-white opacity-85"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
          >
            {titulo}
          </h3>
        </div>
      </div>
      <div className="mt-3 px-1">
        <p className="font-heading text-sm font-semibold text-foreground/70">
          Placeholder
        </p>
        <p className="text-xs text-muted-foreground">
          Quando a geração ativar, esse será o lugar
        </p>
      </div>
    </article>
  );
}

export const metadata = {
  title: "Histórias — Kolo Família",
};
