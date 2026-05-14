"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const variationsSchema = z
  .array(z.string().trim().min(1, "Variação não pode estar vazia"))
  .min(1, "Adicione pelo menos uma variação");

const saveSchema = z.object({
  key: z.string().min(1),
  label: z.string().trim().min(1, "Rótulo obrigatório"),
  description: z.string().trim().optional(),
  variations: variationsSchema,
  ativo: z.boolean(),
});

export async function saveTemplate(input: z.infer<typeof saveSchema>): Promise<void> {
  const data = saveSchema.parse(input);
  const { supabase } = await requireAdmin();

  // Pega versão atual pra incrementar
  const { data: atual } = await supabase
    .from("ayla_message_templates")
    .select("versao")
    .eq("key", data.key)
    .maybeSingle();
  const novaVersao = ((atual?.versao as number | undefined) ?? 0) + 1;

  const { error } = await supabase
    .from("ayla_message_templates")
    .update({
      label: data.label,
      description: data.description ?? null,
      variations: data.variations,
      ativo: data.ativo,
      versao: novaVersao,
    })
    .eq("key", data.key);

  if (error) throw new Error(`Falha ao salvar: ${error.message}`);

  revalidatePath("/admin/mensagens");
  revalidatePath(`/admin/mensagens/${data.key}`);
}
