import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CreditCard, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AssinaturaActions } from "./assinatura-actions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Em trial",
  active: "Ativa",
  past_due: "Pagamento pendente",
  paused: "Pausada",
  canceled: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  trialing: "outline",
  active: "default",
  past_due: "destructive",
  paused: "secondary",
  canceled: "secondary",
};

export default async function AssinaturaPage(props: PageProps<"/assinatura">) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: sub } = await supabase
    .from("subscription_accesses")
    .select(
      "status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, cancel_at_period_end",
    )
    .eq("family_account_id", familyId)
    .maybeSingle();

  const sp = await props.searchParams;
  const flash = typeof sp.status === "string" ? sp.status : null;

  const trialDaysLeft =
    sub?.status === "trialing" && sub.trial_ends_at
      ? Math.max(0, differenceInCalendarDays(new Date(sub.trial_ends_at), new Date()))
      : null;

  const proximaCobranca =
    sub?.current_period_end ? new Date(sub.current_period_end) : null;

  const statusKey = sub?.status ?? "trialing";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconCard tone="light" size="lg" className="hidden md:inline-flex">
            <CreditCard aria-hidden />
          </IconCard>
          <div>
            <Eyebrow>Assinatura</Eyebrow>
            <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
              R$ 53/mês{" "}
              <em className="not-italic text-brand-purple">ou anual</em>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Cancela em 2 cliques. Histórico fica preservado mesmo após
              cancelar.
            </p>
          </div>
        </div>
        <Badge
          variant={STATUS_VARIANT[statusKey] ?? "outline"}
          className="shrink-0"
        >
          {STATUS_LABEL[statusKey] ?? statusKey}
        </Badge>
      </header>

      {/* Flash messages — sem verde banido. Sucesso = amarelo Kolo. */}
      {flash === "success" && (
        <div className="flex items-start gap-3 rounded-2xl border-l-4 border-brand-yellow bg-brand-yellow/10 px-5 py-4">
          <Check className="mt-0.5 size-5 shrink-0 text-brand-purple-dark" aria-hidden />
          <p className="text-sm text-brand-purple-dark">
            <strong className="font-semibold">Pagamento confirmado.</strong>{" "}
            Sua assinatura está sendo ativada — recarregue se ainda aparecer
            como trial em alguns segundos.
          </p>
        </div>
      )}
      {flash === "canceled" && (
        <div className="flex items-start gap-3 rounded-2xl border border-kolo-linha bg-kolo-lilas-bg-2 px-5 py-4">
          <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Pagamento não concluído. Você pode tentar de novo quando quiser.
          </p>
        </div>
      )}

      <Card className="rounded-3xl bg-white">
        <CardHeader>
          <CardTitle className="text-base">Estado atual</CardTitle>
          <CardDescription>
            <StatusDescription
              status={statusKey}
              trialDaysLeft={trialDaysLeft}
              proximaCobranca={proximaCobranca}
              cancelAtPeriodEnd={sub?.cancel_at_period_end ?? false}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssinaturaActions
            status={statusKey}
            temCustomerId={Boolean(sub?.stripe_customer_id)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
        <CardHeader>
          <CardTitle className="text-base">O que está incluso</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/80">
          <ul className="flex flex-col gap-2">
            {[
              "App completo (painel, Kolo Vivo, conversar, apoio, aprender).",
              "Acompanhamento no WhatsApp (próxima fase).",
              "n especialistas que respondem por contexto, sem você escolher.",
              "Histórico nunca é apagado, mesmo se cancelar.",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-brand-purple"
                  aria-hidden
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusDescription({
  status,
  trialDaysLeft,
  proximaCobranca,
  cancelAtPeriodEnd,
}: {
  status: string;
  trialDaysLeft: number | null;
  proximaCobranca: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  if (status === "trialing") {
    if (trialDaysLeft === null) return "Trial em andamento.";
    if (trialDaysLeft === 0) return "Seu trial termina hoje.";
    return `Faltam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} dos seus 30 dias grátis.`;
  }
  if (status === "active") {
    if (cancelAtPeriodEnd && proximaCobranca) {
      return `Cancelamento agendado para ${format(proximaCobranca, "dd 'de' MMMM", { locale: ptBR })}.`;
    }
    if (proximaCobranca) {
      return `Próxima cobrança em ${format(proximaCobranca, "dd 'de' MMMM", { locale: ptBR })}.`;
    }
    return "Ativa.";
  }
  if (status === "past_due") {
    return "O último pagamento falhou. Atualize seu cartão pra manter tudo ativo.";
  }
  if (status === "paused") {
    return "Assinatura pausada. Histórico preservado — reative pra voltar a usar.";
  }
  if (status === "canceled") {
    return "Assinatura cancelada. Pode reativar a qualquer momento.";
  }
  return "Estado desconhecido.";
}
