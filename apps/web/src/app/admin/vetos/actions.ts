"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const createSchema = z.object({
  categoria: z.string().trim().min(2, "Categoria muito curta"),
  padrao: z.string().trim().min(2, "Padrão (regex) muito curto"),
  flags: z.string().trim().max(10).default("i"),
  descricao: z.string().trim().optional(),
  sugestao: z.string().trim().optional(),
});

export async function createVeto(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const data = createSchema.parse(input);
    const { supabase } = await requireAdmin();

    // Valida regex no servidor antes de salvar
    try {
      new RegExp(data.padrao, data.flags || "i");
    } catch {
      return { ok: false, error: `Padrão regex inválido: ${data.padrao}` };
    }

    const { error } = await supabase.from("ai_validator_vetos").insert({
      categoria: data.categoria,
      padrao: data.padrao,
      flags: data.flags || "i",
      descricao: data.descricao ?? null,
      sugestao: data.sugestao || "Reescreva sem essa expressão.",
      ativo: true,
      origem: "admin",
    });
    if (error) return { ok: false, error: `Falha: ${error.message}` };

    revalidatePath("/admin/vetos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function toggleVetoAtivo(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("ai_validator_vetos")
      .update({ ativo })
      .eq("id", id);
    if (error) return { ok: false, error: `Falha: ${error.message}` };
    revalidatePath("/admin/vetos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteVeto(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("ai_validator_vetos").delete().eq("id", id);
    if (error) return { ok: false, error: `Falha: ${error.message}` };
    revalidatePath("/admin/vetos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
