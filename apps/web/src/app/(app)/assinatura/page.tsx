import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CreditCard, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { formatarBRL, lerPlanosParaExibir } from "@/lib/billing/planos";
import { AssinaturaActions } from "./assinatura-actions";
import { origemValida } from "@/app/(public)/precos/origem";
import { MarcoOrigem } from "@/app/(public)/precos/marco-origem";
import {
  podeSolicitarTrialBlackFriday,
  resolverSituacaoBlackFridayDaFamilia,
} from "@/lib/billing/oferta-familia";
import { BLACK_FRIDAY_2026 } from "@/lib/billing/black-friday-2026";
import { ativarMeuTrialBlackFriday } from "./actions";

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
  const { supabase, family, user } = await loadFamilyContext();
  const familyId = family!.id;

  // ⚠️ A MEDIÇÃO SEGUIU O DESTINO — 27/08/2026. O convite de fim de teste
  // deixou de apontar para `/precos` e passou a apontar para cá; sem este
  // marcador, o degrau do meio do funil (“a família ABRIU a página?”) sumiria
  // em silêncio, e “mandamos e ninguém assinou” voltaria a não distinguir
  // *não clicou* de *clicou e não converteu*. Mesmo evento de sempre, com a
  // página no detalhe — a série histórica não se parte em duas.
  const origemComercial = origemValida((await props.searchParams)?.de);

  const { data: sub } = await supabase
    .from("subscription_accesses")
    .select(
      "status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, cortesia, cortesia_ate, pagamento_falhou_em",
    )
    .eq("family_account_id", familyId)
    .maybeSingle();

  // Preço pelo leitor único (lib/billing/planos.ts) — o Stripe é o dono, e
  // esta tela mostra exatamente o que o checkout vai cobrar. Service-role
  // porque configuração de preço é pública.
  const admin = createServiceRoleClient();
  const [planos, situacaoBlackFriday] = await Promise.all([
    lerPlanosParaExibir(admin),
    resolverSituacaoBlackFridayDaFamilia(supabase),
  ]);
  const ofertaBlackFriday = situacaoBlackFriday.oferta;
  const ofertaBlackFridayIndisponivel = !situacaoBlackFriday.consultaConfiavel ||
    (situacaoBlackFriday.direitoAoPreco && !ofertaBlackFriday);
  const mensalLabel = formatarBRL(
    situacaoBlackFriday.direitoAoPreco
      ? BLACK_FRIDAY_2026.valorCentavos
      : planos.mensal.centavos,
  );
  const anualLabel = formatarBRL(planos.anual.centavos);

  const sp = await props.searchParams;
  const flash = typeof sp.status === "string" ? sp.status : null;
  const checkoutBlackFriday = sp.campanha === "black-friday-2026";

  const trialDaysLeft =
    sub?.status === "trialing" && sub.trial_ends_at
      ? Math.max(0, differenceInCalendarDays(new Date(sub.trial_ends_at), new Date()))
      : null;

  const proximaCobranca =
    sub?.current_period_end ? new Date(sub.current_period_end) : null;

  const statusKey = sub?.status ?? "trialing";
  const agora = new Date();
  const podePedirTrialBlackFriday = podeSolicitarTrialBlackFriday({
    assinatura: sub,
    consultaConfiavel: situacaoBlackFriday.consultaConfiavel,
    jaParticipa: situacaoBlackFriday.participa,
    estado: situacaoBlackFriday.estado,
    agora,
  });

  return (
    <div className="flex flex-col gap-8">
      <MarcoOrigem origem={origemComercial} />
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <IconCard tone="light" size="lg" className="hidden md:inline-flex">
            <CreditCard aria-hidden />
          </IconCard>
          <div>
            <Eyebrow>Assinatura</Eyebrow>
            <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
              {mensalLabel ? `${mensalLabel}/mês` : "Assinatura"}{" "}
              <em className="not-italic text-brand-purple">
                {ofertaBlackFriday ? "Black Friday" : (anualLabel ? `ou ${anualLabel}/ano` : "ou anual")}
              </em>
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Você pode cancelar a renovação quando quiser. Cancelar a
              assinatura não apaga sua conta nem os registros da família.
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
            <strong className="font-semibold">
              {checkoutBlackFriday ? "Forma de pagamento salva." : "Pagamento confirmado."}
            </strong>{" "}
            {checkoutBlackFriday
              ? `Seus ${BLACK_FRIDAY_2026.diasTrial} dias gratuitos continuam completos; a primeira cobrança será feita depois que o teste terminar.`
              : "Sua assinatura está sendo ativada — recarregue se ainda aparecer como trial em alguns segundos."}
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

      {ofertaBlackFriday && (
        <div className="rounded-2xl border-l-4 border-brand-yellow bg-brand-yellow/10 px-5 py-4">
          <p className="font-semibold text-brand-purple-dark">Sua oferta Black Friday está disponível.</p>
          <p className="mt-1 text-sm text-foreground/80">R$ 39,90 por mês. Se assinar durante o teste, seus {BLACK_FRIDAY_2026.diasTrial} dias gratuitos continuam completos.</p>
        </div>
      )}

      {ofertaBlackFridayIndisponivel && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-950">Sua oferta está preservada.</p>
          <p className="mt-1 text-sm text-amber-900">
            O pagamento de R$ 39,90 por mês está temporariamente indisponível.
            Não vamos substituir sua oferta pelo preço normal; tente novamente
            mais tarde ou fale com o suporte.
          </p>
        </div>
      )}

      {podePedirTrialBlackFriday && (
        <div className="rounded-2xl border-l-4 border-brand-yellow bg-brand-yellow/10 px-5 py-4">
          <p className="font-semibold text-brand-purple-dark">Você pode experimentar de novo por {BLACK_FRIDAY_2026.diasTrial} dias.</p>
          <p className="mt-1 text-sm text-foreground/80">É opcional, começa quando você apertar e não pede cartão.</p>
          <form action={ativarMeuTrialBlackFriday} className="mt-3">
            <button className="rounded-full bg-brand-purple px-5 py-2 font-semibold text-white">Ativar meus {BLACK_FRIDAY_2026.diasTrial} dias</button>
          </form>
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
          {!ofertaBlackFridayIndisponivel && (
            <AssinaturaActions
              status={statusKey}
              temCustomerId={Boolean(sub?.stripe_customer_id)}
              precoMensal={mensalLabel}
              precoAnual={ofertaBlackFriday ? null : anualLabel}
              mostrarAnual={!ofertaBlackFriday}
              emailFiscalInicial={user.email ?? ""}
            />
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
        <CardHeader>
          <CardTitle className="text-base">O que está incluso</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/80">
          <ul className="flex flex-col gap-2">
            {[
              "App completo (painel, Perfil, conversar, apoio, aprender).",
              "Acompanhamento no WhatsApp (próxima fase).",
              "Especialistas que respondem conforme o contexto, sem você precisar escolher.",
              "Seus registros ficam guardados enquanto sua conta existir.",
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

      <Card className="rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2">
        <CardHeader>
          <CardTitle className="text-base">Cancelar ou apagar a conta</CardTitle>
          <CardDescription className="text-foreground/70">
            Para cancelar a renovação, use &ldquo;Gerenciar assinatura&rdquo; acima. Sua
            conta e seus registros continuam guardados durante o acesso. Para
            apagar definitivamente os dados, use Configurações &gt; Minha conta.
          </CardDescription>
        </CardHeader>
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
    return `Faltam ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"} do seu período grátis.`;
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
