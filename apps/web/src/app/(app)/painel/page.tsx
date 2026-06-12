import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Lightbulb, NotebookPen, Sparkles, Sprout, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";
import { BalaoPrimeirosPassos } from "./balao-primeiros-passos";
import { BannerGenero } from "./banner-genero";

// ============================================================
// Chips categóricos do Foco da semana
// Tons fixos do design system (globals.css) — sem queries dinâmicas;
// o mapeamento de qual chip aparece em cada estado fica no focoContent.
// ============================================================

type ChipTone = "sensorial" | "social" | "emocao" | "foco" | "rotina";

const CHIP_TONES: Record<
  ChipTone,
  { bg: string; text: string; dot: string }
> = {
  sensorial: {
    bg: "bg-cat-sensorial-bg",
    text: "text-cat-sensorial",
    dot: "bg-cat-sensorial",
  },
  social: {
    bg: "bg-cat-social-bg",
    text: "text-cat-social",
    dot: "bg-cat-social",
  },
  emocao: {
    bg: "bg-cat-emocao-bg",
    text: "text-cat-emocao",
    dot: "bg-cat-emocao",
  },
  foco: {
    bg: "bg-cat-foco-bg",
    text: "text-cat-foco",
    dot: "bg-cat-foco",
  },
  rotina: {
    bg: "bg-cat-rotina-bg",
    text: "text-cat-rotina",
    dot: "bg-cat-rotina",
  },
};

// ============================================================
// Helpers do bloco "Essa semana" — microcontexto temporal
// ============================================================

/** Dia curto em pt-BR, sem ponto, lowercase. "seg" / "ter" / "qua" ... */
function diaCurto(dataISO: string): string {
  return format(new Date(dataISO), "EEE", { locale: ptBR })
    .replace(/\./g, "")
    .toLowerCase();
}

/**
 * Converte enum `quem_estava` do schema diarios em label humano curto.
 * Retorna null pra "outro" (genérico demais pra mostrar) ou ausente.
 */
function quemEstavaLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    mae: "mãe",
    pai: "pai",
    avo_a: "avó",
    avo_o: "avô",
    irmao_a: "irmão",
    baba: "babá",
    professor_a: "professora",
  };
  return map[raw] ?? null;
}

function FocoChip({ label, tone }: { label: string; tone: ChipTone }) {
  const t = CHIP_TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        t.bg,
        t.text,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />
      {label}
    </span>
  );
}

export default async function PainelPage() {
  const { user, supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const hoje = new Date();
  const seteDiasAtras = new Date(
    hoje.getTime() - 7 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const [
    { data: profile },
    { data: subscription },
    { data: membros },
    { data: conquistas },
    { data: desafios },
    { data: checkins7d },
    { count: sugestoesCount },
    { data: conversasRecentes },
    { data: perfisCompletude },
  ] = await Promise.all([
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at")
      .eq("family_account_id", familyId)
      .single(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, genero")
      .eq("family_account_id", familyId)
      .eq("ativo", true),
    supabase
      .from("diarios")
      .select(
        "id, data, conquista, observacao_livre, quem_estava, membro_atipico_id, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .not("conquista", "is", null)
      .gte("data", seteDiasAtras)
      .order("data", { ascending: false })
      .limit(3),
    supabase
      .from("diarios")
      .select("id, data, desafio, quem_estava")
      .eq("family_account_id", familyId)
      .not("desafio", "is", null)
      .gte("data", seteDiasAtras),
    supabase
      .from("check_ins_diarios")
      .select("id, data, escala_emocional_mae")
      .eq("family_account_id", familyId)
      .gte("data", seteDiasAtras)
      .order("data", { ascending: false }),
    supabase
      .from("sugestao_perfil_vivos")
      .select("id", { count: "exact", head: true })
      .eq("family_account_id", familyId)
      .eq("status", "pendente"),
    supabase
      .from("conversas")
      .select("id, titulo, created_at")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("perfil_vivo_membro")
      .select("completude_pct")
      .eq("family_account_id", familyId),
  ]);

  const greeting =
    profile?.como_chamar?.trim() ||
    profile?.nome_mae?.trim() ||
    user.email?.split("@")[0] ||
    "Você";
  const primeiraCrianca = membros?.[0];

  // Sinais vivos das 3 portas.
  const koloVivoPct = (() => {
    const arr = (perfisCompletude ?? []).map((p) => Number(p.completude_pct) || 0);
    return arr.length ? Math.round(Math.max(...arr)) : 0;
  })();
  const ultimaConversaTitulo =
    ((conversasRecentes ?? [])[0]?.titulo as string | null)?.trim() || null;

  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trial_ends_at
      ? Math.max(
          0,
          differenceInCalendarDays(new Date(subscription.trial_ends_at), hoje),
        )
      : null;

  // NPS elegibilidade
  const [
    { data: familyMeta },
    { data: alertasOpen },
    { count: adaptacoesPendentesCount },
    { data: aylaRecentes },
  ] = await Promise.all([
    supabase
      .from("family_accounts")
      .select("created_at")
      .eq("id", familyId)
      .single(),
    supabase
      .from("alertas")
      .select("id, regra_key, severidade, mensagem, first_disparo_em")
      .eq("family_account_id", familyId)
      .eq("estado", "open")
      .order("first_disparo_em", { ascending: false })
      .limit(3),
    supabase
      .from("adaptacoes_sugeridas")
      .select("id", { count: "exact", head: true })
      .eq("family_account_id", familyId)
      .eq("estado", "pendente"),
    supabase
      .from("ayla_messages")
      .select("id, texto, created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .not("texto", "is", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  const ultimaAyla = (aylaRecentes ?? [])[0] ?? null;
  const agora = hoje.getTime();
  const idadeDias = familyMeta
    ? Math.floor(
        (agora - new Date(familyMeta.created_at as string).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : 0;

  // ============================================================
  // Lógica do hero contextual
  // ============================================================
  const totalConquistas = conquistas?.length ?? 0;
  const totalDesafios = desafios?.length ?? 0;
  const totalCheckins = checkins7d?.length ?? 0;
  const diasComRegistro = new Set([
    ...(conquistas ?? []).map((d) => d.data),
    ...(desafios ?? []).map((d) => d.data),
    ...(checkins7d ?? []).map((c) => c.data),
  ]).size;
  const houveAtividade = totalConquistas + totalDesafios + totalCheckins > 0;

  // Segunda frase da saudação — leitura emocional da semana (como o
  // protótipo: "Oi, Maria. Essa semana foi boa."). Editorial e gentil;
  // some quando ainda não há registros.
  const saudacaoClause = !houveAtividade
    ? null
    : totalConquistas > totalDesafios
      ? "Essa semana teve coisas boas."
      : totalDesafios > totalConquistas
        ? "Um dia de cada vez — você está aqui."
        : "Cada semana tem de tudo.";

  // ============================================================
  // Itens de "Essa semana" — lista editorial humana
  // ============================================================
  // Usa o TEXTO BRUTO das conquistas/desafios (já são observações
  // escritas pela família). NUNCA contagens — listas devem soar como
  // diário de bordo, não como log de eventos.
  // Intercala conquista/desafio por data desc, limita a 5.
  const itensSemana = [
    ...(conquistas ?? []).map((c) => ({
      id: `c-${c.id}`,
      data: c.data,
      tipo: "conquista" as const,
      texto: c.conquista ?? "",
      quemEstava: (c as { quem_estava?: string | null }).quem_estava ?? null,
    })),
    ...(desafios ?? []).map((d) => ({
      id: `d-${d.id}`,
      data: d.data,
      tipo: "desafio" as const,
      texto: d.desafio ?? "",
      quemEstava: (d as { quem_estava?: string | null }).quem_estava ?? null,
    })),
    ...(conversasRecentes ?? []).map((c) => ({
      id: `e-${c.id}`,
      data: ((c.created_at as string) ?? "").slice(0, 10),
      tipo: "estrategia" as const,
      texto: (c.titulo as string | null)?.trim()
        ? `Conversaram sobre "${(c.titulo as string).trim()}"`
        : "Conversa nas Estratégias",
      quemEstava: null as string | null,
    })),
    ...(aylaRecentes ?? []).map((a) => {
      const t = ((a.texto as string) ?? "").trim().replace(/\s+/g, " ");
      // Corta em fim de palavra (não no meio) e com folga suficiente pra dar
      // contexto — as falas da Kolo perdiam o sentido cortadas curtas demais.
      const resumo = t.length > 180 ? `${t.slice(0, 180).replace(/\s+\S*$/, "")}…` : t;
      return {
        id: `a-${a.id}`,
        data: ((a.created_at as string) ?? "").slice(0, 10),
        tipo: "ayla" as const,
        texto: resumo,
        quemEstava: null as string | null,
      };
    }),
  ]
    .filter((i) => i.texto.trim().length > 0)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 6);

  // Marcador tipográfico por frente (diário / estratégia / ayla).
  const MARK_SEMANA: Record<string, { ch: string; cls: string }> = {
    conquista: { ch: "✓", cls: "text-cat-social" },
    desafio: { ch: "!", cls: "text-cat-sensorial" },
    estrategia: { ch: "›", cls: "text-cat-foco" },
    ayla: { ch: "✦", cls: "text-brand-purple" },
  };

  // ============================================================
  // Sinais — "Momentos que se conversam"
  // ============================================================
  // Regras DETERMINÍSTICAS sem keyword/NLP, sem IA. Geram frases
  // OBSERVACIONAIS (nunca "o sistema detectou"). A voz aqui é
  // editorial: descrevem uma sensação de quem leu os registros,
  // não uma análise algorítmica.
  //
  // Limita a 2 sinais visíveis pra evitar virar lista de relatório.
  // Em ausência de sinais, o bloco renderiza com "lugar reservado"
  // editorial (não esconde).
  type Sinal = { id: string; texto: React.ReactNode };
  const sinaisCalc: Sinal[] = [];

  // Sinal — Equilíbrio (≥2 conquistas E ≥2 desafios na semana)
  if (totalConquistas >= 2 && totalDesafios >= 2) {
    sinaisCalc.push({
      id: "equilibrio",
      texto: (
        <>
          Conquistas e desafios apareceram lado a lado — é assim que as
          semanas se misturam.
        </>
      ),
    });
  }

  // Sinal — Concentração de desafios (≥3 desafios em 7d, sem equilíbrio)
  if (totalDesafios >= 3 && totalConquistas < 2) {
    sinaisCalc.push({
      id: "concentracao-desafios",
      texto: <>A semana teve mais peso em alguns dias.</>,
    });
  }

  // Sinal — Presença recorrente (≥2 conquistas com mesma quem_estava)
  const conquistasPorQuem = new Map<string, number>();
  for (const c of conquistas ?? []) {
    const q = (c as { quem_estava?: string | null }).quem_estava;
    if (q && q !== "outro") {
      conquistasPorQuem.set(q, (conquistasPorQuem.get(q) || 0) + 1);
    }
  }
  const pessoaRecorrente = [...conquistasPorQuem.entries()].find(
    ([, count]) => count >= 2,
  );
  if (pessoaRecorrente) {
    const label = quemEstavaLabel(pessoaRecorrente[0]);
    if (label) {
      sinaisCalc.push({
        id: "presenca",
        texto: (
          <>
            Boa parte das conquistas aconteceu com {label} por perto.
          </>
        ),
      });
    }
  }

  // Sinal — Mãe leve (escala média ≥4 em 3+ checkins)
  const escalasValidas = (checkins7d ?? [])
    .map((c) => c.escala_emocional_mae)
    .filter((v): v is number => typeof v === "number");
  if (escalasValidas.length >= 3) {
    const media =
      escalasValidas.reduce((s, v) => s + v, 0) / escalasValidas.length;
    if (media >= 4) {
      sinaisCalc.push({
        id: "leveza",
        texto: (
          <>Os dias com mais leveza apareceram também nesta semana.</>
        ),
      });
    } else if (media < 3) {
      sinaisCalc.push({
        id: "cansaco",
        texto: (
          <>
            Foi uma semana que pesou no fim do dia também — faz parte.
          </>
        ),
      });
    }
  }

  const sinais = sinaisCalc.slice(0, 2);
  const sinaisTitulo = "Algumas situações começam a se repetir.";

  // Bloco editorial do Foco da semana — card próprio abaixo do hero.
  // Cada estado tem manchete (h3 ativo), texto interpretativo, 1-2 chips
  // categóricos pra ancorar visualmente, e CTA contextual.
  const focoContent: {
    manchete: string;
    texto: React.ReactNode;
    chips: { label: string; tone: ChipTone }[];
    ctaLabel: string;
    ctaHref: string;
  } =
    !houveAtividade
      ? // Estado vazio único, simples — sem variação por etapa.
        // Manchete varia minimamente; subtítulo é uma frase só.
        {
          manchete:
            idadeDias < 7
              ? "Os primeiros dias"
              : idadeDias < 14
                ? "Algumas coisas começam a aparecer"
                : "O dia a dia ficando mais claro",
          texto: (
            <>
              Uma observação por dia já ajuda a entender{" "}
              <strong className="font-semibold text-foreground">
                como a semana está sendo
              </strong>
              .
            </>
          ),
          chips: [{ label: "Dia a dia", tone: "foco" }],
          ctaLabel: idadeDias < 7 ? "Registrar primeira" : "Registrar dia",
          ctaHref: "/registrar/diario",
        }
      : totalConquistas > totalDesafios
        ? {
            manchete: "Vale manter o que ajudou",
            texto: (
              <>
                {primeiraCrianca?.nome ?? "Vocês"} mostrou algo novo essa
                semana. Vale{" "}
                <strong className="font-semibold text-foreground">
                  manter o que ajudou
                </strong>{" "}
                e seguir devagar — sem pressão por mais.
              </>
            ),
            chips: [
              { label: "Conquistas", tone: "social" },
              { label: "O que ajudou", tone: "rotina" },
            ],
            ctaLabel: "Ver estratégias",
            ctaHref: "/estrategias?tab=biblioteca",
          }
        : totalDesafios > totalConquistas
          ? {
              manchete: "Olhar pra frente sem se cobrar",
              texto: (
                <>
                  Foi uma semana que pesou. Reparar no que pegou mais não é
                  cobrança —{" "}
                  <strong className="font-semibold text-foreground">
                    é parte do cuidado
                  </strong>
                  . Vamos pensar nos próximos dias com calma.
                </>
              ),
              chips: [
                { label: "Acolhimento", tone: "emocao" },
                { label: "Cuidado", tone: "sensorial" },
              ],
              ctaLabel: "Ver estratégias",
              ctaHref: "/estrategias",
            }
          : {
              manchete: "Cada semana tem de tudo",
              texto: (
                <>
                  Conquistas e desafios apareceram lado a lado essa semana.{" "}
                  <strong className="font-semibold text-foreground">
                    Faz parte do dia a dia
                  </strong>{" "}
                  — continuar contando ajuda a ver tudo junto com o tempo.
                </>
              ),
              chips: [
                { label: "Equilíbrio", tone: "rotina" },
                { label: "Dia a dia", tone: "foco" },
              ],
              ctaLabel: "Ver estratégias",
              ctaHref: "/estrategias",
            };

  const mostrarSecundario = focoContent.ctaHref !== "/registrar/diario";

  return (
    <div className="flex flex-col gap-8">
      {/* ============================================================
       * TOPO — faixa fina de assinatura (só renderiza se status !== active).
       * Fica acima do greeting pra não intrudir na narrativa editorial.
       * Em maioria dos usuários (active), nem aparece.
       * ============================================================ */}
      <SubscriptionBanner
        status={subscription?.status}
        trialDaysLeft={trialDaysLeft}
      />

      {/* ============================================================
       * GREETING — data atual + saudação
       * ============================================================ */}
      <header>
        <Eyebrow>{format(hoje, "EEEE · d 'de' MMMM", { locale: ptBR })}</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Oi, {greeting}.
          {saudacaoClause && (
            <>
              {" "}
              <em className="not-italic text-brand-purple">{saudacaoClause}</em>
            </>
          )}
        </h1>
      </header>

      {/* ============================================================
       * AS 3 PORTAS — os jeitos de interagir com a Kolo: registrar o
       * dia, cuidar do retrato vivo (Kolo Vivo) e pedir um caminho
       * (Estratégias). Navegação principal do dia a dia.
       * ============================================================ */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            titulo: "Registro do dia",
            desc: "Conte como foi hoje.",
            href: "/registrar/diario",
            Icon: NotebookPen,
            chip: "bg-cat-rotina-bg text-cat-rotina",
            bar: "bg-cat-rotina",
            sinal:
              diasComRegistro > 0
                ? `${diasComRegistro} ${diasComRegistro === 1 ? "dia" : "dias"} essa semana`
                : "comece por aqui",
          },
          {
            titulo: "Kolo Vivo",
            desc: "O retrato vivo de quem vocês são.",
            href: "/kolo-vivo",
            Icon: Sprout,
            chip: "bg-cat-social-bg text-cat-social",
            bar: "bg-cat-social",
            sinal: koloVivoPct > 0 ? `${koloVivoPct}% preenchido` : "monte o retrato",
          },
          {
            titulo: "Estratégias",
            desc: "Conte um desafio, ache um caminho.",
            href: "/estrategias",
            Icon: Lightbulb,
            chip: "bg-cat-foco-bg text-cat-foco",
            bar: "bg-cat-foco",
            sinal: ultimaConversaTitulo
              ? `última: ${ultimaConversaTitulo.length > 30 ? `${ultimaConversaTitulo.slice(0, 30)}…` : ultimaConversaTitulo}`
              : "comece uma conversa",
          },
        ].map(({ titulo, desc, href, Icon, chip, bar, sinal }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-white p-5 pt-6 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]"
          >
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", bar)} />
            <span
              aria-hidden
              className={cn("flex size-11 items-center justify-center rounded-xl", chip)}
            >
              <Icon className="size-[22px]" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="font-heading text-lg font-medium text-foreground">{titulo}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
            <span className="mt-auto inline-flex w-fit max-w-full items-center truncate rounded-full bg-foreground/[0.04] px-2.5 py-1 text-xs font-medium text-foreground/70">
              {sinal}
            </span>
          </Link>
        ))}
      </section>

      {/* ============================================================
       * BANNER de gênero — discreto, aparece pra cada membro com
       * `genero IS NULL`. Sumiu quando responde. Acima do balão pq
       * é mais leve e dá contexto pra Ayla falar certo.
       * ============================================================ */}
      {(membros ?? [])
        .filter((m) => !m.genero)
        .map((m) => (
          <BannerGenero
            key={m.id as string}
            membroId={m.id as string}
            nomeMembro={m.nome as string}
          />
        ))}

      {/* ============================================================
       * BALÃO "Os primeiros passos" — aparece UMA vez, no primeiro
       * acesso ao painel. Marca visto ao fechar ou clicar num dos
       * dois destinos (Kolo Vivo / Estratégias). Some depois.
       * ============================================================ */}
      {!family!.painel_balao_visto_at && <BalaoPrimeirosPassos />}

      {/* ============================================================
       * FOCO DA SEMANA — card branco editorial, eyebrow com ícone
       * amarelo. Manchete h3 Fraunces, texto interpretativo, chips
       * categóricos (cores do design system), CTA contextual.
       * Migrado de dentro do hero pra dar identidade própria.
       * ============================================================ */}
      <section>
        <div className="relative overflow-hidden rounded-3xl bg-white px-6 py-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] md:px-8 md:py-8">
          <span
            aria-hidden
            className="absolute left-0 top-0 h-[3px] w-full bg-gradient-to-r from-brand-yellow via-brand-yellow/40 to-transparent"
          />
          <div className="inline-flex items-center gap-2.5">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand-yellow text-brand-purple-dark">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Foco da semana
            </span>
          </div>
          <h3 className="mt-3.5 font-heading text-2xl leading-snug text-foreground md:text-[26px]">
            {focoContent.manchete}
          </h3>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {focoContent.texto}
          </p>
          {focoContent.chips.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {focoContent.chips.map((chip) => (
                <FocoChip key={chip.label} {...chip} />
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={focoContent.ctaHref}
              className={cn(
                buttonVariants({ variant: "cta", size: "lg" }),
                "shadow-sm",
              )}
            >
              {focoContent.ctaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            {mostrarSecundario && (
              <Link
                href="/registrar/diario"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                Registrar dia
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
       * ESSA SEMANA — lista editorial humana, não dashboard.
       * Usa o TEXTO BRUTO das conquistas/desafios da família como
       * itens (já são observações escritas). Marca discreta ✓ / !
       * com fundo soft (não badge saturado). Em onboarding, frase
       * editorial central "esperando os primeiros registros".
       * ============================================================ */}
      <section>
        <div className="rounded-3xl bg-white px-6 py-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] md:px-8 md:py-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-brand-yellow/10 text-brand-yellow">
              <Star className="size-4" aria-hidden />
            </span>
            <h3 className="font-heading text-lg font-semibold text-foreground md:text-xl">
              O que vem acontecendo
            </h3>
          </div>
          {itensSemana.length === 0 ? (
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Os primeiros registros aparecem aqui.
            </p>
          ) : (
            <ul className="flex flex-col">
              {itensSemana.map((item, idx) => {
                const contexto = quemEstavaLabel(item.quemEstava);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3.5 py-3.5",
                      idx > 0 && "border-t border-foreground/[0.06]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-[7px] inline-flex w-3.5 shrink-0 font-mono text-sm font-semibold leading-none",
                        (MARK_SEMANA[item.tipo] ?? MARK_SEMANA.conquista).cls,
                      )}
                    >
                      {(MARK_SEMANA[item.tipo] ?? MARK_SEMANA.conquista).ch}
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-base leading-relaxed tracking-[-0.005em] text-foreground">
                        {item.texto}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
                        {diaCurto(item.data)}
                        {contexto && (
                          <>
                            <span className="mx-1.5 opacity-60">·</span>
                            {contexto}
                          </>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ============================================================
       * PEQUENAS CONQUISTAS (grid 3 cards temáticos)
       * Banners administrativos (Subscription, NPS, "Precisa atenção")
       * que ficavam aqui foram removidos no P6: subscription subiu
       * pra cima do greeting; NPS e avisos desceram pro rodapé.
       * ============================================================ */}
      <ConquistasGrid conquistas={conquistas ?? []} />

      {/* ============================================================
       * MOMENTOS QUE SE CONVERSAM (P5) — bloco roxo deep editorial.
       * Caderno noturno de observações. Frases geradas por REGRAS
       * DETERMINÍSTICAS (sinaisCalc acima) — nunca "sistema percebeu"
       * ou "IA notou". Voz observacional, descreve sensação de quem
       * leu os registros. Estado vazio: lugar reservado editorial.
       * ============================================================ */}
      {sinais.length > 0 && (
        <section
          className="relative overflow-hidden rounded-3xl px-7 py-9 text-white md:px-10 md:py-10"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-purple-deep) 0%, var(--brand-purple-dark) 100%)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(255,186,0,0.22) 0%, transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-3">
              <span aria-hidden className="h-[2px] w-7 rounded-full bg-brand-yellow" />
              <Eyebrow tone="dark" as="span">
                Momentos que se conversam
              </Eyebrow>
            </div>
            <h2 className="mt-4 max-w-xl font-heading text-2xl leading-snug text-white md:text-[26px]">
              {sinaisTitulo}
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
              Aos poucos, o dia a dia mostra o que precisa de mais cuidado.
            </p>
            <ul className="mt-5 grid gap-4 md:grid-cols-2 md:gap-5">
              {sinais.map((s) => (
                <li
                  key={s.id}
                  className="border-l-2 border-brand-yellow pl-4 text-[15px] leading-relaxed text-white/85"
                >
                  {s.texto}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============================================================
       * SUGESTÕES PRA REVISAR — só aparece quando há pendência real.
       * O card "Atualizar o Kolo Vivo" do estado vazio foi removido:
       * interrompia a narrativa emocional da Home como CTA admin.
       * Quem quer abrir o Kolo Vivo usa o menu lateral (rota dedicada).
       * ============================================================ */}
      {(sugestoesCount ?? 0) > 0 && (
        <section className="max-w-2xl">
          <Card className="rounded-3xl bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  Sugestões pra revisar
                </CardTitle>
                <CardDescription>
                  {sugestoesCount} item{sugestoesCount === 1 ? "" : "s"} esperando
                  você no Kolo Vivo.
                </CardDescription>
              </div>
              <Badge variant="secondary">{sugestoesCount}</Badge>
            </CardHeader>
            <CardContent>
              <Link
                href="/kolo-vivo"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Abrir Kolo Vivo
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ============================================================
       * AYLA NO WHATSAPP — última fala real da Ayla (espelha o ayla-ref
       * do protótipo). Traz a presença dela pra Home; só renderiza quando
       * existe mensagem. "Abrir" leva pra Estratégias (onde se conversa).
       * ============================================================ */}
      {ultimaAyla?.texto && (
        <section className="flex items-start gap-4 rounded-3xl bg-white px-5 py-5 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] md:px-6">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-purple font-heading text-sm font-semibold text-white"
          >
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Ayla · WhatsApp
              <span className="mx-1.5 opacity-60">·</span>
              <span className="font-semibold normal-case tracking-normal text-foreground/60">
                {format(new Date(ultimaAyla.created_at as string), "d 'de' MMM", {
                  locale: ptBR,
                })}
              </span>
            </p>
            <p className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-foreground/90">
              {ultimaAyla.texto}
            </p>
          </div>
          <Link
            href="/estrategias"
            className="mt-0.5 inline-flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-brand-purple underline-offset-4 transition-all hover:gap-2"
          >
            Abrir
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </section>
      )}

      {/* ============================================================
       * RODAPÉ ADMINISTRATIVO — discreto, fora da narrativa editorial.
       * NPS (se elegível) + avisos pendentes (se houver). Quem não tem
       * NPS pendente nem avisos abertos não vê nada aqui.
       * ============================================================ */}
      {((alertasOpen?.length ?? 0) > 0 ||
        (adaptacoesPendentesCount ?? 0) > 0) && (
        <section className="border-t border-foreground/[0.06] pt-6">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Precisa de atenção
          </h4>
          <ul className="flex flex-col gap-2.5 text-sm">
            {(alertasOpen ?? []).slice(0, 3).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-2.5 text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-purple/40"
                />
                <span className="leading-relaxed">{a.mensagem}</span>
              </li>
            ))}
            {(adaptacoesPendentesCount ?? 0) > 0 && (
              <li className="flex items-start gap-2.5 text-muted-foreground">
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-purple/40"
                />
                <span className="leading-relaxed">
                  {adaptacoesPendentesCount} sugestão
                  {adaptacoesPendentesCount === 1 ? "" : "ões"} do Kolo Vivo
                  pra revisar.{" "}
                  <Link
                    href="/configuracoes/regras"
                    className="font-semibold text-brand-purple hover:underline"
                  >
                    Abrir →
                  </Link>
                </span>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

// ============================================================
// Conquistas grid — 3 cards temáticos
// ============================================================

type ConquistaDiario = {
  id: string;
  data: string;
  conquista: string | null;
  observacao_livre: string | null;
  membros_atipicos: { nome: string } | { nome: string }[] | null;
};

// Tons decorativos rotativos por POSIÇÃO no grid — não representam
// categoria semântica do conteúdo (diários não têm domain no schema).
// Cada conquista recebe faixa + chip de ícone + blur conforme a posição,
// criando atmosfera editorial (peso do protótipo) sem inventar categoria.
// Classes literais pro Tailwind v4 extrair em build.
const CARD_TONES = [
  { blur: "var(--cat-alimentacao)", bar: "bg-cat-alimentacao", chip: "bg-cat-alimentacao-soft text-cat-alimentacao" },
  { blur: "var(--cat-comunicacao)", bar: "bg-cat-comunicacao", chip: "bg-cat-comunicacao-soft text-cat-comunicacao" },
  { blur: "var(--cat-motor)", bar: "bg-cat-motor", chip: "bg-cat-motor-soft text-cat-motor" },
];

// Frases editoriais pros ghost cards — NÃO simulam conquista (sem data,
// sem nome, sem observação). Texto é claramente meta ("aparece aqui"),
// pra usuário entender que é lugar reservado, não dado fictício.
const GHOST_PHRASES = [
  "Algumas pequenas conquistas aparecem aqui.",
  "Coisas do dia a dia que merecem ser lembradas.",
  "Um momento que voltou a acontecer — e por isso importa.",
];

function ConquistasGrid({ conquistas }: { conquistas: ConquistaDiario[] }) {
  // 3 slots fixos: preenche com conquistas reais, completa com ghost cards.
  // Sempre renderiza a seção — em onboarding, os ghosts criam sensação de
  // "lugar reservado", não "produto sem dados".
  const slots: (ConquistaDiario | null)[] = Array.from(
    { length: 3 },
    (_, i) => conquistas[i] ?? null,
  );
  const houveConquistas = conquistas.length > 0;

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-foreground">
          Pequenas <em className="not-italic text-brand-purple">conquistas</em>
        </h2>
        {houveConquistas && (
          <Link
            href="/evolucao"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple transition-all hover:gap-2"
          >
            Linha do tempo
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((c, i) =>
          c ? (
            <ConquistaCard key={c.id} c={c} pos={i} />
          ) : (
            <GhostCard key={`ghost-${i}`} pos={i} />
          ),
        )}
      </div>
    </section>
  );
}

function ConquistaCard({
  c,
  pos,
}: {
  c: ConquistaDiario;
  pos: number;
}) {
  const nomeMembro = Array.isArray(c.membros_atipicos)
    ? c.membros_atipicos[0]?.nome
    : c.membros_atipicos?.nome;
  const tone = CARD_TONES[pos % CARD_TONES.length];

  return (
    <article className="relative overflow-hidden rounded-3xl bg-white px-6 pb-6 pt-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_4px_12px_rgba(46,10,82,0.03)] transition-shadow hover:shadow-[0_4px_12px_rgba(46,10,82,0.06),_0_12px_28px_rgba(46,10,82,0.06)]">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", tone.bar)} />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full opacity-40 blur-2xl"
        style={{ background: tone.blur }}
      />
      <div className="relative">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl",
            tone.chip,
          )}
        >
          <Sparkles className="size-[18px]" strokeWidth={1.8} />
        </span>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {format(new Date(c.data), "d 'de' MMM", { locale: ptBR })}
          {nomeMembro && (
            <>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="font-semibold normal-case tracking-normal text-foreground/70">
                {nomeMembro}
              </span>
            </>
          )}
        </p>
        <h3 className="mt-2 font-heading text-lg font-medium leading-snug text-foreground md:text-xl">
          {c.conquista}
        </h3>
        {c.observacao_livre && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {c.observacao_livre}
          </p>
        )}
      </div>
    </article>
  );
}

function GhostCard({ pos }: { pos: number }) {
  const text = GHOST_PHRASES[pos % GHOST_PHRASES.length];
  return (
    <article
      aria-hidden
      className="relative overflow-hidden rounded-3xl border border-dashed border-foreground/[0.08] bg-white/40 px-6 py-6"
    >
      <div className="flex min-h-[120px] items-center">
        <p className="text-sm leading-relaxed text-muted-foreground/70">
          {text}
        </p>
      </div>
    </article>
  );
}

// ============================================================
// SubscriptionBanner — mantém do anterior (lógica funcional)
// ============================================================

function SubscriptionBanner({
  status,
  trialDaysLeft,
}: {
  status: string | undefined;
  trialDaysLeft: number | null;
}) {
  if (status === "active") return null;

  if (status === "trialing" && trialDaysLeft !== null) {
    const urgente = trialDaysLeft <= 3;
    return (
      <BannerLayout
        tone={urgente ? "warning" : "neutral"}
        cta={trialDaysLeft <= 7 ? "Assinar agora" : "Ver assinatura"}
      >
        {trialDaysLeft > 0
          ? `Faltam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} dos seus 30 dias grátis.`
          : "Seu trial termina hoje."}
      </BannerLayout>
    );
  }

  if (status === "past_due") {
    return (
      <BannerLayout tone="destructive" cta="Atualizar pagamento">
        Pagamento pendente. Regularize para manter tudo ativo.
      </BannerLayout>
    );
  }

  if (status === "paused") {
    return (
      <BannerLayout tone="warning" cta="Reativar">
        Sua assinatura está pausada. Histórico preservado — reative quando
        quiser.
      </BannerLayout>
    );
  }

  if (status === "canceled") {
    return (
      <BannerLayout tone="warning" cta="Reativar">
        Sua assinatura foi cancelada. Reative pra continuar usando.
      </BannerLayout>
    );
  }

  return null;
}

function BannerLayout({
  tone,
  cta,
  children,
}: {
  tone: "neutral" | "warning" | "destructive";
  cta: string;
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "destructive"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-brand-yellow/40 bg-brand-yellow/10 text-brand-purple-dark"
        : "border-kolo-linha bg-kolo-lilas-bg-2";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-full border px-4 py-2 text-xs md:text-sm",
        toneCls,
      )}
    >
      <span className="leading-snug">{children}</span>
      <Link
        href="/assinatura"
        className="text-xs font-semibold underline-offset-4 hover:underline md:text-sm"
      >
        {cta} →
      </Link>
    </div>
  );
}

