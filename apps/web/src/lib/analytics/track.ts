import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tracking de COMPORTAMENTO (server-side). Insere em user_events com a família
 * já resolvida no servidor. Fire-and-forget: nunca lança — evento é analítico,
 * jamais derruba o fluxo principal. Escrita por service-role (ignora RLS).
 *
 * Página visitada vem do client via /api/track; eventos de feature (lúdico
 * gerado, plano solicitado, diário criado…) chamam isto direto na server action
 * onde a ação acontece, reusando o admin client e a família já conhecidos.
 */
export type TrackParams = {
  familyId?: string | null;
  userId?: string | null;
  evento: string;
  detalhe?: Record<string, unknown>;
};

export async function trackEventServer(
  admin: SupabaseClient,
  p: TrackParams,
): Promise<void> {
  try {
    await admin.from("user_events").insert({
      family_account_id: p.familyId ?? null,
      user_id: p.userId ?? null,
      evento: p.evento,
      detalhe: p.detalhe ?? {},
    });
  } catch {
    // analítico — silencioso de propósito
  }
}
