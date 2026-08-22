"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { ConfirmarWhatsapp } from "@/components/confirmar-whatsapp";

/**
 * O CARD DO PAINEL — deixou de ser "Ativar a Ayla" e virou "Confirmar seu
 * WhatsApp" (Fase 2A).
 *
 * ── por que o nome mudou ──────────────────────────────────────────────────
 *
 * "Ativar a Ayla" descrevia um segundo passo que só existia porque o
 * onboarding não confirmava o número. Agora quem entra pelo cadastro já sai
 * com o WhatsApp confirmado e a Ayla ligada — não há segundo passo.
 *
 * O card continua existindo para quem é de ANTES: família que nunca datou o
 * consentimento. Para ela a pergunta certa não é "quer ativar?", é "esse
 * número é seu mesmo?".
 *
 * ── o que este arquivo NÃO faz mais ───────────────────────────────────────
 *
 * ⚠️ Ele chamava `./ativar-actions`, que gerava o código e guardava a prova
 * num cookie assinado por HMAC cujo segredo caía em `"kolo-ativacao-dev"`
 * quando as duas variáveis de ambiente não existiam. Aquele arquivo foi
 * REMOVIDO nesta frente — não sobrou caminho alternativo, nem "desativado por
 * flag": ele deixou de existir. Ver PEND-129 e PEND-130.
 *
 * Quem confirma aqui passa pelo mesmo `verificacoes_whatsapp` das outras
 * portas, com os mesmos limites (5 tentativas, 3 reenvios, 60s, 10 min).
 */
export function AtivarAylaCard({ numeroAtual }: { numeroAtual: string | null }) {
  const router = useRouter();

  return (
    <div
      id="ativar-ayla"
      className="relative overflow-hidden rounded-3xl px-6 py-6 text-white"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-purple-deep) 0%, var(--brand-purple-dark) 100%)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <MessageCircle className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-heading text-xl">Confirmar seu WhatsApp</h2>
          <p className="mt-1 text-sm text-white/80">
            Falta um passo para a Ayla poder te escrever.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-white/95 p-1 text-foreground">
        <ConfirmarWhatsapp
          numeroInicial={numeroAtual}
          variante="painel"
          onConfirmado={() => router.refresh()}
        />
      </div>
    </div>
  );
}
