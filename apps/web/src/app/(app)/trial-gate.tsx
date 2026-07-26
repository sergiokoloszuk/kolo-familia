import { Logo } from "@/components/brand/logo";
import { AssinaturaActions } from "./assinatura/assinatura-actions";

/**
 * Bloqueio de acesso quando o período grátis acabou (ou a assinatura não está
 * ativa) e a pessoa não é admin/analista/cortesia. Tela cheia, sem sidebar.
 * Reusa os botões de checkout do Stripe — assinou, o webhook libera e volta.
 */
export function TrialGate({
  vencido,
  jaUsouAntes = false,
}: {
  vencido: boolean;
  /** O teste nasceu vencido: já foi usado antes com este e-mail/WhatsApp. */
  jaUsouAntes?: boolean;
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
        <div className="mt-6 flex justify-center">
          <AssinaturaActions status="trialing" temCustomerId={false} />
        </div>
      </div>
    </div>
  );
}
