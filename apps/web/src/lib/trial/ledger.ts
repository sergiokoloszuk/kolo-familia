import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/log";

/**
 * "1 número = 1 teste, PARA SEMPRE" (regra de produto, 25/07/2026) — a parte
 * que o banco sozinho não pega.
 *
 * O ledger de telefone (migração 0069) fecha o caminho de quem SALVA o número:
 * o hash fica registrado e a conta seguinte nasce com o trial vencido. Mas
 * existe um desvio que nunca chega a salvar: a pessoa deixa o trial vencer,
 * cria uma conta nova com outro e-mail e, no onboarding, o número é RECUSADO
 * pelo índice único (0038). Ela não fica com WhatsApp — e ficava com sete dias
 * novos pra usar o app pela web, quantas vezes quisesse.
 *
 * Então o próprio CONFLITO é o sinal: o número já pertence a uma conta, logo é
 * a mesma pessoa. O trial da conta nova encerra na hora.
 *
 * Falso positivo (digitou o número de outra pessoa) é possível, por isso o
 * evento fica em `eventos_app` com severity warn — aparece na Observabilidade
 * e o desbloqueio é uma cortesia em /admin/cortesias.
 */
export async function encerrarTrialPorNumeroDeOutraConta(
  admin: SupabaseClient,
  params: { familyId: string; contexto: string },
): Promise<void> {
  try {
    const { data } = await admin
      .from("subscription_accesses")
      .select("status, trial_ends_at")
      .eq("family_account_id", params.familyId)
      .maybeSingle();
    if (!data) return;

    const trialEm = data.trial_ends_at as string | null;
    const emTrialVivo =
      data.status === "trialing" && (!trialEm || new Date(trialEm).getTime() > Date.now());
    // Assinante, cortesia ou trial já vencido: nada a fazer.
    if (!emTrialVivo) return;

    await admin
      .from("subscription_accesses")
      .update({ trial_ends_at: new Date().toISOString() })
      .eq("family_account_id", params.familyId);

    await logEvent({
      kind: "trial_encerrado_numero_repetido",
      severity: "warn",
      family_account_id: params.familyId,
      message: `WhatsApp já pertence a outra conta (${params.contexto}) — teste encerrado`,
    });
  } catch (e) {
    // Nunca derrubar o fluxo da pessoa por causa da trava antifraude.
    console.warn("[trial.ledger]", e instanceof Error ? e.message : e);
  }
}
