import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Gamepad2,
  Library,
  Lightbulb,
  MessageCircle,
  MessageSquare,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";
import { ConversarForm } from "../conversar/conversar-form";

/**
 * Estratégias Kolo — área principal de orientação contextual.
 *
 * Duas sub-abas (via `?tab=`):
 *   - conversa (default): chat com a inteligência Kolo + lista de conversas
 *   - biblioteca: tipos curados de resposta (brincadeiras, frases prontas, etc.)
 *
 * IMPORTANTE: NÃO usa a palavra "Ayla" no UI público. Ayla é a assistente
 * conversacional do WhatsApp — a área web se chama "Estratégias".
 *
 * `/conversar/[id]` e `/apoio/[key]` continuam ativos como destinos das
 * conversas individuais e dos formulários por tipo (NAV-9 vai redirecionar
 * pra subpaths de /estrategias quando consolidarmos).
 */

type Tab = "conversa" | "biblioteca";

const ICONES_BIBLIOTECA: Record<string, LucideIcon> = {
  brincadeiras: Gamepad2,
  atividades: Sparkles,
  crencas: Lightbulb,
  o_que_fazer_diferente: Route,
  historias_sociais: BookOpen,
  frases_prontas: MessageSquare,
  rotinas: CalendarClock,
};

const DESCRICOES_BIBLIOTECA: Record<string, string> = {
  brincadeiras:
    "2 a 3 brincadeiras concretas, com materiais simples e duração estimada.",
  atividades: "Atividades do dia a dia que apoiam o neurodesenvolvimento.",
  crencas:
    "Crenças e mitos comuns sobre o tema, com contraposição prática — sem afirmar causas.",
  o_que_fazer_diferente:
    "Mudança concreta de abordagem para um desafio recorrente.",
  historias_sociais:
    "Mini-história em 3 a 5 cenas para preparar para uma situação específica.",
  frases_prontas:
    "5 a 8 frases para usar literalmente em momentos específicos.",
  rotinas: "Sugestão de rotina ou ajuste em uma rotina existente.",
};

export default async function EstrategiasPage(
  props: PageProps<"/estrategias">,
) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "biblioteca" ? "biblioteca" : "conversa";

  const [{ data: membros }, { data: conversas }, { data: tipos }] =
    await Promise.all([
      supabase
        .from("membros_atipicos")
        .select("id, nome")
        .eq("family_account_id", familyId)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("conversas")
        .select("id, titulo, created_at")
        .eq("family_account_id", familyId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("output_types")
        .select("key, label, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <Sparkles aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Estratégias</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Conversa e{" "}
            <em className="not-italic text-brand-purple">biblioteca da fase</em>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Conte uma situação ou peça um tipo específico — o sistema escolhe a
            melhor leitura pra essa fase da criança.
          </p>
        </div>
      </header>

      {/* Tabs — pill switcher inspirado no protótipo. */}
      <div
        role="tablist"
        aria-label="Sub-abas de Estratégias"
        className="inline-flex w-fit gap-1 rounded-2xl bg-kolo-lilas-bg-2 p-1.5"
      >
        <TabLink
          href="/estrategias?tab=conversa"
          active={tab === "conversa"}
          icon={MessageCircle}
          label="Conversa"
        />
        <TabLink
          href="/estrategias?tab=biblioteca"
          active={tab === "biblioteca"}
          icon={Library}
          label="Biblioteca da fase"
        />
      </div>

      {tab === "conversa" ? (
        <ConversaTab membros={membros ?? []} conversas={conversas ?? []} />
      ) : (
        <BibliotecaTab tipos={tipos ?? []} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4 stroke-[1.8]" aria-hidden />
      {label}
    </Link>
  );
}

// ============================================================
// Sub-aba: Conversa
// ============================================================

interface Membro {
  id: string;
  nome: string;
}

interface ConversaResumo {
  id: string;
  titulo: string | null;
  created_at: string;
}

function ConversaTab({
  membros,
  conversas,
}: {
  membros: Membro[];
  conversas: ConversaResumo[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-3xl bg-kolo-lilas-bg-2 p-6 md:p-8">
        <h2 className="font-heading text-xl text-foreground">Nova conversa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sobre quem é (se for um membro específico) e o que aconteceu.
        </p>
        <div className="mt-6">
          <ConversarForm membros={membros} />
        </div>
      </div>

      {conversas.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <Eyebrow>Conversas anteriores</Eyebrow>
            <h2 className="mt-1 font-heading text-2xl text-foreground">
              O que você{" "}
              <em className="not-italic text-brand-purple">já perguntou</em>
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversar/${c.id}`}
                  className="block rounded-2xl border border-kolo-linha bg-white px-5 py-4 text-sm transition-all hover:-translate-y-0.5 hover:border-brand-purple hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="line-clamp-1 font-medium text-foreground">
                      {c.titulo ?? "Conversa"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(new Date(c.created_at), new Date(), {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Sub-aba: Biblioteca da fase
// ============================================================

interface TipoBiblioteca {
  key: string;
  label: string;
  ordem: number | null;
}

function BibliotecaTab({ tipos }: { tipos: TipoBiblioteca[] }) {
  if (tipos.length === 0) {
    return (
      <EstadoVazio
        icon={<Library />}
        titulo="A biblioteca está em montagem"
        descricao="Os tipos de estratégia (brincadeiras, frases prontas, histórias sociais, rotinas) aparecem aqui assim que a equipe curar os primeiros. Enquanto isso, use a aba Conversa."
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {tipos.map((t) => {
        const Icon = ICONES_BIBLIOTECA[t.key] ?? Sparkles;
        return (
          <li key={t.key}>
            <Link
              href={`/apoio/${t.key}`}
              className="group flex h-full flex-col gap-3 rounded-3xl border border-kolo-linha bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-purple hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <IconCard tone="light">
                  <Icon aria-hidden />
                </IconCard>
                <div className="flex-1">
                  <h3 className="font-heading text-lg text-foreground">
                    {t.label}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {DESCRICOES_BIBLIOTECA[t.key] ?? ""}
                  </p>
                </div>
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple transition-all group-hover:gap-2.5">
                Pedir
                <ArrowRight className="size-3" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
