import { createClient } from "@/lib/supabase/server";
import { assinaturaLiberada, trialVencido } from "@/lib/auth/assinatura";

/**
 * Bloqueia escrita quando a assinatura não permite operações novas.
 *
 * Permite escrita em: cortesia válida, active, past_due (graça), ou trial
 * DENTRO do prazo. Bloqueia em: trial vencido, paused, canceled, ausência de
 * row. A regra mora em lib/auth/assinatura (usada também no layout do app).
 *
 * Lança erro tipado que a UI traduz pra mensagem amigável.
 */
export class SubscriptionBlockedError extends Error {
  constructor(
    public readonly status: string | null,
    trialExpirado = false,
  ) {
    super(
      trialExpirado
        ? "Seu período grátis acabou. Assine em /assinatura pra continuar."
        : status === "paused"
          ? "Sua assinatura está pausada. Reative em /assinatura pra voltar a usar."
          : status === "canceled"
            ? "Sua assinatura está cancelada. Reative em /assinatura pra voltar a usar."
            : "Não há assinatura ativa. Veja /assinatura.",
    );
    this.name = "SubscriptionBlockedError";
  }
}

export async function requireActiveWrite(familyAccountId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_accesses")
    .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
    .eq("family_account_id", familyAccountId)
    .maybeSingle();

  if (!assinaturaLiberada(data)) {
    throw new SubscriptionBlockedError(data?.status ?? null, trialVencido(data));
  }
}
