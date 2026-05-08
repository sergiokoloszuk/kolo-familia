"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const updateSchema = z.object({
  key: z.string().min(1).max(80),
  ativa: z.boolean().optional(),
  cooldown_dias: z.coerce.number().int().min(0).max(180).optional(),
  severidade_default: z.enum(["info", "warn", "high"]).optional(),
});

export async function atualizarRegraDefinicao(
  input: z.infer<typeof updateSchema>,
): Promise<void> {
  const data = updateSchema.parse(input);
  const { supabase } = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (typeof data.ativa === "boolean") update.ativa = data.ativa;
  if (typeof data.cooldown_dias === "number")
    update.cooldown_dias = data.cooldown_dias;
  if (data.severidade_default) update.severidade_default = data.severidade_default;
  if (Object.keys(update).length === 0) return;

  // Versionamento — incrementa em cada save
  const { data: atual } = await supabase
    .from("regras_definicoes")
    .select("versao")
    .eq("key", data.key)
    .single();
  if (atual) update.versao = (atual.versao as number) + 1;

  const { error } = await supabase
    .from("regras_definicoes")
    .update(update)
    .eq("key", data.key);
  if (error) throw new Error(`Falha ao atualizar regra: ${error.message}`);

  revalidatePath("/admin/regras");
}

export async function rodarRegrasNaFamilia(
  family_account_id: string,
): Promise<{ resultados: number }> {
  const { supabase } = await requireAdmin();
  const { runRegrasParaFamilia } = await import("@/lib/regras/engine");

  const r = await runRegrasParaFamilia(supabase, family_account_id, new Date());
  revalidatePath("/admin/regras");
  return { resultados: r.length };
}
