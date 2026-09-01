import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AssinaturaActions } from "@/app/(conta)/assinatura/assinatura-actions";

/**
 * Bloqueio de acesso quando o período grátis acabou (ou a assinatura não está
 * ativa) e a pessoa não é admin/analista/cortesia. Tela cheia, sem sidebar.
 * Reusa os botões de checkout do Stripe — assinou, o webhook libera e volta.
 *
 * ⚠️ ESTA TELA ERA UM BECO SEM SAÍDA (corrigido em 01/09/2026). Ela não tinha
 * um único `href` nem botão de sair: 95 linhas, dois botões de checkout e mais
 * nada. E como "Sair da conta" só existia na `Sidebar` — que vive dentro de
 * `(app)`, atrás deste mesmo gate —, **uma família com teste vencido não
 * conseguia nem sair da própria conta**, quanto mais corrigir o e-mail ou a
 * senha. Quem tivesse errado o e-mail no cadastro ficava sem nenhum caminho.
 *
 * As duas saídas abaixo NÃO afrouxam o bloqueio: levam para `(conta)`, que
 * exige sessão e não exige assinatura. Produto, Ayla e dados da criança
 * continuam exatamente tão fechados quanto antes.
 *
 * O preço continua aparecendo aqui porque o checkout tem que caber nesta tela
 * — mas `/assinatura` deixou de ser inalcançável, e agora há link para ela.
 */
export function TrialGate({
  vencido,
  jaUsouAntes = false,
  precoMensal = null,
  precoAnual = null,
  economiaAnual = null,
}: {
  vencido: boolean;
  /** O teste nasceu vencido: já foi usado antes com este e-mail/WhatsApp. */
  jaUsouAntes?: boolean;
  /** Já formatado (ex.: "R$ 54,90"), da mesma fonte da página de planos. */
  precoMensal?: string | null;
  precoAnual?: string | null;
  /** Quanto o anual economiza no ano, quando dá pra calcular. */
  economiaAnual?: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kolo-page px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-foreground/[0.08] bg-white px-6 py-8 text-center shadow-sm">
        <div className="mb-5 flex justify-center">
          <Logo size={28} />
        </div>
        <h1 className="font-heading text-2xl text-foreground">
          {jaUsouAntes
            ? "Você já usou o período de teste"
            : vencido
              ? "Seu período grátis acabou"
              : "Assine pra continuar"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {jaUsouAntes
            ? "O teste de 7 dias é uma vez por pessoa, e esse já foi usado com este e-mail ou WhatsApp. Pra entrar de novo e ter tudo à mão, escolha um plano."
            : "Pra continuar acompanhando seu filho na Kolo — o Perfil, as conversas e tudo que você já registrou —, escolha um plano. Seus dados continuam guardados."}
        </p>
        {(precoMensal || precoAnual) && (
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

        <div className="mt-6 flex justify-center">
          <AssinaturaActions
            status="trialing"
            temCustomerId={false}
            precoMensal={precoMensal}
            precoAnual={precoAnual}
          />
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Dá pra cancelar quando quiser. Se preferir falar com a gente antes, é só
          responder a Ayla no WhatsApp.
        </p>

        {/* As duas portas que faltavam. Cuidar da conta e sair dela nunca
            dependeram de assinatura — só estavam trancadas do lado errado. */}
        <div className="mt-6 flex items-center justify-center gap-4 border-t border-foreground/[0.08] pt-5 text-sm">
          <Link
            href="/configuracoes/conta"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Minha conta
          </Link>
          <span aria-hidden className="text-foreground/20">
            ·
          </span>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
