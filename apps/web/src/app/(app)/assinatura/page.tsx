import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground">
            R$ 53/mês ou plano anual com desconto. Cancela em 2 cliques.
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[statusKey] ?? "outline"}>
          {STATUS_LABEL[statusKey] ?? statusKey}
        </Badge>
      </header>

      {flash === "success" && (
        <div className="rounded-md border border-green-300/60 bg-green-50 px-4 py-3 text-sm text-green-900">
          Pagamento confirmado. Sua assinatura está sendo ativada — recarregue se ainda
          aparecer como trial em alguns segundos.
        </div>
      )}
      {flash === "canceled" && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Pagamento não concluído. Você pode tentar de novo quando quiser.
        </div>
      )}

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que está incluso</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="ml-5 list-disc space-y-1">
            <li>App completo (painel, Kolo Vivo, conversar, apoio, aprender).</li>
            <li>Ayla no WhatsApp (entra na próxima fase).</li>
            <li>n especialistas que respondem por contexto, sem você escolher.</li>
            <li>Histórico nunca é apagado, mesmo se cancelar.</li>
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
