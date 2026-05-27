"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Salva o gênero de um membro a partir do banner do painel. Usado quando
 * algum membro tem `genero = NULL` e a mãe responde direto na home.
 */
const schema = z.object({
  membroId: z.string().uuid(),
  genero: z.enum(["masculino", "feminino", "neutro"]),
});

export type SalvarGeneroResult = { ok: true } | { ok: false; error: string };

export async function salvarGeneroMembro(
  input: z.infer<typeof schema>,
): Promise<SalvarGeneroResult> {
  try {
    const data = schema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };
    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!family) return { ok: false, error: "Família não inicializada." };

    const { error } = await supabase
      .from("membros_atipicos")
      .update({ genero: data.genero })
      .eq("id", data.membroId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
