import { createClient } from "@/lib/supabase/server";

/**
 * Bloqueia escrita quando subscription_accesses.status indica que a
 * assinatura não permite operações novas (PRD §5.3, §5.4).
 *
 * Permite escrita em: trialing, active, past_due (3 dias de graça)
 * Bloqueia em:        paused, canceled, ou ausência de row
 *
 * Lança erro tipado que a UI traduz pra mensagem amigável.
 */
export class SubscriptionBlockedError extends Error {
  constructor(public readonly status: string | null) {
    super(
      status === "paused"
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
    .select("status, cortesia, cortesia_ate")
    .eq("family_account_id", familyAccountId)
    .maybeSingle();

  const status = data?.status ?? null;
  // Cortesia (comp): libera independente de status/trial. cortesia_ate = NULL é
  // vitalícia; com data, vale até expirar.
  const cortesiaValida =
    data?.cortesia === true &&
    (!data.cortesia_ate || new Date(data.cortesia_ate as string).getTime() > Date.now());
  const liberada =
    cortesiaValida ||
    status === "trialing" ||
    status === "active" ||
    status === "past_due";
  if (!liberada) {
    throw new SubscriptionBlockedError(status);
  }
}
