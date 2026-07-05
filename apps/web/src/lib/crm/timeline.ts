import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Linha do tempo UNIFICADA de um lead pro CRM: junta o que a AYLA fez
 * (mensagens no WhatsApp — proativa e reativa), o que a KARINA fez (abordagens
 * do CRM) e o que o LEAD escreveu. Assim dá pra ver a conversa inteira e não
 * repetir o que a Ayla já cobriu.
 */

export type TimelineItem = {
  quando: string; // ISO
  autor: "ayla" | "voce" | "lead";
  rotulo: string;
  texto: string;
};

export async function carregarTimelineLead(
  admin: SupabaseClient,
  familyId: string,
): Promise<TimelineItem[]> {
  const [{ data: aylaMsgs }, { data: crm }] = await Promise.all([
    admin
      .from("ayla_messages")
      .select("direcao, category, texto, created_at")
      .eq("family_account_id", familyId),
    admin
      .from("crm_mensagens")
      .select("direcao, texto, created_at")
      .eq("family_account_id", familyId),
  ]);

  const items: TimelineItem[] = [];

  for (const m of aylaMsgs ?? []) {
    const dir = m.direcao as string;
    const cat = (m.category as string | null) ?? null;
    const texto = (m.texto as string | null)?.trim() || "(áudio/mídia)";
    if (dir === "inbound") {
      items.push({ quando: m.created_at as string, autor: "lead", rotulo: "Lead escreveu", texto });
    } else {
      items.push({
        quando: m.created_at as string,
        autor: "ayla",
        rotulo: cat === "proativa" ? "Ayla (proativa)" : "Ayla respondeu",
        texto,
      });
    }
  }

  for (const m of crm ?? []) {
    const texto = (m.texto as string) ?? "";
    if ((m.direcao as string) === "enviada") {
      items.push({ quando: m.created_at as string, autor: "voce", rotulo: "Você (abordagem)", texto });
    } else {
      items.push({ quando: m.created_at as string, autor: "lead", rotulo: "Lead respondeu", texto });
    }
  }

  items.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
  return items;
}
