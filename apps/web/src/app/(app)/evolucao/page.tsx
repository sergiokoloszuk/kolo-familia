import Link from "next/link";
import { differenceInCalendarDays, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileText,
  Plus,
  Sparkles,
  Sprout,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

/**
 * Evolução — visão longitudinal da jornada da criança e da família.
 *
 * Conforme protótipo (19/05/2026):
 *   - 3 resumo-cards no topo (registros / conquistas / dias com registro)
 *   - Filtro de período (7d / 30d / 90d / tudo) via ?periodo=
 *   - Timeline vertical com items mixados de diarios, check_ins_diarios e
 *     relatorios_gerados, ordenada por data descendente
 *   - CTA "Registrar dia" no hero
 *
 * Padrões (`ayla_padroes`) viriam aqui também, mas dependem da migration
 * 0019 estar aplicada — por ora omitidos.
 *
 * `/relatorios` segue ativo como rota legacy (NAV-9 → redirect futuro).
 */

type Periodo = "7d" | "30d" | "90d" | "tudo";

const PERIODO_DIAS: Record<Periodo, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  tudo: null,
};

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

export default async function EvolucaoPage(props: PageProps<"/evolucao">) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await props.searchParams;
  const periodo: Periodo = (
    sp.periodo === "7d" || sp.periodo === "90d" || sp.periodo === "tudo"
      ? sp.periodo
      : "30d"
  ) as Periodo;

  const dias = PERIODO_DIAS[periodo];
  const dataInicio = dias
    ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    : null;

  // Diarios + check-ins + relatórios em paralelo, todos no período.
  const [{ data: diarios }, { data: checkIns }, { data: relatorios }] =
    await Promise.all([
      (() => {
        let q = supabase
          .from("diarios")
          .select(
            "id, data, conquista, desafio, observacao_livre, possivel_gatilho, membros_atipicos(nome)",
          )
          .eq("family_account_id", familyId)
          .order("data", { ascending: false })
          .limit(100);
        if (dataInicio) q = q.gte("data", dataInicio);
        return q;
      })(),
      (() => {
        let q = supabase
          .from("check_ins_diarios")
          .select("id, data, escala_emocional_mae")
          .eq("family_account_id", familyId)
          .order("data", { ascending: false })
          .limit(100);
        if (dataInicio) q = q.gte("data", dataInicio);
        return q;
      })(),
      (() => {
        let q = supabase
          .from("relatorios_gerados")
          .select(
            "id, destinatario, janela_inicio, janela_fim, created_at, membros_atipicos(nome)",
          )
          .eq("family_account_id", familyId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (dataInicio) q = q.gte("created_at", dataInicio);
        return q;
      })(),
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

  // Resumo cards
  const totalConquistas = eventos.filter((e) => e.tipo === "conquista").length;
  const totalRegistros = eventos.filter(
    (e) =>
      e.tipo === "conquista" || e.tipo === "desafio" || e.tipo === "registro",
  ).length;
  const diasUnicos = new Set(
    eventos
      .filter(
        (e) =>
          e.tipo === "conquista" ||
          e.tipo === "desafio" ||
          e.tipo === "registro" ||
          e.tipo === "check_in",
      )
      .map((e) => e.data.slice(0, 10)),
  ).size;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconCard tone="light" size="lg" className="hidden md:inline-flex">
            <TrendingUp aria-hidden />
          </IconCard>
          <div>
            <Eyebrow>A jornada longa</Eyebrow>
            <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
              Evolução em{" "}
              <em className="not-italic text-brand-purple">movimento</em>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              O que mudou, o que apareceu, o que ela está treinando — do mais
              recente ao mais antigo.
            </p>
          </div>
        </div>
        <Link
          href="/registrar/diario"
          className={cn(buttonVariants({ size: "lg" }), "shrink-0 gap-2")}
        >
          <Plus className="size-4 stroke-[2.2]" aria-hidden />
          Registrar dia
        </Link>
      </header>

      {/* Resumo cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <ResumoCard
          icon={Sparkles}
          numero={totalConquistas}
          label="Conquistas registradas"
          accent="conquista"
        />
        <ResumoCard
          icon={Sprout}
          numero={totalRegistros}
          label="Total de registros no período"
          accent="area"
        />
        <ResumoCard
          icon={CalendarClock}
          numero={diasUnicos}
          label="Dias com registro"
          accent="padrao"
        />
      </section>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-foreground">
          Linha do tempo
        </h2>
        <div
          role="tablist"
          aria-label="Período"
          className="inline-flex gap-1 rounded-2xl bg-kolo-lilas-bg-2 p-1.5"
        >
          {(["7d", "30d", "90d", "tudo"] as const).map((p) => (
            <Link
              key={p}
              href={`/evolucao?periodo=${p}`}
              role="tab"
              aria-selected={periodo === p}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                periodo === p
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p === "tudo" ? "Tudo" : p}
            </Link>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {eventos.length > 0 ? (
        <ol className="relative ml-3 flex flex-col gap-6 border-l-2 border-kolo-linha pl-8 pt-2">
          {eventos.map((ev, idx) => (
            <TimelineItem key={`${ev.tipo}-${idx}`} ev={ev} />
          ))}
        </ol>
      ) : (
        <EstadoVazio
          icon={<Sprout />}
          titulo={
            periodo === "tudo"
              ? "A jornada ainda não começou"
              : `Nada nos últimos ${periodo}`
          }
          descricao={
            periodo === "tudo"
              ? "Registra um primeiro dia e a linha do tempo começa a aparecer aqui — sem pressa de preencher tudo."
              : "Amplia a janela acima ou registra um dia recente — o silêncio nesse período pode ser só falta de registro, não de movimento."
          }
          acao={
            periodo === "tudo" ? (
              <Link
                href="/registrar/diario"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Registrar hoje
              </Link>
            ) : undefined
          }
        />
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

function ResumoCard({
  icon: Icon,
  numero,
  label,
  accent,
}: {
  icon: typeof Sparkles;
  numero: number;
  label: string;
  accent: "conquista" | "area" | "padrao";
}) {
  const accentColors: Record<typeof accent, string> = {
    conquista: "before:bg-brand-yellow",
    area: "before:bg-brand-purple",
    padrao: "before:bg-cat-emocao",
  };
  const iconBg: Record<typeof accent, string> = {
    conquista: "bg-brand-yellow/15 text-brand-yellow-dark",
    area: "bg-kolo-lilas-bg-2 text-brand-purple",
    padrao: "bg-cat-emocao-bg text-cat-emocao",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm",
        "before:absolute before:left-0 before:top-0 before:h-1 before:w-full",
        accentColors[accent],
      )}
    >
      <span
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl",
          iconBg[accent],
        )}
      >
        <Icon className="size-5 stroke-[1.8]" aria-hidden />
      </span>
      <p className="mt-4 font-heading text-4xl text-foreground">{numero}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

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
