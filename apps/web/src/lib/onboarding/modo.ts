import type { SupabaseClient } from "@supabase/supabase-js";
import { familiasInternas } from "@/lib/analytics/internos";

/**
 * Chave de troca do onboarding (Fatia 3). Fica em onboarding_copy.modo:
 *  - "antigo": todo mundo no wizard de 6 telas (padrão seguro).
 *  - "teste":  fluxo NOVO só pra contas internas (pra validar antes de abrir).
 *  - "todos":  fluxo NOVO pra todo mundo.
 * Flipável na hora pelo admin (sem deploy). Degrada pra "antigo" se algo falhar.
 */

export type ModoOnboarding = "antigo" | "teste" | "todos";

const ID = "atual";

export async function lerModo(admin: SupabaseClient): Promise<ModoOnboarding> {
  try {
    const { data } = await admin.from("onboarding_copy").select("modo").eq("id", ID).maybeSingle();
    const m = data?.modo as string | undefined;
    return m === "teste" || m === "todos" ? m : "antigo";
  } catch {
    return "antigo";
  }
}

export async function definirModo(admin: SupabaseClient, modo: ModoOnboarding): Promise<boolean> {
  try {
    const { error } = await admin
      .from("onboarding_copy")
      .upsert({ id: ID, modo, updated_at: new Date().toISOString() }, { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Decide, pra UMA família, qual onboarding mostrar. "teste" só libera o novo pra
 * contas internas (as mesmas do filtro dos dashboards). Fail-safe: "antigo".
 */
export async function resolverModoOnboarding(
  admin: SupabaseClient,
  familyId: string,
): Promise<"antigo" | "novo"> {
  const modo = await lerModo(admin);
  if (modo === "todos") return "novo";
  if (modo === "teste") {
    try {
      const internas = await familiasInternas(admin);
      return internas.has(familyId) ? "novo" : "antigo";
    } catch {
      return "antigo";
    }
  }
  return "antigo";
}
