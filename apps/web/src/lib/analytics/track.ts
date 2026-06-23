import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Tracking de COMPORTAMENTO (server-side). Insere em user_events com a família
 * já resolvida no servidor. Fire-and-forget: nunca lança — evento é analítico,
 * jamais derruba o fluxo principal. Escrita por service-role (ignora RLS).
 *
 * Página visitada vem do client via /api/track; eventos de feature (lúdico
 * gerado, plano solicitado, diário criado…) chamam `trackFeature` direto na
 * server action onde a ação acontece, com a família já conhecida.
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

/**
 * Conveniência pra instrumentar features nas server actions: cria o client
 * service-role sozinho. Chame fire-and-forget (sem travar a ação) — idealmente
 * via `after(() => trackFeature(...))`.
 */
export async function trackFeature(p: TrackParams): Promise<void> {
  try {
    await trackEventServer(createServiceRoleClient(), p);
  } catch {
    // silencioso
  }
}
