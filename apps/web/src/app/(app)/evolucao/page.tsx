import Link from "next/link";
import { differenceInCalendarDays, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileText,
  Sparkles,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

/**
 * Evolução (Fase 1) — leitura do que foi mudando ao longo do tempo.
 *
 * Removido:
 *   - 3 ResumoCards (KPI dashboard) → números não são protagonistas
 *   - Filtros 7d/30d/90d/Tudo → temporalidade vem do conteúdo, não de query manual
 *   - Botão grande "Registrar dia" no header → link discreto no rodapé
 *   - IconCard pesado no header
 *
 * Mantido:
 *   - Timeline editorial (Fase 2 vai refinar visual)
 *   - EstadoVazio acolhedor
 *   - Card de Relatórios pra terapeuta/escola
 */

type TimelineEvento =
  | {
      tipo: "conquista";
      data: string;
      titulo: string;
      descricao: string | null;
      membro_nome: string | null;
    }
  | {
      tipo: "desafio";
      data: string;
      titulo: string;
      descricao: string | null;
      membro_nome: string | null;
      gatilho: string | null;
    }
  | {
      tipo: "registro";
      data: string;
      titulo: string;
      membro_nome: string | null;
    }
  | {
      tipo: "check_in";
      data: string;
      escala: string | null;
    }
  | {
      tipo: "relatorio";
      data: string;
      destinatario: string;
      janela_inicio: string;
      janela_fim: string;
      id: string;
      membro_nome: string | null;
    };

function nomeFromRel(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    const first = rel[0] as { nome?: string } | undefined;
    return first?.nome ?? null;
  }
  return (rel as { nome?: string }).nome ?? null;
}

const ESCALA_LABEL: Record<string, string> = {
  muito_bem: "Muito bem",
  bem: "Bem",
  neutro: "Neutro",
  dificil: "Difícil",
  muito_dificil: "Muito difícil",
};

export default async function EvolucaoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  // Sem filtro de período — sempre traz os últimos N registros,
  // a temporalidade emerge do conteúdo (datas relativas dos itens).
  const [{ data: diarios }, { data: checkIns }, { data: relatorios }] =
    await Promise.all([
      supabase
        .from("diarios")
        .select(
          "id, data, conquista, desafio, observacao_livre, possivel_gatilho, membros_atipicos(nome)",
        )
        .eq("family_account_id", familyId)
        .order("data", { ascending: false })
        .limit(100),
      supabase
        .from("check_ins_diarios")
        .select("id, data, escala_emocional_mae")
        .eq("family_account_id", familyId)
        .order("data", { ascending: false })
        .limit(100),
      supabase
        .from("relatorios_gerados")
        .select(
          "id, destinatario, janela_inicio, janela_fim, created_at, membros_atipicos(nome)",
        )
        .eq("family_account_id", familyId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  // Mescla em uma timeline ordenada
  const eventos: TimelineEvento[] = [];

  for (const d of diarios ?? []) {
    const membroNome = nomeFromRel(d.membros_atipicos);
    if (d.conquista && d.conquista.trim().length > 0) {
      eventos.push({
        tipo: "conquista",
        data: d.data,
        titulo: d.conquista,
        descricao: d.observacao_livre,
        membro_nome: membroNome,
      });
    }
    if (d.desafio && d.desafio.trim().length > 0) {
      eventos.push({
        tipo: "desafio",
        data: d.data,
        titulo: d.desafio,
        descricao: d.observacao_livre,
        membro_nome: membroNome,
        gatilho: d.possivel_gatilho,
      });
    }
    if (
      !d.conquista &&
      !d.desafio &&
      d.observacao_livre &&
      d.observacao_livre.trim().length > 0
    ) {
      eventos.push({
        tipo: "registro",
        data: d.data,
        titulo: d.observacao_livre,
        membro_nome: membroNome,
      });
    }
  }

  for (const c of checkIns ?? []) {
    eventos.push({
      tipo: "check_in",
      data: c.data,
      escala: c.escala_emocional_mae,
    });
  }

  for (const r of relatorios ?? []) {
    eventos.push({
      tipo: "relatorio",
      data: r.created_at,
      id: r.id,
      destinatario: r.destinatario,
      janela_inicio: r.janela_inicio,
      janela_fim: r.janela_fim,
      membro_nome: nomeFromRel(r.membros_atipicos),
    });
  }

  // Ordena descendente por data
  eventos.sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Eyebrow>O que foi mudando</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          A jornada{" "}
          <em className="not-italic text-brand-purple">de vocês</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          O que apareceu, o que ficou, o que vai mudando — aos poucos.
        </p>
      </header>

      <section>
        <h2 className="font-heading text-2xl text-foreground">
          Como os dias foram{" "}
          <em className="not-italic text-brand-purple">acontecendo</em>
        </h2>

        {eventos.length > 0 ? (
          <ol className="relative ml-3 mt-6 flex flex-col gap-6 border-l-2 border-kolo-linha pl-8 pt-2">
            {eventos.map((ev, idx) => (
              <TimelineItem key={`${ev.tipo}-${idx}`} ev={ev} />
            ))}
          </ol>
        ) : (
          <div className="mt-6">
            <EstadoVazio
              icon={<Sprout />}
              titulo="A jornada ainda não começou"
              descricao="Os primeiros dias vão aparecer aqui — sem pressa de preencher tudo."
              acao={
                <Link
                  href="/registrar/diario"
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Registrar hoje
                </Link>
              }
            />
          </div>
        )}
      </section>

      {/* Link discreto pra registrar — convite contextual, não CTA estrutural */}
      {eventos.length > 0 && (
        <div className="flex justify-center">
          <Link
            href="/registrar/diario"
            className="text-sm font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Registrar um dia →
          </Link>
        </div>
      )}

      {/* CTA pra ver relatórios (link pro legacy enquanto não consolida) */}
      <div className="flex items-center justify-between gap-4 rounded-3xl border border-kolo-linha bg-white p-6">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">
            Relatórios pra terapeuta e escola
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Compile registros em PDF ou link vivo compartilhável.
          </p>
        </div>
        <Link
          href="/relatorios"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Abrir relatórios
          <ArrowRight className="ml-1 size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function TimelineItem({ ev }: { ev: TimelineEvento }) {
  const config = getTimelineConfig(ev);
  const dataObj = new Date(ev.data);
  const ehHoje = differenceInCalendarDays(new Date(), dataObj) === 0;

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute -left-[42px] top-1.5 flex size-6 items-center justify-center rounded-full ring-4 ring-background",
          config.dotBg,
        )}
      >
        <config.icon className={cn("size-3 stroke-[2.5]", config.dotIcon)} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.12em]">
            {ehHoje
              ? "Hoje"
              : formatRelative(dataObj, new Date(), { locale: ptBR })}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
              config.badgeStyles,
            )}
          >
            {config.tipoLabel}
          </span>
          {ev.tipo !== "check_in" && ev.tipo !== "relatorio" && ev.membro_nome && (
            <span className="text-muted-foreground/80">· {ev.membro_nome}</span>
          )}
        </div>

        <TimelineItemBody ev={ev} />
      </div>
    </li>
  );
}

function TimelineItemBody({ ev }: { ev: TimelineEvento }) {
  if (ev.tipo === "conquista") {
    return (
      <>
        <h4 className="font-heading text-lg leading-snug text-foreground">
          {ev.titulo}
        </h4>
        {ev.descricao && (
          <p className="text-sm text-muted-foreground">{ev.descricao}</p>
        )}
      </>
    );
  }
  if (ev.tipo === "desafio") {
    return (
      <>
        <h4 className="font-heading text-lg leading-snug text-foreground">
          {ev.titulo}
        </h4>
        {ev.gatilho && (
          <p className="text-xs text-muted-foreground">
            Possível gatilho: <span className="font-semibold">{ev.gatilho}</span>
          </p>
        )}
        {ev.descricao && (
          <p className="text-sm text-muted-foreground">{ev.descricao}</p>
        )}
      </>
    );
  }
  if (ev.tipo === "registro") {
    return <p className="text-sm text-foreground">{ev.titulo}</p>;
  }
  if (ev.tipo === "check_in") {
    return (
      <p className="text-sm text-muted-foreground">
        Você marcou:{" "}
        <span className="font-semibold text-foreground">
          {ev.escala ? ESCALA_LABEL[ev.escala] ?? ev.escala : "sem escala"}
        </span>
      </p>
    );
  }
  if (ev.tipo === "relatorio") {
    return (
      <>
        <p className="text-sm text-foreground">
          {ev.membro_nome ?? "—"} ·{" "}
          {ev.destinatario === "terapeuta" ? "Para terapeuta" : "Para escola"}
        </p>
        <p className="text-xs text-muted-foreground">
          Janela {ev.janela_inicio} → {ev.janela_fim}
        </p>
        <Link
          href={`/relatorios/${ev.id}`}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-purple hover:underline"
        >
          Abrir relatório
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </>
    );
  }
  return null;
}

function getTimelineConfig(ev: TimelineEvento) {
  switch (ev.tipo) {
    case "conquista":
      return {
        icon: Sparkles,
        tipoLabel: "Conquista",
        dotBg: "bg-brand-yellow",
        dotIcon: "text-brand-purple-dark",
        badgeStyles: "bg-brand-yellow/20 text-brand-purple-dark",
      };
    case "desafio":
      return {
        icon: TriangleAlert,
        tipoLabel: "Desafio",
        dotBg: "bg-cat-emocao-bg",
        dotIcon: "text-cat-emocao",
        badgeStyles: "bg-cat-emocao-bg text-cat-emocao",
      };
    case "registro":
      return {
        icon: FileText,
        tipoLabel: "Registro",
        dotBg: "bg-kolo-lilas-bg-2",
        dotIcon: "text-muted-foreground",
        badgeStyles: "bg-kolo-lilas-bg-2 text-muted-foreground",
      };
    case "check_in":
      return {
        icon: CalendarClock,
        tipoLabel: "Check-in",
        dotBg: "bg-cat-foco-bg",
        dotIcon: "text-cat-foco",
        badgeStyles: "bg-cat-foco-bg text-cat-foco",
      };
    case "relatorio":
      return {
        icon: BarChart3,
        tipoLabel: "Relatório",
        dotBg: "bg-brand-purple/15",
        dotIcon: "text-brand-purple",
        badgeStyles: "bg-brand-purple/15 text-brand-purple",
      };
  }
}
