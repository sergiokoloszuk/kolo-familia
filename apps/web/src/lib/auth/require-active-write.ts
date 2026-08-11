import { createClient } from "@/lib/supabase/server";
import { assinaturaLiberada, trialVencido } from "@/lib/auth/assinatura";
import { ehStaffPorUserId } from "@/lib/auth/acesso";

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

  // Admin/staff (founder testando, suporte) NUNCA é bloqueado por assinatura.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // ⚠️ AQUI a checagem é pelo USUÁRIO da sessão, não pela família — é o único
  // portão que já tem o `user` em mãos e não precisa resolvê-lo pelo id da
  // família. Por isso usa `ehStaffPorUserId` e não `acessoLiberado`: a regra é a
  // mesma (`lib/auth/acesso.ts`), o caminho até ela é que é mais curto.
  if (await ehStaffPorUserId(supabase, user?.id)) return;

  const { data } = await supabase
    .from("subscription_accesses")
    .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
    .eq("family_account_id", familyAccountId)
    .maybeSingle();

  if (!assinaturaLiberada(data)) {
    throw new SubscriptionBlockedError(data?.status ?? null, trialVencido(data));
  }
}
