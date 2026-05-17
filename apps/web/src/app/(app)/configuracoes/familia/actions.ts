"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const PAPEIS = [
  "mae",
  "pai",
  "avo_a",
  "avo_o",
  "irmao_a",
  "padrasto",
  "madrasta",
  "tio_a",
  "baba",
  "professor_a",
  "terapeuta",
  "medico",
  "amigo_da_familia",
  "outro",
] as const;

const FREQUENCIAS = ["diaria", "semanal", "mensal", "rara", "unica"] as const;
const TIPOS_CUIDADO = [
  "principal",
  "apoio_frequente",
  "apoio_esporadico",
  "neutro",
  "tira_de_cena",
  "opositor",
] as const;

const pessoaSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Nome muito curto"),
  apelido: z.string().trim().optional(),
  papel: z.enum(PAPEIS),
  papel_livre: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  coabitante: z.boolean(),
  frequencia_contato: z.enum(FREQUENCIAS).optional(),
});

async function familyId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) throw new Error("Família não encontrada");
  return family.id as string;
}

export async function savePessoa(
  input: z.infer<typeof pessoaSchema>,
): Promise<ActionResult> {
  try {
    const data = pessoaSchema.parse(input);
    const supabase = await createClient();
    const fid = await familyId();

    if (data.id) {
      const { error } = await supabase
        .from("pessoas_familia")
        .update({
          nome: data.nome,
          apelido: data.apelido ?? null,
          papel: data.papel,
          papel_livre: data.papel_livre ?? null,
          observacoes: data.observacoes ?? null,
          coabitante: data.coabitante,
          frequencia_contato: data.frequencia_contato ?? null,
        })
        .eq("id", data.id)
        .eq("family_account_id", fid);
      if (error) return { ok: false, error: `Falha ao atualizar: ${error.message}` };
      revalidatePath("/configuracoes/familia");
      return { ok: true, id: data.id };
    }

    const { data: created, error } = await supabase
      .from("pessoas_familia")
      .insert({
        family_account_id: fid,
        nome: data.nome,
        apelido: data.apelido ?? null,
        papel: data.papel,
        papel_livre: data.papel_livre ?? null,
        observacoes: data.observacoes ?? null,
        coabitante: data.coabitante,
        frequencia_contato: data.frequencia_contato ?? null,
        ativo: true,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Falha ao criar: ${error.message}` };
    revalidatePath("/configuracoes/familia");
    return { ok: true, id: created.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function togglePessoaAtiva(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const fid = await familyId();
    const { error } = await supabase
      .from("pessoas_familia")
      .update({ ativo })
      .eq("id", id)
      .eq("family_account_id", fid);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/configuracoes/familia");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

const papelCuidadoSchema = z.object({
  pessoa_familia_id: z.string().uuid(),
  membro_atipico_id: z.string().uuid(),
  tipo_cuidado: z.enum(TIPOS_CUIDADO),
  observacoes: z.string().trim().optional(),
});

export async function setPapelCuidado(
  input: z.infer<typeof papelCuidadoSchema>,
): Promise<ActionResult> {
  try {
    const data = papelCuidadoSchema.parse(input);
    const supabase = await createClient();
    // RLS já garante que pessoa_familia pertence à família do usuário
    const { error } = await supabase
      .from("papeis_cuidado")
      .upsert(
        {
          pessoa_familia_id: data.pessoa_familia_id,
          membro_atipico_id: data.membro_atipico_id,
          tipo_cuidado: data.tipo_cuidado,
          observacoes: data.observacoes ?? null,
        },
        { onConflict: "pessoa_familia_id,membro_atipico_id" },
      );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/configuracoes/familia");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function removePapelCuidado(
  pessoa_familia_id: string,
  membro_atipico_id: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("papeis_cuidado")
      .delete()
      .eq("pessoa_familia_id", pessoa_familia_id)
      .eq("membro_atipico_id", membro_atipico_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/configuracoes/familia");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
