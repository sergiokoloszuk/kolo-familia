"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const saveSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(3).max(200),
  versao_curta: z.string().trim().min(5).max(500),
  versao_conversa: z.string().trim().max(2000).optional(),
  texto_original: z.string().trim().min(10).max(10000),
  skills_csv: z.string().trim().max(500).optional(),
  tags_csv: z.string().trim().max(500).optional(),
  perfis_csv: z.string().trim().max(500).optional(),
  faixa_etaria_min: z.coerce.number().int().min(0).max(120).nullable().optional(),
  faixa_etaria_max: z.coerce.number().int().min(0).max(120).nullable().optional(),
  nivel: z.enum(["iniciante", "intermediario", "avancado"]).nullable().optional(),
});

export async function saveBoaPratica(input: z.infer<typeof saveSchema>): Promise<void> {
  const data = saveSchema.parse(input);
  const { supabase } = await requireAdmin();

  // Versionamento simples: incrementa quando aprovada/editada após criada
  const { data: atual } = await supabase
    .from("boas_praticas")
    .select("versao")
    .eq("id", data.id)
    .single();

  const { error } = await supabase
    .from("boas_praticas")
    .update({
      titulo: data.titulo,
      versao_curta: data.versao_curta,
      versao_conversa: data.versao_conversa || null,
      texto_original: data.texto_original,
      skills_relacionadas: parseCsv(data.skills_csv),
      tags: parseCsv(data.tags_csv),
      perfis_aplicaveis: parseCsv(data.perfis_csv),
      faixa_etaria_min: data.faixa_etaria_min ?? null,
      faixa_etaria_max: data.faixa_etaria_max ?? null,
      nivel: data.nivel ?? null,
      versao: (atual?.versao ?? 1) + 1,
    })
    .eq("id", data.id);
  if (error) throw new Error(`Falha ao salvar: ${error.message}`);

  revalidatePath(`/admin/boas-praticas/${data.id}`);
  revalidatePath("/admin/boas-praticas");
}

const transitionSchema = z.object({
  id: z.string().uuid(),
  novoStatus: z.enum(["rascunho", "ativo", "arquivado"]),
});

export async function changeBPStatus(input: z.infer<typeof transitionSchema>): Promise<void> {
  const { id, novoStatus } = transitionSchema.parse(input);
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("boas_praticas")
    .update({ status: novoStatus })
    .eq("id", id);
  if (error) throw new Error(`Falha na transição: ${error.message}`);
  revalidatePath(`/admin/boas-praticas/${id}`);
  revalidatePath("/admin/boas-praticas");
}

export async function deleteBoaPratica(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("boas_praticas").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
  revalidatePath("/admin/boas-praticas");
  redirect("/admin/boas-praticas");
}

function parseCsv(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
