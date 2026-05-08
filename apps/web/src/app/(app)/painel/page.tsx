import Link from "next/link";
import { differenceInCalendarDays, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

export default async function PainelPage() {
  const { user, supabase, family } = await loadFamilyContext();
  // Layout (app) garante family + onboarding completos.
  const familyId = family!.id;

  const [
    { data: profile },
    { data: subscription },
    { data: membros },
    { data: ultimasConquistas },
    { data: ultimosDesafios },
    { data: ultimosCheckins },
    { count: sugestoesCount },
    { data: ultimaMensagemAyla },
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
      .select("id, data, conquista, membro_atipico_id, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .not("conquista", "is", null)
      .order("data", { ascending: false })
      .limit(3),
    supabase
      .from("diarios")
      .select("id, data, desafio, membro_atipico_id, membros_atipicos(nome)")
      .eq("family_account_id", familyId)
      .not("desafio", "is", null)
      .order("data", { ascending: false })
      .limit(3),
    supabase
      .from("check_ins_diarios")
      .select("id, data, escala_emocional_mae")
      .eq("family_account_id", familyId)
      .order("data", { ascending: false })
      .limit(3),
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

  const greeting = profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || user.email;
  const trialDaysLeft =
    subscription?.status === "trialing" && subscription.trial_ends_at
      ? Math.max(0, differenceInCalendarDays(new Date(subscription.trial_ends_at), new Date()))
      : null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Oi, {greeting}.</h1>
        <p className="text-sm text-muted-foreground">
          {membros && membros.length > 0
            ? membros.length === 1
              ? `Acompanhando ${membros[0].nome}.`
              : `Acompanhando ${membros.length} pessoas atípicas.`
            : "Painel inicial."}
        </p>
      </header>

      <SubscriptionBanner status={subscription?.status} trialDaysLeft={trialDaysLeft} />

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas conquistas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <DiarioList
              rows={ultimasConquistas as DiarioRow[] | null}
              field="conquista"
              empty="Nenhuma conquista registrada ainda."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos desafios</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <DiarioList
              rows={ultimosDesafios as DiarioRow[] | null}
              field="desafio"
              empty="Nenhum desafio registrado ainda."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Como você está</CardTitle>
              <CardDescription>Últimos 3 dias</CardDescription>
            </div>
            <Link
              href="/registrar/diario"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Registrar
            </Link>
          </CardHeader>
          <CardContent className="text-sm">
            {ultimosCheckins && ultimosCheckins.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {ultimosCheckins.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {formatRelative(new Date(c.data), new Date(), { locale: ptBR })}
                    </span>
                    <span>{labelEmocional(c.escala_emocional_mae)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                Sem check-ins ainda. Você pode registrar agora ou esperar a Ayla.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Sugestões pendentes</CardTitle>
              <CardDescription>
                {sugestoesCount && sugestoesCount > 0
                  ? `${sugestoesCount} para revisar no Kolo Vivo.`
                  : "Nada esperando você."}
              </CardDescription>
            </div>
            {sugestoesCount && sugestoesCount > 0 ? (
              <Badge variant="secondary">{sugestoesCount}</Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            <Link
              href="/kolo-vivo"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Abrir Kolo Vivo
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ayla diz</CardTitle>
            <CardDescription>
              {ultimaMensagemAyla
                ? formatRelative(new Date(ultimaMensagemAyla.created_at), new Date(), { locale: ptBR })
                : "Mensagem mais recente da Ayla."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ultimaMensagemAyla?.texto ? (
              <p className="line-clamp-4 whitespace-pre-wrap text-sm">{ultimaMensagemAyla.texto}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Em até 4 horas após o cadastro a Ayla manda a primeira mensagem no WhatsApp.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

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
        Sua assinatura está pausada. Histórico preservado — reative quando quiser.
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
        ? "border-amber-300/60 bg-amber-50 text-amber-900"
        : "bg-muted/30";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm", toneCls)}>
      <span>{children}</span>
      <Link
        href="/assinatura"
        className={cn(buttonVariants({ size: "sm", variant: tone === "neutral" ? "outline" : "default" }))}
      >
        {cta}
      </Link>
    </div>
  );
}

type DiarioRow = {
  id: string;
  data: string;
  conquista?: string | null;
  desafio?: string | null;
  membros_atipicos: { nome: string } | { nome: string }[] | null;
};

function DiarioList({
  rows,
  field,
  empty,
}: {
  rows: DiarioRow[] | null;
  field: "conquista" | "desafio";
  empty: string;
}) {
  if (!rows || rows.length === 0) {
    return <p className="text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const nome = Array.isArray(r.membros_atipicos)
          ? r.membros_atipicos[0]?.nome
          : r.membros_atipicos?.nome;
        return (
          <li key={r.id}>
            <p className="line-clamp-2">{r[field]}</p>
            <p className="text-xs text-muted-foreground">
              {nome ?? "—"} ·{" "}
              {formatRelative(new Date(r.data), new Date(), { locale: ptBR })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function labelEmocional(escala: string): string {
  switch (escala) {
    case "muito_bem":
      return "Muito bem 🌞";
    case "bem":
      return "Bem 🙂";
    case "neutro":
      return "Neutro 😐";
    case "dificil":
      return "Difícil 🌧";
    case "muito_dificil":
      return "Muito difícil 🌧🌧";
    default:
      return "—";
  }
}
