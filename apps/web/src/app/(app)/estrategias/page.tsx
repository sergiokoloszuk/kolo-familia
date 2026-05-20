import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Gamepad2,
  Lightbulb,
  MessageSquare,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { ConversarForm } from "../conversar/conversar-form";

/**
 * Estratégias Kolo — leitura contínua (Bloco 2):
 *   1. Conversar sobre o que aconteceu (ConversarForm)
 *   2. Outras formas de ajuda (biblioteca de tipos como continuação)
 *   3. Conversas anteriores (lista editorial)
 *
 * Sem tabs. Sem categorização funcional. A página é UM CAMINHO, com
 * três paradas naturais.
 *
 * Mantém:
 *   - rotas legacy /conversar e /apoio/[key]
 *   - actions/IA intactas
 *   - lógica de routing entre skills intacta
 */

const ICONES_BIBLIOTECA: Record<string, LucideIcon> = {
  brincadeiras: Gamepad2,
  atividades: Sparkles,
  crencas: Lightbulb,
  o_que_fazer_diferente: Route,
  historias_sociais: BookOpen,
  frases_prontas: MessageSquare,
  rotinas: CalendarClock,
};

/**
 * Descrições reescritas em linguagem do cotidiano (Bloco 2).
 * Antes eram specs de output type ("2 a 3 brincadeiras concretas").
 * Agora são frases curtas que descrevem o tipo de ajuda.
 */
const DESCRICOES_BIBLIOTECA: Record<string, string> = {
  brincadeiras: "Sugestões pra usar com o que tem em casa.",
  atividades: "Pequenas atividades pra incluir no dia.",
  crencas: "Mitos comuns e o que se sabe sobre eles.",
  o_que_fazer_diferente:
    "Outra forma de lidar com algo que vem se repetindo.",
  historias_sociais: "Uma história curta pra preparar pra uma situação.",
  frases_prontas: "Frases curtas pra usar na hora.",
  rotinas: "Sugestão de rotina ou ajuste numa que já existe.",
};

export default async function EstrategiasPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

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

  const temTipos = (tipos ?? []).length > 0;
  const temConversas = (conversas ?? []).length > 0;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <Eyebrow>Quando você precisa de ajuda</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Conta o que aconteceu.{" "}
          <em className="not-italic text-brand-purple">
            Vamos pensar nisso juntos
          </em>
          .
        </h1>
      </header>

      <ConversarForm membros={membros ?? []} />

      {temTipos && <BibliotecaSection tipos={tipos ?? []} />}

      {temConversas && (
        <ConversasAnterioresSection conversas={conversas ?? []} />
      )}
    </div>
  );
}

// ============================================================
// Biblioteca — continuação contextual, não catálogo
// ============================================================

interface TipoBiblioteca {
  key: string;
  label: string;
  ordem: number | null;
}

function BibliotecaSection({ tipos }: { tipos: TipoBiblioteca[] }) {
  return (
    <section>
      <Eyebrow>Outras formas de ajuda</Eyebrow>
      <h2 className="mt-1 font-heading text-2xl text-foreground">
        Se preferir um{" "}
        <em className="not-italic text-brand-purple">formato específico</em>
      </h2>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {tipos.map((t) => {
          const Icon = ICONES_BIBLIOTECA[t.key] ?? Sparkles;
          return (
            <li key={t.key}>
              <Link
                href={`/apoio/${t.key}`}
                className="group flex h-full flex-col rounded-2xl bg-white px-5 py-5 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]"
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-foreground/40"
                    aria-hidden
                  />
                  <div className="flex-1">
                    <h3 className="font-heading text-base font-medium leading-snug text-foreground md:text-lg">
                      {t.label}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {DESCRICOES_BIBLIOTECA[t.key] ?? ""}
                    </p>
                  </div>
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-purple transition-all group-hover:gap-2.5">
                  Ver
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ============================================================
// Conversas anteriores — lista editorial estilo "Essa semana" da Home
// ============================================================

interface ConversaResumo {
  id: string;
  titulo: string | null;
  created_at: string;
}

function ConversasAnterioresSection({
  conversas,
}: {
  conversas: ConversaResumo[];
}) {
  return (
    <section>
      <Eyebrow>Conversas anteriores</Eyebrow>
      <h2 className="mt-1 font-heading text-2xl text-foreground">
        Onde vocês <em className="not-italic text-brand-purple">pararam</em>
      </h2>
      <ul className="mt-5 flex flex-col">
        {conversas.map((c, idx) => (
          <li
            key={c.id}
            className={
              idx > 0 ? "border-t border-foreground/[0.06]" : undefined
            }
          >
            <Link
              href={`/conversar/${c.id}`}
              className="group flex flex-col gap-1 py-3.5 transition-colors hover:text-brand-purple"
            >
              <span className="line-clamp-1 text-base leading-relaxed text-foreground transition-colors group-hover:text-brand-purple">
                {c.titulo ?? "Conversa sem título"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(new Date(c.created_at), new Date(), {
                  locale: ptBR,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
