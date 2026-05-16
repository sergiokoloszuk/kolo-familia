"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const saveSchema = z.object({
  key: z.string().min(1),
  label: z.string().trim().min(1, "Rótulo obrigatório"),
  description: z.string().trim().optional(),
  system_text: z.string().trim().min(20, "System prompt muito curto"),
  ativo: z.boolean(),
});

export async function saveAiPrompt(
  input: z.infer<typeof saveSchema>,
): Promise<ActionResult> {
  try {
    const data = saveSchema.parse(input);
    const { supabase } = await requireAdmin();

    const { data: atual } = await supabase
      .from("ai_prompts")
      .select("versao")
      .eq("key", data.key)
      .maybeSingle();
    const novaVersao = ((atual?.versao as number | undefined) ?? 0) + 1;

    const { error } = await supabase
      .from("ai_prompts")
      .update({
        label: data.label,
        description: data.description ?? null,
        system_text: data.system_text,
        ativo: data.ativo,
        versao: novaVersao,
      })
      .eq("key", data.key);

    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

    revalidatePath("/admin/prompts");
    revalidatePath(`/admin/prompts/${data.key}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
