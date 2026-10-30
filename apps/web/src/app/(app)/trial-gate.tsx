import { Logo } from "@/components/brand/logo";
import { AssinaturaActions } from "./assinatura/assinatura-actions";
import { ativarMeuTrialBlackFriday } from "./assinatura/actions";
import { BLACK_FRIDAY_2026 } from "@/lib/billing/black-friday-2026";

/**
 * Bloqueio de acesso quando o período grátis acabou (ou a assinatura não está
 * ativa) e a pessoa não é admin/analista/cortesia. Tela cheia, sem sidebar.
 * Reusa os botões de checkout do Stripe — assinou, o webhook libera e volta.
 *
 * Aqui é o FIM DA LINHA de quem venceu: o layout intercepta antes de qualquer
 * página, então a `/assinatura` (que mostra planos e valores) é inalcançável
 * justamente pra quem precisa dela — inclusive quando a Ayla manda o link. Por
 * isso esta tela precisa mostrar o PREÇO e a diferença entre mensal e anual;
 * antes eram dois botões sem valor nenhum.
 */
export function TrialGate({
  vencido,
  jaUsouAntes = false,
  podePedirTrialBlackFriday = false,
  ofertaBlackFriday = false,
  ofertaBlackFridayIndisponivel = false,
  precoMensal = null,
  precoAnual = null,
  economiaAnual = null,
}: {
  vencido: boolean;
  /** O teste nasceu vencido: já foi usado antes com este e-mail/WhatsApp. */
  jaUsouAntes?: boolean;
  /** A campanha ativa permite que esta conta peça um novo teste voluntariamente. */
  podePedirTrialBlackFriday?: boolean;
  /** A conta já participou e ainda preserva o preço individual de R$ 39,90. */
  ofertaBlackFriday?: boolean;
  /** Já participou, mas o preço não passou na conferência; não oferece preço normal. */
  ofertaBlackFridayIndisponivel?: boolean;
  /** Já formatado (ex.: "R$ 54,90"), da mesma fonte da página de planos. */
  precoMensal?: string | null;
  precoAnual?: string | null;
  /** Quanto o anual economiza no ano, quando dá pra calcular. */
  economiaAnual?: string | null;
}) {
  const titulo = podePedirTrialBlackFriday
    ? "Você pode experimentar de novo"
    : ofertaBlackFriday
      ? "Sua oferta Black Friday continua disponível"
      : ofertaBlackFridayIndisponivel
        ? "Estamos conferindo sua oferta"
      : jaUsouAntes
        ? "Você já usou o período de teste"
        : vencido
          ? "Seu período grátis acabou"
          : "Assine pra continuar";
  const descricao = podePedirTrialBlackFriday
    ? `Ative ${BLACK_FRIDAY_2026.diasTrial} dias completos, sem cartão e sem cobrança automática. Depois, você poderá escolher o plano de R$ 39,90 por mês dentro do seu prazo individual.`
    : ofertaBlackFriday
      ? "Seu período gratuito terminou, mas o preço de R$ 39,90 por mês ainda está reservado até o fim do seu prazo individual."
      : ofertaBlackFridayIndisponivel
        ? "Seu benefício está preservado, mas o pagamento está temporariamente indisponível. Não vamos trocar sua oferta pelo preço normal; tente novamente mais tarde ou fale com o suporte."
      : jaUsouAntes
        ? "O teste de 7 dias é uma vez por pessoa, e esse já foi usado com este e-mail ou WhatsApp. Pra entrar de novo e ter tudo à mão, escolha um plano."
        : "Pra continuar acompanhando seu filho na Kolo — o Perfil, as conversas e tudo que você já registrou —, escolha um plano. Seus dados continuam guardados.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kolo-page px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-foreground/[0.08] bg-white px-6 py-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <Logo size={28} />
        </div>
        <h1 className="font-heading text-2xl text-foreground">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{descricao}</p>
        {podePedirTrialBlackFriday && (
          <form action={ativarMeuTrialBlackFriday} className="mt-6">
            <button className="rounded-full bg-brand-purple px-5 py-2 font-semibold text-white">
              Ativar meus {BLACK_FRIDAY_2026.diasTrial} dias
            </button>
          </form>
        )}
        {!podePedirTrialBlackFriday && !ofertaBlackFridayIndisponivel &&
          (precoMensal || precoAnual) && (
          <div className="mt-6 flex flex-col gap-2 text-left">
            {precoMensal && (
              <div className="flex items-baseline justify-between rounded-xl border border-foreground/[0.08] px-4 py-3">
                <span className="text-sm text-foreground">Mensal</span>
                <span className="text-sm font-semibold text-foreground">
                  {precoMensal}
                  <span className="font-normal text-muted-foreground">/mês</span>
                </span>
              </div>
            )}
            {precoAnual && (
              <div className="flex items-baseline justify-between rounded-xl border border-brand-purple/25 bg-brand-purple/[0.04] px-4 py-3">
                <span className="text-sm text-foreground">
                  Anual
                  {economiaAnual && (
                    <span className="ml-1 text-xs text-brand-purple">
                      economiza {economiaAnual}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {precoAnual}
                  <span className="font-normal text-muted-foreground">/ano</span>
                </span>
              </div>
            )}
          </div>
        )}

        {!podePedirTrialBlackFriday && !ofertaBlackFridayIndisponivel &&
          <div className="mt-6 flex justify-center">
          <AssinaturaActions
            status="trialing"
            temCustomerId={false}
            precoMensal={precoMensal}
            precoAnual={precoAnual}
            mostrarAnual={!ofertaBlackFriday}
          />
          </div>}

        <p className="mt-5 text-xs text-muted-foreground">
          Dá pra cancelar quando quiser. Se preferir falar com a gente antes, é só
          responder a Ayla no WhatsApp.
        </p>
      </div>
    </div>
  );
}
