import Link from "next/link";
import { differenceInCalendarDays, format, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";
import { NpsBanner } from "./nps-banner";

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
    { data: ultimaMensagemWhatsApp },
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
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true),
    supabase
      .from("diarios")
      .select(
        "id, data, conquista, observacao_livre, membro_atipico_id, membros_atipicos(nome)",
      )
      .eq("family_account_id", familyId)
      .not("conquista", "is", null)
      .gte("data", seteDiasAtras)
      .order("data", { ascending: false })
      .limit(3),
    supabase
      .from("diarios")
      .select("id, data, desafio")
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
      .from("ayla_messages")
      .select("texto, tipo, category, created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .eq("category", "proativa")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const greeting =
    profile?.como_chamar?.trim() ||
    profile?.nome_mae?.trim() ||
    user.email?.split("@")[0] ||
    "Você";
  const primeiraCrianca = membros?.[0];

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
    { data: ultimoFeedback },
    { data: alertasOpen },
    { count: adaptacoesPendentesCount },
  ] = await Promise.all([
    supabase
      .from("family_accounts")
      .select("created_at")
      .eq("id", familyId)
      .single(),
    supabase
      .from("feedback_beta")
      .select("created_at")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  ]);
  const agora = Date.now();
  const idadeDias = familyMeta
    ? Math.floor(
        (agora - new Date(familyMeta.created_at as string).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : 0;
  const ultimoFeedbackDias = ultimoFeedback
    ? Math.floor(
        (agora - new Date(ultimoFeedback.created_at as string).getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;
  const npsElegivel =
    idadeDias >= 7 &&
    (ultimoFeedbackDias == null || ultimoFeedbackDias >= 60);
  const npsContexto: "d7" | "d30" | "manual" =
    idadeDias < 30 ? "d7" : "d30";

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

  const statusSemana = !houveAtividade
    ? "começou agora"
    : totalConquistas >= 2 && totalConquistas > totalDesafios
      ? "foi boa"
      : totalDesafios >= 2 && totalDesafios > totalConquistas
        ? "teve desafios"
        : "teve de tudo";

  const heroTexto = !houveAtividade
    ? `Comece registrando como ${primeiraCrianca ? "vocês estão" : "tá sendo"} a semana — ajuda a perceber padrões depois.`
    : totalConquistas >= 2 && totalConquistas > totalDesafios
      ? `Várias conquistas registradas. Vale celebrar discreto e tentar manter os contextos que ajudaram.`
      : totalDesafios >= 2 && totalDesafios > totalConquistas
        ? `Foi uma semana com peso. Lembra: identificar gatilho não é culpa, é leitura.`
        : `Registros chegaram. Devagar e firme — é assim que se enxerga o padrão da fase.`;

  return (
    <div className="flex flex-col gap-8">
      {/* ============================================================
       * GREETING — data atual + saudação
       * ============================================================ */}
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {format(hoje, "EEEE · d 'de' MMMM", { locale: ptBR })}
        </p>
        <h1 className="mt-2 font-heading text-3xl text-foreground md:text-4xl">
          Oi, {greeting}.{" "}
          <em className="not-italic text-brand-purple">
            Essa semana {statusSemana}
          </em>
          .
        </h1>
      </header>

      {/* ============================================================
       * HERO CONTEXTUAL — janela da semana (lilás com toques amarelos)
       * ============================================================ */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-8 md:px-10 md:py-10"
        style={{
          background:
            "radial-gradient(circle at 90% 10%, rgba(255,186,0,0.18) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(107,31,168,0.06) 0%, transparent 50%), linear-gradient(135deg, var(--kolo-lilas-bg) 0%, var(--kolo-creme) 100%)",
        }}
      >
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <span
              aria-hidden
              className="relative flex size-2 items-center justify-center"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-yellow opacity-50" />
              <span className="relative size-2 rounded-full bg-brand-yellow" />
            </span>
            Vimos sua semana
          </span>
          <h2 className="mt-4 font-heading text-2xl text-foreground md:text-3xl">
            {!houveAtividade ? (
              <>
                Painel ainda vazio —{" "}
                <em className="not-italic text-brand-purple">vai encher</em>{" "}
                com pouca coisa registrada
              </>
            ) : totalConquistas > totalDesafios ? (
              <>
                {primeiraCrianca?.nome ?? "Vocês"} teve{" "}
                <span
                  className="inline-block px-1"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 60%, rgba(255,186,0,0.42) 60%)",
                  }}
                >
                  {totalConquistas} conquista{totalConquistas === 1 ? "" : "s"}
                </span>{" "}
                nos últimos 7 dias
              </>
            ) : (
              <>
                Foram{" "}
                <span
                  className="inline-block px-1"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 60%, rgba(255,186,0,0.42) 60%)",
                  }}
                >
                  {diasComRegistro} dia{diasComRegistro === 1 ? "" : "s"}
                </span>{" "}
                com registros — e isso já conta
              </>
            )}
            <span aria-hidden className="text-brand-yellow">
              .
            </span>
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">{heroTexto}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/estrategias"
              className={cn(
                buttonVariants({ variant: "cta", size: "lg" }),
                "shadow-sm",
              )}
            >
              Pedir uma estratégia
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/registrar/diario"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
              )}
            >
              Registrar dia
            </Link>
          </div>
        </div>
      </section>

      {/* Banners funcionais — mantidos da versão anterior */}
      <SubscriptionBanner
        status={subscription?.status}
        trialDaysLeft={trialDaysLeft}
      />

      {npsElegivel && <NpsBanner contexto={npsContexto} />}

      {((alertasOpen?.length ?? 0) > 0 ||
        (adaptacoesPendentesCount ?? 0) > 0) && (
        <Card className="rounded-3xl border-brand-yellow/40 bg-brand-yellow/5">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Precisa da sua atenção
              </CardTitle>
              <CardDescription>
                {(alertasOpen?.length ?? 0) > 0 &&
                  `${alertasOpen!.length} alerta(s)`}
                {(alertasOpen?.length ?? 0) > 0 &&
                  (adaptacoesPendentesCount ?? 0) > 0 &&
                  " · "}
                {(adaptacoesPendentesCount ?? 0) > 0 &&
                  `${adaptacoesPendentesCount} sugestão(ões) pra revisar`}
              </CardDescription>
            </div>
            <Link
              href="/configuracoes/regras"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Abrir
            </Link>
          </CardHeader>
          {(alertasOpen?.length ?? 0) > 0 && (
            <CardContent className="text-sm">
              <ul className="flex flex-col gap-1.5">
                {(alertasOpen ?? []).slice(0, 3).map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <Badge
                      variant={
                        a.severidade === "high"
                          ? "destructive"
                          : a.severidade === "warn"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {a.severidade}
                    </Badge>
                    <span className="text-muted-foreground">{a.mensagem}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* ============================================================
       * FOCO DA SEMANA + ESSA SEMANA (grid 2 colunas)
       * ============================================================ */}
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <FocoSemana
          temConquistas={totalConquistas > 0}
          temDesafios={totalDesafios > 0}
          nomeCrianca={primeiraCrianca?.nome}
        />
        <EssaSemana
          conquistas={totalConquistas}
          desafios={totalDesafios}
          checkins={totalCheckins}
          diasComRegistro={diasComRegistro}
        />
      </section>

      {/* ============================================================
       * PEQUENAS CONQUISTAS (grid 3 cards temáticos)
       * ============================================================ */}
      <ConquistasGrid conquistas={conquistas ?? []} />

      {/* ============================================================
       * SUGESTÕES + MENSAGEM WHATSAPP (grid)
       * ============================================================ */}
      <section className="grid gap-4 md:grid-cols-2">
        {(sugestoesCount ?? 0) > 0 ? (
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
        ) : (
          <Card className="rounded-3xl bg-kolo-lilas-bg-2 border-0">
            <CardHeader>
              <CardTitle className="text-base">
                Atualizar o Kolo Vivo
              </CardTitle>
              <CardDescription>
                Mais contexto = melhores estratégias na hora da dúvida.
              </CardDescription>
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
        )}

        {ultimaMensagemWhatsApp?.texto && (
          <Card className="rounded-3xl border-l-4 border-brand-yellow bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  Sua última mensagem no WhatsApp
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  WhatsApp
                </Badge>
              </div>
              <CardDescription>
                {formatRelative(
                  new Date(ultimaMensagemWhatsApp.created_at),
                  hoje,
                  { locale: ptBR },
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm italic text-foreground/85">
                “{ultimaMensagemWhatsApp.texto}”
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ============================================================
       * CHECK-IN LEVE — convite suave
       * ============================================================ */}
      <section
        className="flex flex-col items-start justify-between gap-4 rounded-3xl px-6 py-5 md:flex-row md:items-center md:px-8 md:py-6"
        style={{
          background:
            "linear-gradient(135deg, var(--cat-sensorial-soft) 0%, #FFF9E6 100%)",
        }}
      >
        <p className="text-sm text-foreground md:text-base">
          E você,{" "}
          <strong className="font-bold text-brand-purple-dark">
            como tá hoje
          </strong>
          ? Um toque rápido — fica só entre vocês.
        </p>
        <Link
          href="/registrar/diario"
          className={cn(buttonVariants({ variant: "cta", size: "lg" }))}
        >
          Contar
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

// ============================================================
// Foco da semana — card branco, conteúdo adaptativo
// ============================================================

function FocoSemana({
  temConquistas,
  temDesafios,
  nomeCrianca,
}: {
  temConquistas: boolean;
  temDesafios: boolean;
  nomeCrianca?: string;
}) {
  const nome = nomeCrianca ?? "vocês";

  const conteudo =
    !temConquistas && !temDesafios
      ? {
          titulo: (
            <>
              Comece pelo{" "}
              <em className="not-italic text-brand-purple">registro do dia</em>
            </>
          ),
          texto: (
            <>
              Um minuto de registro hoje vira <strong>padrão observável</strong>{" "}
              em 2 semanas. Não precisa ser longo — uma frase já conta.
            </>
          ),
          chips: [
            { label: "Sem cobrança", cor: "neutro" as const },
            { label: "1 minuto", cor: "neutro" as const },
          ],
          cta: { label: "Registrar agora", href: "/registrar/diario" },
        }
      : temConquistas && !temDesafios
        ? {
            titulo: (
              <>
                Aproveitar a{" "}
                <em className="not-italic text-brand-purple">janela boa</em>{" "}
                sem fechar a porta
              </>
            ),
            texto: (
              <>
                {nome} mostrou algo novo. Vale{" "}
                <strong>manter o contexto que ajudou</strong> e seguir devagar
                — sem pressão pra "render" mais.
              </>
            ),
            chips: [
              { label: "Conquista", cor: "amarela" as const },
              { label: "Sem pressão", cor: "neutro" as const },
            ],
            cta: { label: "Ver estratégias", href: "/estrategias?tab=biblioteca" },
          }
        : temDesafios && !temConquistas
          ? {
              titulo: (
                <>
                  Identificar gatilho{" "}
                  <em className="not-italic text-brand-purple">não é culpa</em>
                </>
              ),
              texto: (
                <>
                  Foi uma semana com peso. Identificar o que disparou é{" "}
                  <strong>leitura, não falha</strong>. Vamos pensar na próxima
                  vez sem revisar a passada.
                </>
              ),
              chips: [
                { label: "Sem culpa", cor: "neutro" as const },
                { label: "Olhar pra frente", cor: "amarela" as const },
              ],
              cta: { label: "Conversar", href: "/estrategias" },
            }
          : {
              titulo: (
                <>
                  Continuidade <em className="not-italic text-brand-purple">é o que conta</em>
                </>
              ),
              texto: (
                <>
                  Conquistas e desafios convivem — é assim que o desenvolvimento
                  acontece. Continuar registrando <strong>conta a história</strong>{" "}
                  no longo prazo.
                </>
              ),
              chips: [
                { label: "Mistura natural", cor: "neutro" as const },
                { label: "Longo prazo", cor: "neutro" as const },
              ],
              cta: { label: "Ver estratégias", href: "/estrategias" },
            };

  return (
    <Card className="relative rounded-3xl bg-white before:absolute before:left-0 before:right-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-brand-yellow before:to-transparent">
      <CardHeader>
        <div className="mb-2 inline-flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-md bg-brand-yellow text-brand-purple-dark"
          >
            <Sparkles className="size-3.5 stroke-[2.4]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Foco da semana
          </span>
        </div>
        <CardTitle className="font-heading text-xl leading-snug md:text-2xl">
          {conteudo.titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground md:text-base">
          {conteudo.texto}
        </p>
        <div className="flex flex-wrap gap-2">
          {conteudo.chips.map((c) => (
            <span
              key={c.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                c.cor === "amarela"
                  ? "bg-brand-yellow/15 text-brand-purple-dark"
                  : "bg-kolo-lilas-bg-2 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  c.cor === "amarela" ? "bg-brand-yellow" : "bg-muted-foreground",
                )}
              />
              {c.label}
            </span>
          ))}
        </div>
        <Link
          href={conteudo.cta.href}
          className={cn(
            buttonVariants({ size: "sm" }),
            "w-fit gap-2",
          )}
        >
          {conteudo.cta.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Essa semana — card branco, lista de marcas
// ============================================================

function EssaSemana({
  conquistas,
  desafios,
  checkins,
  diasComRegistro,
}: {
  conquistas: number;
  desafios: number;
  checkins: number;
  diasComRegistro: number;
}) {
  const items: Array<{ tipo: "ok" | "alerta" | "neutro"; texto: React.ReactNode }> =
    [];

  if (conquistas > 0) {
    items.push({
      tipo: "ok",
      texto: (
        <>
          <strong>{conquistas}</strong>{" "}
          conquista{conquistas === 1 ? "" : "s"} registrada{conquistas === 1 ? "" : "s"}
        </>
      ),
    });
  }
  if (desafios > 0) {
    items.push({
      tipo: "alerta",
      texto: (
        <>
          <strong>{desafios}</strong> desafio
          {desafios === 1 ? "" : "s"} anotado{desafios === 1 ? "" : "s"}
        </>
      ),
    });
  }
  if (checkins > 0) {
    items.push({
      tipo: "ok",
      texto: (
        <>
          <strong>{checkins}</strong> check-in{checkins === 1 ? "" : "s"} emocional
          {checkins === 1 ? "" : "is"}
        </>
      ),
    });
  }
  items.push({
    tipo: "neutro",
    texto: (
      <>
        <strong>{diasComRegistro}</strong> dia{diasComRegistro === 1 ? "" : "s"} com
        registro nos últimos 7
      </>
    ),
  });

  return (
    <Card className="rounded-3xl bg-white">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-yellow/15 text-brand-yellow-dark"
          >
            <Star className="size-4 stroke-[1.8]" />
          </span>
          <CardTitle className="text-base">Essa semana</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-snug">
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  item.tipo === "ok" &&
                    "bg-cat-social-bg text-cat-social",
                  item.tipo === "alerta" &&
                    "bg-cat-sensorial-bg text-cat-sensorial",
                  item.tipo === "neutro" &&
                    "bg-kolo-lilas-bg-2 text-muted-foreground",
                )}
              >
                {item.tipo === "ok" ? "✓" : item.tipo === "alerta" ? "!" : "·"}
              </span>
              <span className="text-foreground">{item.texto}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
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

function ConquistasGrid({ conquistas }: { conquistas: ConquistaDiario[] }) {
  if (conquistas.length === 0) {
    return null;
  }

  // Rotação de paleta temática
  const paletas = [
    { bgGradient: "from-cat-alimentacao to-cat-alimentacao", bg: "bg-cat-alimentacao-soft", color: "text-cat-alimentacao", iconBg: "bg-cat-alimentacao-bg" },
    { bgGradient: "from-cat-comunicacao to-cat-comunicacao", bg: "bg-cat-comunicacao-soft", color: "text-cat-comunicacao", iconBg: "bg-cat-comunicacao-bg" },
    { bgGradient: "from-cat-motor to-cat-motor", bg: "bg-cat-motor-soft", color: "text-cat-motor", iconBg: "bg-cat-motor-bg" },
  ];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-foreground">
          Pequenas <em className="not-italic text-brand-purple">conquistas</em>
        </h2>
        <Link
          href="/evolucao"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple hover:gap-2 transition-all"
        >
          Linha do tempo
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {conquistas.slice(0, 3).map((c, i) => {
          const paleta = paletas[i % paletas.length];
          const nomeMembro = Array.isArray(c.membros_atipicos)
            ? c.membros_atipicos[0]?.nome
            : c.membros_atipicos?.nome;
          return (
            <article
              key={c.id}
              className={cn(
                "relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-25 blur-2xl",
                  paleta.bg,
                )}
              />
              <div className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-11 items-center justify-center rounded-2xl",
                    paleta.iconBg,
                    paleta.color,
                  )}
                >
                  <Sparkles className="size-5 stroke-[1.8]" />
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {format(new Date(c.data), "d 'de' MMM", { locale: ptBR })}
                  {nomeMembro && ` · ${nomeMembro}`}
                </p>
                <h3 className="mt-1 font-heading text-base font-semibold leading-snug text-foreground">
                  {c.conquista}
                </h3>
                {c.observacao_livre && (
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                    {c.observacao_livre}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
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
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm",
        toneCls,
      )}
    >
      <span>{children}</span>
      <Link
        href="/assinatura"
        className={cn(
          buttonVariants({
            size: "sm",
            variant: tone === "neutral" ? "outline" : "default",
          }),
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

