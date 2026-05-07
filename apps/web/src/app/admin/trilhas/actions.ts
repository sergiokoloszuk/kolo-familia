"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const trilhaSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(200),
  descricao: z.string().trim().max(2000).optional(),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  tags_csv: z.string().trim().max(500).optional(),
  perfis_csv: z.string().trim().max(500).optional(),
  ativo: z.coerce.boolean().default(true),
});

export type SaveTrilhaInput = z.infer<typeof trilhaSchema>;

export async function saveTrilha(input: SaveTrilhaInput): Promise<{ id: string }> {
  const data = trilhaSchema.parse(input);
  const { supabase } = await requireAdmin();

  const payload = {
    titulo: data.titulo,
    descricao: data.descricao ?? null,
    ordem: data.ordem,
    tags: parseCsv(data.tags_csv),
    perfis_aplicaveis: parseCsv(data.perfis_csv),
    ativo: data.ativo,
  };

  if (data.id) {
    const { error } = await supabase.from("trilhas").update(payload).eq("id", data.id);
    if (error) throw new Error(`Falha ao salvar: ${error.message}`);
    revalidatePath(`/admin/trilhas/${data.id}`);
    revalidatePath("/admin/trilhas");
    return { id: data.id };
  } else {
    const { data: nova, error } = await supabase
      .from("trilhas")
      .insert(payload)
      .select("id")
      .single();
    if (error || !nova) throw new Error(`Falha ao criar: ${error?.message}`);
    revalidatePath("/admin/trilhas");
    return { id: nova.id as string };
  }
}

export async function deleteTrilha(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  // Aulas vinculadas a essa trilha viram trilha_id=null (FK on delete set null)
  const { error } = await supabase.from("trilhas").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
  revalidatePath("/admin/trilhas");
  redirect("/admin/trilhas");
}

function parseCsv(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
