"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");
  return { supabase, family };
}

const schema = z.object({
  planoId: z.string().uuid(),
  resultado: z.enum(["funcionou", "parcial", "nao_funcionou", "nao_testou"]),
  nota: z.string().trim().max(800).optional().nullable(),
});

/**
 * A mãe diz como foi o plano (Fase 4). Guarda no próprio plano — os
 * próximos planos da criança leem isso pra priorizar o que funcionou.
 */
export async function registrarResultadoPlano(
  input: z.infer<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { planoId, resultado, nota } = schema.parse(input);
    const { supabase, family } = await requireFamily();

    const { error } = await supabase
      .from("planos")
      .update({
        resultado,
        resultado_nota: nota?.trim() || null,
        resultado_em: new Date().toISOString(),
      })
      .eq("id", planoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath(`/planos/${planoId}`);
    revalidatePath("/planos");
    revalidatePath("/evolucao");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
