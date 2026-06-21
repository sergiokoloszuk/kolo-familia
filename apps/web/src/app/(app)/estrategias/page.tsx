import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { ConversarForm } from "../conversar/conversar-form";
import { ConversaItem } from "./conversa-item";

/**
 * Estratégias Kolo — UM CAMINHO:
 *   1. Conversar sobre o que aconteceu (ConversarForm)
 *   2. Conversas anteriores (5 últimas)
 *
 * A antiga "biblioteca de tipos" (Brincadeiras/Atividades/Crenças…) saiu daqui:
 * os formatos viram as abas do plano; a conversa conduz pra eles. As rotas
 * /apoio/[key] seguem acessíveis por URL (legado), só não há mais os botões.
 */

export default async function EstrategiasPage({
  searchParams,
}: {
  searchParams: Promise<{ membro?: string; tema?: string }>;
}) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await searchParams;
  const temaContexto = sp.tema?.trim() || null;

  const [{ data: membros }, { data: conversas }] = await Promise.all([
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
      .limit(5),
  ]);

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
            Ir pro Perfil
          </Link>
          .
        </p>
      </header>

      <ConversarForm
        membros={membros ?? []}
        initialMembroId={sp.membro}
        tema={temaContexto ?? undefined}
      />

      {temConversas && <ConversasAnterioresSection conversas={conversas ?? []} />}
    </div>
  );
}

// ============================================================
// Conversas anteriores — lista editorial (5 últimas)
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
