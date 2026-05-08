"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

const skillSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Use só letras minúsculas, números e _"),
  display_name: z.string().trim().min(2).max(120),
  objective: z.string().trim().min(10).max(500),
  tone: z.string().trim().min(3).max(300),
  scope: z.string().trim().min(10).max(1000),
  limits: z.string().trim().min(10).max(1000),
  kolo_vivo_fields_csv: z.string().trim().max(500).optional(),
  knowledge_tags_csv: z.string().trim().max(500).optional(),
  routing_keywords_csv: z.string().trim().max(2000).optional(),
  routing_priority: z.coerce.number().int().min(0).max(100).default(50),
  fallback_questions_jsonl: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .refine(
      (s) => {
        const lines = s.split(/\r?\n/).filter((l) => l.trim());
        return lines.length === 4;
      },
      "Forneça exatamente 4 perguntas — uma por linha",
    ),
  ativo: z.coerce.boolean().default(true),
});

export type SaveSkillInput = z.infer<typeof skillSchema>;

export async function saveSkill(input: SaveSkillInput): Promise<{ id: string }> {
  const data = skillSchema.parse(input);
  const { supabase } = await requireAdmin();

  const fallback = data.fallback_questions_jsonl
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    name: data.name,
    display_name: data.display_name,
    objective: data.objective,
    tone: data.tone,
    scope: data.scope,
    limits: data.limits,
    kolo_vivo_fields: parseCsv(data.kolo_vivo_fields_csv),
    knowledge_tags: parseCsv(data.knowledge_tags_csv),
    routing_keywords: parseCsv(data.routing_keywords_csv),
    routing_priority: data.routing_priority,
    fallback_questions: fallback,
    ativo: data.ativo,
  };

  if (data.id) {
    // Versionamento simples: incrementa em cada update
    const { data: atual } = await supabase
      .from("specialist_prompt_templates")
      .select("versao")
      .eq("id", data.id)
      .single();
    const novaVersao = (atual?.versao ?? 1) + 1;

    const { error } = await supabase
      .from("specialist_prompt_templates")
      .update({ ...payload, versao: novaVersao })
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao salvar: ${error.message}`);
    revalidatePath("/admin/skills");
    revalidatePath(`/admin/skills/${data.id}`);
    return { id: data.id };
  } else {
    const { data: nova, error } = await supabase
      .from("specialist_prompt_templates")
      .insert({ ...payload, versao: 1 })
      .select("id")
      .single();
    if (error || !nova) {
      throw new Error(`Falha ao criar: ${error?.message}`);
    }
    revalidatePath("/admin/skills");
    return { id: nova.id as string };
  }
}

export async function toggleSkillAtivo(id: string, ativo: boolean): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("specialist_prompt_templates")
    .update({ ativo })
    .eq("id", id);
  if (error) throw new Error(`Falha ao alterar status: ${error.message}`);
  revalidatePath("/admin/skills");
  revalidatePath(`/admin/skills/${id}`);
}

export async function deleteSkill(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("specialist_prompt_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
  revalidatePath("/admin/skills");
  redirect("/admin/skills");
}

function parseCsv(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
