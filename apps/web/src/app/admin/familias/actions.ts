"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarTexto } from "@/lib/ayla/whatsappSender";

const MENSAGEM_ENGANO =
  "Sinto muito — acho que este número entrou no meu sistema por engano. 💛 Não vou mais mandar mensagens por aqui. Um abraço e se cuida! 🌿";

/**
 * Bloqueia (ou desbloqueia) a Ayla pra uma família — ex.: criança/não-titular
 * usando o número. Bloqueada = `ayla_preferences.desativada = true`, e o fluxo
 * reativo (processInbound) para de responder a QUALQUER mensagem desse número.
 * Ao BLOQUEAR, manda uma última mensagem de despedida gentil (avisar+enviar).
 */
export async function bloquearAyla(
  familyId: string,
  bloquear: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    // Ao bloquear: manda a última mensagem antes de silenciar (best-effort).
    if (bloquear) {
      const { data: fam } = await admin
        .from("family_accounts")
        .select("whatsapp_e164")
        .eq("id", familyId)
        .maybeSingle();
      const phone = fam?.whatsapp_e164 as string | null;
      if (phone) {
        try {
          await enviarTexto({ phoneE164: phone, texto: MENSAGEM_ENGANO });
          await admin.from("ayla_messages").insert({
            family_account_id: familyId,
            direcao: "outbound",
            texto: MENSAGEM_ENGANO,
            tipo: "campanha_operacional",
          });
        } catch (e) {
          console.warn("[admin:bloquear] falha ao mandar despedida:", e instanceof Error ? e.message : e);
        }
      }
    }

    const { error } = await admin
      .from("ayla_preferences")
      .upsert({ family_account_id: familyId, desativada: bloquear }, { onConflict: "family_account_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/familias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
