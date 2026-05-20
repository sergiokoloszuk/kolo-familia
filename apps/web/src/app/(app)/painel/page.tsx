import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
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

  // Bloco editorial único — absorve a interpretação rica do antigo FOCO DA SEMANA.
  // Texto em JSX porque tem ênfases. CTA primário contextual; secundário "Registrar
  // dia" só aparece quando o primário não vai pra lá (pra não duplicar).
  const focoContent =
    !houveAtividade
      ? {
          texto: (
            <>
              Pequenas observações vão virando{" "}
              <strong className="font-semibold text-foreground">
                contexto
              </strong>{" "}
              com o tempo. Uma frase por dia já conta como leitura.
            </>
          ),
          ctaLabel: "Registrar primeira",
          ctaHref: "/registrar/diario",
        }
      : totalConquistas > totalDesafios
        ? {
            texto: (
              <>
                {primeiraCrianca?.nome ?? "Vocês"} mostrou algo novo. Vale{" "}
                <strong className="font-semibold text-foreground">
                  manter o contexto que ajudou
                </strong>{" "}
                e seguir devagar — sem pressão pra render mais.
              </>
            ),
            ctaLabel: "Ver estratégias",
            ctaHref: "/estrategias?tab=biblioteca",
          }
        : totalDesafios > totalConquistas
          ? {
              texto: (
                <>
                  Foi uma semana com peso. Identificar o que disparou é{" "}
                  <strong className="font-semibold text-foreground">
                    leitura, não falha
                  </strong>
                  . Vamos pensar na próxima vez sem revisar a passada.
                </>
              ),
              ctaLabel: "Pedir estratégia",
              ctaHref: "/estrategias",
            }
          : {
              texto: (
                <>
                  Conquistas e desafios convivem — é assim que o desenvolvimento
                  acontece. Continuar registrando{" "}
                  <strong className="font-semibold text-foreground">
                    conta a história
                  </strong>{" "}
                  no longo prazo.
                </>
              ),
              ctaLabel: "Ver estratégias",
              ctaHref: "/estrategias",
            };

  const mostrarSecundario = focoContent.ctaHref !== "/registrar/diario";

  return (
    <div className="flex flex-col gap-8">
      {/* ============================================================
       * GREETING — data atual + saudação
       * ============================================================ */}
      <header>
        <Eyebrow>{format(hoje, "EEEE · d 'de' MMMM", { locale: ptBR })}</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          Oi, {greeting}.{" "}
          <em className="not-italic text-brand-purple">
            Essa semana {statusSemana}
          </em>
          .
        </h1>
      </header>

      {/* ============================================================
       * HERO CONTEXTUAL — leitura da semana (lilás com profundidade)
       * Hero dominante: 3 radials sobrepostos + vignette inset bottom
       * pra atmosfera editorial sem inflar.
       * ============================================================ */}
      <section
        className="relative mb-4 overflow-hidden rounded-3xl px-6 py-10 md:mb-6 md:px-10 md:py-12"
        style={{
          background:
            "radial-gradient(circle at 90% 8%, rgba(255,186,0,0.22) 0%, transparent 55%), radial-gradient(circle at 8% 88%, rgba(107,31,168,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 110%, rgba(46,10,82,0.06) 0%, transparent 60%), linear-gradient(135deg, var(--kolo-lilas-bg) 0%, var(--kolo-creme) 100%)",
          boxShadow: "inset 0 -1px 0 rgba(46,10,82,0.04)",
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
            {houveAtividade ? "Vimos sua semana" : "Começando a leitura"}
          </span>
          <h2 className="mt-4 font-heading text-3xl leading-[1.15] text-foreground md:text-4xl">
            {!houveAtividade ? (
              <>
                Os primeiros registros começam a{" "}
                <span
                  className="inline-block px-1"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 60%, rgba(255,186,0,0.42) 60%)",
                  }}
                >
                  desenhar padrões
                </span>
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
          <p className="mt-3 max-w-xl text-muted-foreground">
            {focoContent.texto}
          </p>

          {/* Strip de métricas inline — anotação editorial, não dashboard. */}
          {houveAtividade && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground md:text-sm">
              {totalConquistas > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-flex size-4 items-center justify-center rounded-full bg-cat-social-bg text-[10px] font-bold text-cat-social"
                  >
                    ✓
                  </span>
                  <strong className="font-semibold text-foreground">
                    {totalConquistas}
                  </strong>
                  conquista{totalConquistas === 1 ? "" : "s"}
                </span>
              )}
              {totalDesafios > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-flex size-4 items-center justify-center rounded-full bg-cat-sensorial-bg text-[10px] font-bold text-cat-sensorial"
                  >
                    !
                  </span>
                  <strong className="font-semibold text-foreground">
                    {totalDesafios}
                  </strong>
                  desafio{totalDesafios === 1 ? "" : "s"}
                </span>
              )}
              {totalCheckins > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-flex size-4 items-center justify-center rounded-full bg-cat-social-bg text-[10px] font-bold text-cat-social"
                  >
                    ✓
                  </span>
                  <strong className="font-semibold text-foreground">
                    {totalCheckins}
                  </strong>
                  check-in{totalCheckins === 1 ? "" : "s"}
                </span>
              )}
              <span>
                em{" "}
                <strong className="font-semibold text-foreground">
                  {diasComRegistro}
                </strong>{" "}
                dia{diasComRegistro === 1 ? "" : "s"} dos últimos 7
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3 md:mt-6">
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
       * PEQUENAS CONQUISTAS (grid 3 cards temáticos)
       * ============================================================ */}
      <ConquistasGrid conquistas={conquistas ?? []} />

      {/* ============================================================
       * SUGESTÕES — coluna única, largura comportada
       * (WhatsApp card removido — sem mensagem estilo chatbot na Home)
       * ============================================================ */}
      <section className="max-w-2xl">
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
      </section>

      {/* ============================================================
       * CHECK-IN LEVE — convite suave (fechamento editorial sobre a mãe)
       * Silêncio antes do fechamento — ritmo assimétrico.
       * ============================================================ */}
      <section
        className="mt-4 flex flex-col items-start justify-between gap-4 rounded-3xl px-6 py-5 md:mt-6 md:flex-row md:items-center md:px-8 md:py-6"
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

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-foreground">
          Pequenas <em className="not-italic text-brand-purple">conquistas</em>
        </h2>
        <Link
          href="/evolucao"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-purple transition-all hover:gap-2"
        >
          Linha do tempo
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {/* Timeline editorial — barra amarela à esquerda, marcas pequenas.
          Sem cards, sem palette categórica — leitura como diário. */}
      <ol className="relative ml-1 flex flex-col gap-5 border-l-2 border-brand-yellow/30 pl-6">
        {conquistas.slice(0, 3).map((c) => {
          const nomeMembro = Array.isArray(c.membros_atipicos)
            ? c.membros_atipicos[0]?.nome
            : c.membros_atipicos?.nome;
          return (
            <li key={c.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[1.625rem] top-2 size-2.5 rounded-full bg-brand-yellow ring-4 ring-kolo-page"
              />
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {format(new Date(c.data), "d 'de' MMM", { locale: ptBR })}
                {nomeMembro && (
                  <>
                    {" · "}
                    <span className="text-foreground/70">{nomeMembro}</span>
                  </>
                )}
              </p>
              <h3 className="mt-1 font-heading text-lg font-medium leading-snug text-foreground">
                {c.conquista}
              </h3>
              {c.observacao_livre && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {c.observacao_livre}
                </p>
              )}
            </li>
          );
        })}
      </ol>
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

