import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { ArrowRight, Eye, FileText, Sprout, Target, Trophy, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";
import { DOMINIOS } from "../kolo-vivo/dominios";

/**
 * Evolução (Fase 2) — leitura editorial do que foi mudando.
 *
 * Antes: timeline com dots redondos coloridos, border-l vertical,
 * badges categóricas "Conquista/Desafio/Registro/Check-in/Relatório".
 *
 * Agora: eventos agrupados em BUCKETS TEMPORAIS naturais (Hoje /
 * Ontem / Esta semana / etc), com marcadores tipográficos sutis
 * (✓ ! · ○ ◇) e leitura corrida entre items. Mesma régua de
 * "Essa semana" da Home.
 *
 * Mantém: queries dos diários/check-ins/relatórios, schema, banco.
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
    }
  | {
      tipo: "plano";
      data: string;
      id: string;
      titulo: string;
      resultado: string;
      membro_nome: string | null;
    };

const RESULTADO_PLANO_LABEL: Record<string, string> = {
  funcionou: "funcionou",
  parcial: "funcionou mais ou menos",
  nao_funcionou: "não funcionou",
  nao_testou: "ainda não testado",
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
  muito_bem: "muito bem",
  bem: "bem",
  neutro: "neutro",
  dificil: "difícil",
  muito_dificil: "muito difícil",
};

/**
 * Buckets temporais — janelas naturais que dão estrutura sem filtros
 * manuais. Cada bucket vira uma "seção" com h3 micromarker discreto.
 */
function bucketTemporal(dataISO: string): { label: string; ordem: number } {
  const dias = differenceInCalendarDays(new Date(), new Date(dataISO));
  if (dias <= 0) return { label: "Hoje", ordem: 0 };
  if (dias === 1) return { label: "Ontem", ordem: 1 };
  if (dias <= 7) return { label: "Esta semana", ordem: 2 };
  if (dias <= 14) return { label: "Semana passada", ordem: 3 };
  if (dias <= 30) return { label: "Este mês", ordem: 4 };
  if (dias <= 60) return { label: "Mês passado", ordem: 5 };
  if (dias <= 90) return { label: "Há alguns meses", ordem: 6 };
  if (dias <= 180) return { label: "Há vários meses", ordem: 7 };
  return { label: "Mais antigo", ordem: 8 };
}

function agruparPorBucket(
  eventos: TimelineEvento[],
): Array<{ label: string; ordem: number; eventos: TimelineEvento[] }> {
  const map = new Map<
    number,
    { label: string; ordem: number; eventos: TimelineEvento[] }
  >();
  for (const ev of eventos) {
    const { label, ordem } = bucketTemporal(ev.data);
    if (!map.has(ordem)) map.set(ordem, { label, ordem, eventos: [] });
    map.get(ordem)!.eventos.push(ev);
  }
  return [...map.values()].sort((a, b) => a.ordem - b.ordem);
}

export default async function EvolucaoPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const dias30AtrasIso = new Date(
    new Date().getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const dias30AtrasData = dias30AtrasIso.slice(0, 10);

  const [
    { data: diarios },
    { data: checkIns },
    { data: relatorios },
    { count: padroesCount },
    { data: perfis },
    { data: planos },
  ] = await Promise.all([
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
    supabase
      .from("ayla_padroes")
      .select("id", { count: "exact", head: true })
      .eq("family_account_id", familyId)
      .gte("created_at", dias30AtrasIso),
    supabase
      .from("perfil_vivo_membro")
      .select("sensorial, desafios_regulacao, corpo_rotina, categorias_extras")
      .eq("family_account_id", familyId),
    supabase
      .from("planos")
      .select("id, titulo, resultado, resultado_em, created_at, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .not("resultado", "is", null)
      .order("resultado_em", { ascending: false })
      .limit(30),
  ]);

  // Resumo (3 cards do topo) — peso visual do protótipo, dados reais.
  const conquistas30d = (diarios ?? []).filter(
    (d) => d.conquista && d.conquista.trim().length > 0 && d.data >= dias30AtrasData,
  ).length;

  const dominiosComMovimento = new Set<string>();
  const textoDe = (v: unknown): string => {
    if (!v || typeof v !== "object") return "";
    const t = (v as { texto?: unknown }).texto;
    return typeof t === "string" ? t : "";
  };
  for (const row of perfis ?? []) {
    const extras = (row.categorias_extras as Record<string, unknown> | null) ?? {};
    for (const d of DOMINIOS) {
      const principal =
        d.storage === "toplevel"
          ? textoDe((row as Record<string, unknown>)[d.key])
          : textoDe(extras[d.key]);
      const legacy = d.legacyFallback
        ? textoDe((row as Record<string, unknown>)[d.legacyFallback])
        : "";
      if (principal.trim().length > 10 || legacy.trim().length > 10) {
        dominiosComMovimento.add(d.key);
      }
    }
  }
  const padroes30d = padroesCount ?? 0;
  const temAlgumResumo = conquistas30d + dominiosComMovimento.size + padroes30d > 0;

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

  for (const p of planos ?? []) {
    eventos.push({
      tipo: "plano",
      data: (p.resultado_em as string | null) ?? (p.created_at as string),
      id: p.id as string,
      titulo: p.titulo as string,
      resultado: p.resultado as string,
      membro_nome: nomeFromRel(p.membros_atipicos),
    });
  }

  eventos.sort((a, b) => b.data.localeCompare(a.data));
  const buckets = agruparPorBucket(eventos);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Eyebrow>Evolução</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          O caminho{" "}
          <em className="not-italic text-brand-purple">de vocês</em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          O que apareceu, o que ficou, o que vai mudando — aos poucos.
        </p>
      </header>

      <Link
        href="/evolucao/relatorio"
        className="group flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 px-5 py-4 transition-colors hover:border-brand-purple/40"
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-[#8B5A00]"
        >
          <FileText className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-heading text-base font-medium text-foreground">
            Relatório pra escola ou terapeuta
          </p>
          <p className="text-sm text-muted-foreground">
            A Kolo traduz o Kolo Vivo + os últimos meses num PDF pra você revisar e baixar.
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-brand-purple transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      {temAlgumResumo && (
        <section className="grid gap-4 sm:grid-cols-3">
          <ResumoCard
            icon={Trophy}
            num={conquistas30d}
            label="Conquistas registradas nos últimos 30 dias"
            bar="bg-cat-social"
            chip="bg-cat-social-bg text-cat-social"
          />
          <ResumoCard
            icon={Target}
            num={dominiosComMovimento.size}
            sufixo="áreas"
            label="Domínios do Kolo Vivo com movimento"
            bar="bg-cat-foco"
            chip="bg-cat-foco-bg text-cat-foco"
          />
          <ResumoCard
            icon={Eye}
            num={padroes30d}
            label="Padrões detectados pela Ayla no mês"
            bar="bg-cat-sensorial"
            chip="bg-cat-sensorial-bg text-cat-sensorial"
          />
        </section>
      )}

      <section>
        <h2 className="font-heading text-2xl text-foreground">
          Como os dias foram{" "}
          <em className="not-italic text-brand-purple">acontecendo</em>
        </h2>

        {eventos.length > 0 ? (
          <div className="mt-8 flex flex-col gap-10">
            {buckets.map((bucket) => (
              <BucketSection key={bucket.label} bucket={bucket} />
            ))}
          </div>
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
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple underline-offset-4 hover:underline"
        >
          Abrir relatórios →
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Bucket temporal — seção com h3 micromarker + lista de eventos
// ============================================================

function BucketSection({
  bucket,
}: {
  bucket: { label: string; eventos: TimelineEvento[] };
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {bucket.label}
      </h3>
      <ul className="mt-3 flex flex-col">
        {bucket.eventos.map((ev, i) => (
          <li
            key={`${bucket.label}-${i}`}
            className={cn(
              "py-3.5",
              i > 0 && "border-t border-foreground/[0.06]",
            )}
          >
            <EventoItem ev={ev} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================
// Resumo cards do topo — peso visual do protótipo (evolucao-hero)
// ============================================================

function ResumoCard({
  icon: Icon,
  num,
  sufixo,
  label,
  bar,
  chip,
}: {
  icon: LucideIcon;
  num: number;
  sufixo?: string;
  label: string;
  bar: string;
  chip: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-3xl bg-white px-6 pb-6 pt-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)]">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", bar)} />
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl",
          chip,
        )}
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <div className="mt-4 font-heading text-4xl font-medium leading-none tracking-tight text-foreground">
        {num}
        {sufixo && (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {sufixo}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{label}</p>
    </article>
  );
}

// ============================================================
// Render por tipo — marcadores tipográficos discretos
// ============================================================

function EventoItem({ ev }: { ev: TimelineEvento }) {
  if (ev.tipo === "conquista") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm font-semibold leading-none text-cat-social"
        >
          ✓
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed tracking-[-0.005em] text-foreground">
            {ev.titulo}
          </p>
          {ev.descricao && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {ev.descricao}
            </p>
          )}
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {ev.membro_nome}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (ev.tipo === "desafio") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm font-semibold leading-none text-cat-sensorial"
        >
          !
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed tracking-[-0.005em] text-foreground">
            {ev.titulo}
          </p>
          {ev.gatilho && (
            <p className="text-xs text-muted-foreground">
              possível gatilho:{" "}
              <span className="italic text-foreground/70">{ev.gatilho}</span>
            </p>
          )}
          {ev.descricao && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {ev.descricao}
            </p>
          )}
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {ev.membro_nome}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (ev.tipo === "registro") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-foreground/30"
        >
          ·
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground/85">
            {ev.titulo}
          </p>
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {ev.membro_nome}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (ev.tipo === "check_in") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-cat-foco"
        >
          ○
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Como você esteve:{" "}
          <span className="text-foreground">
            {ev.escala ? ESCALA_LABEL[ev.escala] ?? ev.escala : "sem marcação"}
          </span>
        </p>
      </div>
    );
  }

  if (ev.tipo === "relatorio") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-brand-purple"
        >
          ◇
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground">
            Relatório pra{" "}
            {ev.destinatario === "terapeuta" ? "terapeuta" : "escola"}
            {ev.membro_nome && (
              <span className="text-muted-foreground"> · sobre {ev.membro_nome}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Janela {ev.janela_inicio} → {ev.janela_fim}
          </p>
          <Link
            href={`/relatorios/${ev.id}`}
            className="mt-1 inline-flex w-fit text-xs font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Abrir →
          </Link>
        </div>
      </div>
    );
  }

  if (ev.tipo === "plano") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-brand-purple"
        >
          ◈
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground">
            Plano: {ev.titulo}
            <span className="text-muted-foreground">
              {" "}
              · {RESULTADO_PLANO_LABEL[ev.resultado] ?? ev.resultado}
            </span>
          </p>
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {ev.membro_nome}
            </p>
          )}
          <Link
            href={`/planos/${ev.id}`}
            className="mt-1 inline-flex w-fit text-xs font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Abrir →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
