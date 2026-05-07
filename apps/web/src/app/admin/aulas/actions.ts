"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { extractBoasPraticasFromAula } from "@/lib/ia/extract-boas-praticas";

const aulaSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(200),
  descricao: z.string().trim().max(2000).optional(),
  video_url: z.string().trim().url().or(z.literal("")).optional(),
  transcricao: z.string().trim().max(50000).optional(),
  trilha_id: z.string().uuid().nullable().optional(),
  ordem_na_trilha: z.coerce.number().int().min(0).max(999).nullable().optional(),
  faixa_etaria_min: z.coerce.number().int().min(0).max(120).nullable().optional(),
  faixa_etaria_max: z.coerce.number().int().min(0).max(120).nullable().optional(),
  tags_csv: z.string().trim().max(500).optional(),
  perfis_csv: z.string().trim().max(500).optional(),
});

export type SaveAulaInput = z.infer<typeof aulaSchema>;

export async function saveAula(input: SaveAulaInput): Promise<{ id: string }> {
  const data = aulaSchema.parse(input);
  const { supabase } = await requireAdmin();

  const tags = parseCsv(data.tags_csv);
  const perfis = parseCsv(data.perfis_csv);

  const payload = {
    titulo: data.titulo,
    descricao: data.descricao ?? null,
    video_url: data.video_url || null,
    transcricao: data.transcricao ?? null,
    trilha_id: data.trilha_id ?? null,
    ordem_na_trilha: data.ordem_na_trilha ?? null,
    faixa_etaria_min: data.faixa_etaria_min ?? null,
    faixa_etaria_max: data.faixa_etaria_max ?? null,
    tags,
    perfis_aplicaveis: perfis,
  };

  if (data.id) {
    const { error } = await supabase.from("aulas").update(payload).eq("id", data.id);
    if (error) throw new Error(`Falha ao salvar: ${error.message}`);
    revalidatePath(`/admin/aulas/${data.id}`);
    revalidatePath("/admin/aulas");
    return { id: data.id };
  } else {
    const { data: nova, error } = await supabase
      .from("aulas")
      .insert(payload)
      .select("id")
      .single();
    if (error || !nova) throw new Error(`Falha ao criar: ${error?.message}`);
    revalidatePath("/admin/aulas");
    return { id: nova.id as string };
  }
}

const transitionSchema = z.object({
  id: z.string().uuid(),
  novoStatus: z.enum(["rascunho", "ativo", "arquivado"]),
});

export async function changeAulaStatus(
  input: z.infer<typeof transitionSchema>,
): Promise<{ avisoExtracao?: string; inseridas?: number }> {
  const { id, novoStatus } = transitionSchema.parse(input);
  const { supabase } = await requireAdmin();

  const { data: atual } = await supabase
    .from("aulas")
    .select("status")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("aulas").update({ status: novoStatus }).eq("id", id);
  if (error) throw new Error(`Falha na transição: ${error.message}`);

  // Disparou extração se passou pra ativo (independente de qual era antes)
  let avisoExtracao: string | undefined;
  let inseridas: number | undefined;
  if (novoStatus === "ativo" && atual?.status !== "ativo") {
    const r = await extractBoasPraticasFromAula(supabase, id);
    avisoExtracao = r.aviso;
    inseridas = r.inseridas;
  }

  revalidatePath(`/admin/aulas/${id}`);
  revalidatePath("/admin/aulas");
  revalidatePath("/admin/boas-praticas");
  return { avisoExtracao, inseridas };
}

export async function deleteAula(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("aulas").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
  revalidatePath("/admin/aulas");
  redirect("/admin/aulas");
}

function parseCsv(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
