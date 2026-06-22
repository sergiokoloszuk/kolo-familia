import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { ArrowRight, FileText, Sprout } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { AREAS_DIARIO } from "@/lib/ia/classificar-area";
import { primeiroNome, deNome } from "@/lib/nome";
import { cn } from "@/lib/utils";
import { SeletorCrianca } from "../seletor-crianca";
import { DOMINIOS } from "../kolo-vivo/dominios";

// Leitura por área (Passo 3): conquistas/desafios agrupados pela etiqueta
// conquista_area/desafio_area que o Passo 1 grava.
type AreaBucket = {
  area: string;
  label: string;
  conquistas: { texto: string; data: string }[];
  desafios: { texto: string; data: string; gatilho: string | null }[];
};

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
      tipo: "plano";
      data: string;
      id: string;
      titulo: string;
      resultado: string;
      membro_nome: string | null;
    }
  | {
      tipo: "estrategia";
      data: string;
      id: string;
      titulo: string;
      membro_nome: string | null;
    }
  | {
      tipo: "padrao";
      data: string;
      titulo: string;
      estado: string;
      membro_nome: string | null;
    }
  | {
      tipo: "marco";
      data: string;
      titulo: string;
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

  // Criança ativa (cookie): a Evolução é DELA. Sentinela quando não há filho.
  const { data: membrosLista } = await supabase
    .from("membros_atipicos")
    .select("id, nome, genero")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });
  const criancas = (membrosLista ?? []).map((m) => ({ id: m.id as string, nome: m.nome as string }));
  const ativaId = (await resolverCriancaAtivaId(membrosLista ?? [])) ?? null;
  const filtroMembro = ativaId ?? "00000000-0000-0000-0000-000000000000";

  // Nome (1º) + gênero da criança ativa → títulos "do Mario", "Como o Mario está".
  const ativaMembro = (membrosLista ?? []).find((m) => m.id === ativaId) ?? membrosLista?.[0];
  const nomeCA = ativaMembro?.nome ? primeiroNome(ativaMembro.nome as string) : null;
  const generoCA = (ativaMembro?.genero as string | null) ?? null;
  const artigoCA = generoCA === "masculino" ? "o" : generoCA === "feminino" ? "a" : "";
  const tituloComoEsta = nomeCA
    ? `Como ${artigoCA ? `${artigoCA} ` : ""}${nomeCA} está`
    : "Como vocês estão";

  const [
    { data: diarios },
    { data: checkIns },
    { data: padroes },
    { data: conversas },
    { data: perfis },
    { data: planos },
  ] = await Promise.all([
    supabase
      .from("diarios")
      .select(
        "id, data, conquista, desafio, conquista_area, desafio_area, observacao_livre, possivel_gatilho, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", filtroMembro)
      .order("data", { ascending: false })
      .limit(100),
    // Check-in é o humor da MÃE (família) — fica como está, não é por criança.
    supabase
      .from("check_ins_diarios")
      .select("id, data, escala_emocional_mae")
      .eq("family_account_id", familyId)
      .order("data", { ascending: false })
      .limit(100),
    // Padrões que a Ayla vem notando (o "o que preocupa") — só os ativos.
    supabase
      .from("ayla_padroes")
      .select("id, descricao, estado, confianca, ultima_evidencia, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", filtroMembro)
      .neq("estado", "descartado")
      .gte("ultima_evidencia", dias30AtrasIso)
      .order("ultima_evidencia", { ascending: false })
      .limit(20),
    // Conversas das Estratégias (o que a mãe trouxe pra resolver).
    supabase
      .from("conversas")
      .select("id, titulo, created_at, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", filtroMembro)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("perfil_vivo_membro")
      .select(
        "sensorial, desafios_regulacao, corpo_rotina, categorias_extras, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", filtroMembro),
    supabase
      .from("planos")
      .select("id, titulo, resultado, resultado_em, created_at, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", filtroMembro)
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
  const padroes30d = (padroes ?? []).length;
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

  // Check-in: só os dias DIFÍCEIS entram na linha do tempo. Mostrar "você
  // esteve bem" todo santo dia inchava a página sem dizer nada — o dia difícil
  // é que é um momento que vale registrar e olhar depois.
  for (const c of checkIns ?? []) {
    const escala = c.escala_emocional_mae as string | null;
    if (escala === "dificil" || escala === "muito_dificil") {
      eventos.push({ tipo: "check_in", data: c.data, escala });
    }
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

  for (const c of conversas ?? []) {
    eventos.push({
      tipo: "estrategia",
      data: c.created_at as string,
      id: c.id as string,
      titulo: (c.titulo as string | null)?.trim() || "Conversa nas Estratégias",
      membro_nome: nomeFromRel(c.membros_atipicos),
    });
  }

  for (const p of padroes ?? []) {
    eventos.push({
      tipo: "padrao",
      data: (p.ultima_evidencia as string),
      titulo: p.descricao as string,
      estado: p.estado as string,
      membro_nome: nomeFromRel(p.membros_atipicos),
    });
  }

  // Marcos da evolução do Kolo Vivo (mudanças de status datadas).
  for (const p of perfis ?? []) {
    const extras = (p.categorias_extras as Record<string, unknown> | null) ?? {};
    const marcos = Array.isArray(extras.marcos) ? extras.marcos : [];
    const nome = nomeFromRel((p as { membros_atipicos?: unknown }).membros_atipicos);
    for (const m of marcos) {
      if (!m || typeof m !== "object") continue;
      const mm = m as { data?: unknown; texto?: unknown };
      if (typeof mm.data !== "string" || typeof mm.texto !== "string") continue;
      eventos.push({ tipo: "marco", data: mm.data, titulo: mm.texto, membro_nome: nome });
    }
  }

  // Teto pra não virar um rolo infinito: os ~40 momentos mais recentes.
  eventos.sort((a, b) => b.data.localeCompare(a.data));
  const eventosVisiveis = eventos.slice(0, 40);
  const buckets = agruparPorBucket(eventosVisiveis);

  // ── Passo 3: leitura por ÁREA (etiquetas conquista_area/desafio_area) ──
  const areaMap = new Map<string, AreaBucket>();
  const ensureArea = (area: string): AreaBucket => {
    let b = areaMap.get(area);
    if (!b) {
      b = { area, label: AREAS_DIARIO[area] ?? area, conquistas: [], desafios: [] };
      areaMap.set(area, b);
    }
    return b;
  };
  for (const d of diarios ?? []) {
    const ca = d.conquista_area as string | null;
    const da = d.desafio_area as string | null;
    if (d.conquista && (d.conquista as string).trim() && ca && AREAS_DIARIO[ca]) {
      ensureArea(ca).conquistas.push({ texto: d.conquista as string, data: d.data as string });
    }
    if (d.desafio && (d.desafio as string).trim() && da && AREAS_DIARIO[da]) {
      ensureArea(da).desafios.push({
        texto: d.desafio as string,
        data: d.data as string,
        gatilho: (d.possivel_gatilho as string | null) ?? null,
      });
    }
  }
  const temas = [...areaMap.values()].sort(
    (a, b) => b.conquistas.length + b.desafios.length - (a.conquistas.length + a.desafios.length),
  );

  // Síntese "Como o Mario está" — por REGRA (sem IA): áreas com mais conquistas
  // + área com desafio mais recorrente.
  const joinE = (arr: string[]) =>
    arr.length <= 1 ? arr[0] ?? "" : `${arr.slice(0, -1).join(", ")} e ${arr[arr.length - 1]}`;
  const topConquistaAreas = [...temas]
    .filter((t) => t.conquistas.length > 0)
    .sort((a, b) => b.conquistas.length - a.conquistas.length)
    .slice(0, 2)
    .map((t) => t.label);
  const topDesafio =
    [...temas]
      .filter((t) => t.desafios.length > 0)
      .sort((a, b) => b.desafios.length - a.desafios.length)[0]?.label ?? null;
  let sintese: string;
  if (topConquistaAreas.length && topDesafio) {
    sintese = `Mais conquistas em ${joinE(topConquistaAreas)}. O desafio que mais voltou foi em ${topDesafio}.`;
  } else if (topConquistaAreas.length) {
    sintese = `Mais conquistas em ${joinE(topConquistaAreas)}.`;
  } else if (topDesafio) {
    sintese = `O desafio que mais apareceu foi em ${topDesafio}.`;
  } else {
    sintese = `Conforme você for registrando, um resumo do momento ${nomeCA ? deNome(nomeCA, generoCA) : "de vocês"} aparece aqui.`;
  }

  // "O que ajudou" — planos que deram certo (highlight curado, além da timeline).
  const planosAjuda = (planos ?? []).filter(
    (p) => p.resultado === "funcionou" || p.resultado === "parcial",
  );

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Eyebrow>Evolução</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          O caminho{" "}
          <em className="not-italic text-brand-purple">
            {nomeCA ? deNome(nomeCA, generoCA) : "de vocês"}
          </em>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          O que apareceu, o que ficou, o que vai mudando — aos poucos.
        </p>
        {criancas.length > 1 && ativaId && (
          <div className="mt-4 w-fit">
            <SeletorCrianca criancas={criancas} ativaId={ativaId} variant="screen" />
          </div>
        )}
      </header>

      {/* COMO O MARIO ESTÁ — síntese por regra + números do mês */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-yellow/30 bg-gradient-to-br from-brand-yellow/[0.08] to-white px-6 py-6 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_16px_rgba(46,10,82,0.04)] md:px-8 md:py-7">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-yellow via-brand-yellow/50 to-transparent"
        />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {tituloComoEsta}
        </h2>
        <p className="mt-2 max-w-2xl font-heading text-xl leading-snug text-foreground">
          {sintese}
        </p>
        {temAlgumResumo && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <StatPill
              num={conquistas30d}
              label={conquistas30d === 1 ? "conquista (30d)" : "conquistas (30d)"}
            />
            <StatPill
              num={dominiosComMovimento.size}
              label={dominiosComMovimento.size === 1 ? "área em movimento" : "áreas em movimento"}
            />
            <StatPill num={padroes30d} label={padroes30d === 1 ? "padrão" : "padrões"} />
          </div>
        )}
      </section>

      {/* MARIO EM CADA TEMA — agrupado pelas etiquetas de área */}
      {temas.length > 0 && (
        <section>
          <h2 className="font-heading text-2xl text-foreground">
            {nomeCA ?? "Cada um"} em cada{" "}
            <em className="not-italic text-brand-purple">tema</em>
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {temas.map((t) => (
              <TemaCard key={t.area} tema={t} />
            ))}
          </div>
        </section>
      )}

      {/* O QUE AJUDOU — planos que deram certo (highlight, além da timeline) */}
      {planosAjuda.length > 0 && (
        <section>
          <h2 className="font-heading text-2xl text-foreground">
            O que <em className="not-italic text-brand-purple">ajudou</em>
          </h2>
          <ul className="mt-5 flex flex-col gap-2.5">
            {planosAjuda.slice(0, 5).map((p) => (
              <li
                key={p.id as string}
                className="flex items-start gap-3 rounded-2xl border border-foreground/[0.06] bg-white px-4 py-3.5"
              >
                <span aria-hidden className="mt-0.5 font-mono text-sm leading-none text-brand-purple">
                  ◈
                </span>
                <div className="flex-1">
                  <p className="text-base leading-relaxed text-foreground">
                    {p.titulo as string}
                    <span className="text-muted-foreground">
                      {" "}
                      · {RESULTADO_PLANO_LABEL[p.resultado as string] ?? (p.resultado as string)}
                    </span>
                  </p>
                  <Link
                    href={`/planos/${p.id}`}
                    className="mt-0.5 inline-flex w-fit text-xs font-semibold text-brand-purple underline-offset-4 hover:underline"
                  >
                    Abrir →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
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

      {/* RELATÓRIO — fecha a página (Passo 4 melhora o conteúdo). */}
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
            A Kolo traduz o Perfil + os últimos meses num PDF pra você revisar e baixar.
          </p>
        </div>
        <ArrowRight
          className="size-4 shrink-0 text-brand-purple transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
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
// Números do mês — pílulas compactas dentro do "Como X está"
// ============================================================

function StatPill({ num, label }: { num: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-yellow/40 bg-white px-3 py-1.5 text-sm">
      <span className="font-heading text-base font-semibold text-foreground">{num}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

// ============================================================
// Card de tema — conquistas (✓) e desafios (!) agrupados por área
// ============================================================

function TemaCard({ tema }: { tema: AreaBucket }) {
  const conq = tema.conquistas.slice(0, 2);
  const des = tema.desafios.slice(0, 2);
  return (
    <article className="relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-white p-5 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-medium text-foreground">{tema.label}</h3>
        <span className="shrink-0 text-xs font-semibold">
          {tema.conquistas.length > 0 && (
            <span className="text-cat-social">↑{tema.conquistas.length}</span>
          )}
          {tema.conquistas.length > 0 && tema.desafios.length > 0 && (
            <span className="text-muted-foreground"> · </span>
          )}
          {tema.desafios.length > 0 && (
            <span className="text-cat-sensorial">!{tema.desafios.length}</span>
          )}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {conq.map((c, i) => (
          <li key={`c${i}`} className="flex items-start gap-2 text-sm">
            <span aria-hidden className="mt-[3px] font-mono leading-none text-cat-social">✓</span>
            <span className="text-foreground">{c.texto}</span>
          </li>
        ))}
        {des.map((d, i) => (
          <li key={`d${i}`} className="flex flex-col gap-0.5">
            <span className="flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-[3px] font-mono leading-none text-cat-sensorial">!</span>
              <span className="text-foreground">{d.texto}</span>
            </span>
            {d.gatilho && (
              <span className="ml-[18px] text-xs text-muted-foreground">
                gatilho: <span className="italic text-foreground/70">{d.gatilho}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

// ============================================================
// Render por tipo — marcadores tipográficos discretos
// ============================================================

const ESTADO_PADRAO_LABEL: Record<string, string> = {
  hipotese: "ainda observando",
  observado: "vem se repetindo",
  confirmado_mae: "você confirmou",
};

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
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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

  if (ev.tipo === "estrategia") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-brand-purple"
        >
          ›
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground">
            Vocês conversaram sobre{" "}
            <span className="text-muted-foreground">“{ev.titulo}”</span>
          </p>
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {ev.membro_nome}
            </p>
          )}
          <Link
            href={`/conversar/${ev.id}`}
            className="mt-1 inline-flex w-fit text-xs font-semibold text-brand-purple underline-offset-4 hover:underline"
          >
            Abrir →
          </Link>
        </div>
      </div>
    );
  }

  if (ev.tipo === "marco") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-cat-social"
        >
          ↗
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground">
            Marco no Perfil: {ev.titulo}
            {ev.membro_nome && (
              <span className="text-muted-foreground"> · {ev.membro_nome}</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (ev.tipo === "padrao") {
    return (
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm leading-none text-cat-emocao"
        >
          ~
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <p className="text-base leading-relaxed text-foreground">
            A Ayla vem notando: {ev.titulo}
            <span className="text-muted-foreground">
              {" "}
              · {ESTADO_PADRAO_LABEL[ev.estado] ?? ev.estado}
            </span>
          </p>
          {ev.membro_nome && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {ev.membro_nome}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
