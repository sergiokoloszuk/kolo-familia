import Link from "next/link";
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
import { capitalizarNome } from "@/lib/nome";
import { cn } from "@/lib/utils";
import { ConversarForm } from "../conversar/conversar-form";
import { ConversaItem } from "./conversa-item";

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
 * Tom cromático por tipo de ajuda — peso visual estilo estrategia-card
 * do protótipo (faixa colorida no topo + chip do tipo). Classes literais
 * pro Tailwind v4 extrair em build.
 */
const TIPO_TONE: Record<string, { bar: string; chip: string }> = {
  brincadeiras: { bar: "bg-cat-social", chip: "bg-cat-social-bg text-cat-social" },
  atividades: { bar: "bg-cat-foco", chip: "bg-cat-foco-bg text-cat-foco" },
  crencas: { bar: "bg-cat-emocao", chip: "bg-cat-emocao-bg text-cat-emocao" },
  o_que_fazer_diferente: { bar: "bg-cat-comunicacao", chip: "bg-cat-comunicacao-bg text-cat-comunicacao" },
  historias_sociais: { bar: "bg-cat-sensorial", chip: "bg-cat-sensorial-bg text-cat-sensorial" },
  frases_prontas: { bar: "bg-cat-motor", chip: "bg-cat-motor-bg text-cat-motor" },
  rotinas: { bar: "bg-cat-rotina", chip: "bg-cat-rotina-bg text-cat-rotina" },
};
const TIPO_TONE_FALLBACK = {
  bar: "bg-cat-social",
  chip: "bg-cat-social-bg text-cat-social",
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

export default async function EstrategiasPage({
  searchParams,
}: {
  searchParams: Promise<{ membro?: string; tema?: string }>;
}) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await searchParams;
  const temaContexto = sp.tema?.trim() || null;

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
  const nomes = (membros ?? [])
    .map((m) => (m.nome ? capitalizarNome(m.nome as string) : null))
    .filter((n): n is string => Boolean(n));
  const nomesFmt =
    nomes.length === 0
      ? "a pessoa que você cuida"
      : nomes.length === 1
        ? nomes[0]
        : nomes.length === 2
          ? `${nomes[0]} e ${nomes[1]}`
          : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  const reageVerbo = nomes.length > 1 ? "reagem" : "reage";

  return (
    <div className="flex flex-col gap-12">
      <header className="max-w-2xl">
        <Eyebrow>Estratégias</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Conte o que tá difícil —{" "}
          <em className="not-italic text-brand-purple">eu te ajudo a achar um caminho</em>.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Me fala um desafio do dia a dia, do jeito que ele acontece aí na sua casa.
          Não precisa caprichar no texto — quanto mais você me der do quadro real,
          mais certeira eu fico. Ajuda bastante incluir:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
          {[
            <>
              <strong className="font-semibold text-foreground">o que acontece</strong> e{" "}
              <strong className="font-semibold text-foreground">quando</strong> (de manhã, na
              hora de dormir, nas transições…)
            </>,
            <>
              <strong className="font-semibold text-foreground">
                como {nomesFmt} {reageVerbo}
              </strong>{" "}
              e o que parece disparar
            </>,
            <>
              <strong className="font-semibold text-foreground">como você reage na hora</strong>{" "}
              — e o que sente ou pensa quando acontece
            </>,
            <>
              <strong className="font-semibold text-foreground">o que você já tentou</strong> — o
              que ajudou um pouco, o que não rolou
            </>,
          ].map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-purple/50"
              />
              <span className="flex-1">{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Eu trago uma ideia prática na hora. E, quando fizer sentido, te ofereço um{" "}
          <strong className="font-semibold text-foreground">plano completo</strong> — com mais
          ideias, frases pra usar e o que observar.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 p-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-[#8B5A00]"
          >
            <CalendarClock className="size-5" strokeWidth={1.8} />
          </span>
          <p className="text-sm leading-relaxed text-foreground/90">
            <strong className="font-semibold text-foreground">
              Quer um plano pro fim de semana ou pras férias?
            </strong>{" "}
            Conte a programação (passeio, casa, visita, viagem, dia tranquilo…) e o que
            gostaria de fortalecer — autonomia, foco, socialização, rotina…
          </p>
        </div>
        <p className="mt-3 text-xs italic leading-relaxed text-muted-foreground/80">
          Aqui é apoio de quem entende de neurodivergência e do cansaço de cuidar — não
          substitui profissionais de saúde.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Quer ajustar o perfil antes?{" "}
          <Link
            href="/kolo-vivo"
            className="font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Ir pro Kolo Vivo
          </Link>
          .
        </p>
      </header>

      <ConversarForm
        membros={membros ?? []}
        initialMembroId={sp.membro}
        tema={temaContexto ?? undefined}
      />

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
      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {tipos.map((t) => {
          const Icon = ICONES_BIBLIOTECA[t.key] ?? Sparkles;
          const tone = TIPO_TONE[t.key] ?? TIPO_TONE_FALLBACK;
          return (
            <li key={t.key}>
              <Link
                href={`/apoio/${t.key}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white px-6 pb-6 pt-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]"
              >
                <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} />
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-xl",
                    tone.chip,
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <h3 className="mt-3 font-heading text-lg font-medium leading-snug text-foreground md:text-xl">
                  {t.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {DESCRICOES_BIBLIOTECA[t.key] ?? ""}
                </p>
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
          <ConversaItem
            key={c.id}
            id={c.id}
            titulo={c.titulo}
            createdAt={c.created_at}
            comBorda={idx > 0}
          />
        ))}
      </ul>
    </section>
  );
}
