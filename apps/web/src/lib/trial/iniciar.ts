import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent, logServerError } from "@/lib/log";

/**
 * O ÚNICO LUGAR DO APP QUE INICIA O TESTE DE 7 DIAS.
 *
 * ── por que isto existe ───────────────────────────────────────────────────
 *
 * O teste nascia em `handle_new_user`, no INSERT em `auth.users` — antes do
 * onboarding, antes do telefone, antes de existir alguém alcançável. MEDIDO em
 * 20/08/2026: **87 famílias queimaram os 7 dias sem completar o cadastro**, e
 * **84 delas nunca trocaram uma mensagem com a Kolo**. O relógio corria para
 * quem nunca chegou.
 *
 * Agora o teste começa em um evento único e inequívoco: a conclusão do
 * onboarding — e só quando a família está apta.
 *
 * ── a decisão mora no BANCO, não aqui ─────────────────────────────────────
 *
 * Quem confere "WhatsApp verificado + consentimento" é
 * `iniciar_trial_se_apto` (migração 0081), e a conferência acontece na MESMA
 * instrução que grava. Não existe janela entre checar e escrever, e não existe
 * caminho no app capaz de furar a regra — nem um chamador novo que alguém
 * esqueça de proteger.
 *
 * Esta função é a casca: chama, registra e devolve. Nunca lança — concluir o
 * onboarding não pode falhar porque o teste não pôde começar; mas a recusa
 * **nunca** pode passar em silêncio, que é o defeito que o §7 do protocolo
 * proíbe.
 */

export type MotivoTrial =
  | "iniciado"
  /**
   * O direito de legado foi resgatado — 27/08/2026, migração 0084.
   *
   * A família se cadastrou ANTES da 0082, perdeu os 7 dias sem nunca usar, e
   * voltou. A assinatura antiga foi atualizada para `trialing` com prazo novo;
   * nenhuma linha foi criada. Só acontece UMA vez por família, e a garantia é
   * do Postgres (`update ... where redeemed_at is null returning`).
   */
  | "legado_iniciado"
  | "ja_existia"
  | "sem_whatsapp"
  | "nao_verificado"
  | "sem_consentimento"
  | "familia_inexistente"
  | "erro";

export type ResultadoTrial = { iniciado: boolean; motivo: MotivoTrial };

/** Recusas esperadas — não são falha do sistema, são a regra funcionando. */
const RECUSAS_LEGITIMAS: ReadonlySet<string> = new Set([
  "sem_whatsapp",
  "nao_verificado",
  "sem_consentimento",
]);

export async function iniciarTrial(
  admin: SupabaseClient,
  familyId: string,
): Promise<ResultadoTrial> {
  try {
    const { data, error } = await admin.rpc("iniciar_trial_se_apto", {
      p_family_id: familyId,
    });

    if (error) {
      // ⚠️ Escrita crítica que falha NÃO vira sucesso mudo (§7). Sem isto, uma
      // família concluiria o onboarding e ficaria sem teste, sem ninguém saber.
      await logServerError("iniciar_trial_falhou", error, {
        family_account_id: familyId,
      });
      return { iniciado: false, motivo: "erro" };
    }

    const motivo = (data as MotivoTrial) ?? "erro";

    await logEvent({
      kind: "trial_inicio",
      // `iniciado` e `ja_existia` são o caminho feliz e precisam sobreviver à
      // retenção da Vercel — daí `persistir`, sem envenenar a severidade.
      severity:
        motivo === "iniciado" || motivo === "legado_iniciado" || motivo === "ja_existia"
          ? "info"
          : "warn",
      persistir: true,
      family_account_id: familyId,
      message: `trial: ${motivo}`,
      payload: { motivo, em: new Date().toISOString() },
    });

    if (
      !RECUSAS_LEGITIMAS.has(motivo) &&
      motivo !== "iniciado" &&
      motivo !== "legado_iniciado" &&
      motivo !== "ja_existia"
    ) {
      await logServerError(
        "iniciar_trial_inesperado",
        new Error(`motivo inesperado: ${motivo}`),
        { family_account_id: familyId },
      );
    }

    return { iniciado: motivo === "iniciado" || motivo === "legado_iniciado", motivo };
  } catch (e) {
    await logServerError("iniciar_trial_excecao", e, { family_account_id: familyId });
    return { iniciado: false, motivo: "erro" };
  }
}
