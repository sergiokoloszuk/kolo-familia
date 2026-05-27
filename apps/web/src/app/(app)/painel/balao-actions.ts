"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Marca que o balão "Os primeiros passos" foi visto. Chamado quando a
 * usuária fecha o balão ou clica num dos 2 destinos (Kolo Vivo / Estratégias).
 * Não bloqueia: se falhar, o pior caso é o balão reaparecer.
 */
export async function marcarBalaoPrimeirosPassosVisto(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("family_accounts")
      .update({ painel_balao_visto_at: new Date().toISOString() })
      .eq("user_id", user.id);
    revalidatePath("/painel");
  } catch {
    // silencioso — UX não pode travar por causa disso
  }
}
