"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");
  return { supabase, user, family };
}

const ESCALA_EMOCIONAL = ["muito_bem", "bem", "neutro", "dificil", "muito_dificil"] as const;
const ESCALA_ENERGIA = ["cheia", "descansada", "razoavel", "cansada", "exausta"] as const;

const schema = z.object({
  membroAtipicoId: z.string().uuid().nullable(),
  semanaInicio: z.string().date(),
  emocionalMae: z.enum(ESCALA_EMOCIONAL),
  energiaMae: z.enum(ESCALA_ENERGIA),
  emocionalMembro: z.enum(ESCALA_EMOCIONAL).nullable().optional(),
  energiaMembro: z.enum(ESCALA_ENERGIA).nullable().optional(),
  comentario: z.string().trim().max(2000).optional(),
  oQueFariaDiferente: z.string().trim().max(2000).optional(),
});

export type SalvarSemanalInput = z.infer<typeof schema>;

export async function salvarCheckinSemanal(input: SalvarSemanalInput): Promise<void> {
  const data = schema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  const { data: row, error } = await supabase
    .from("check_ins_semanais")
    .insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      semana_inicio: data.semanaInicio,
      emocional_mae: data.emocionalMae,
      energia_mae: data.energiaMae,
      emocional_membro: data.emocionalMembro ?? null,
      energia_membro: data.energiaMembro ?? null,
      comentario: data.comentario || null,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`Falha ao salvar: ${error?.message}`);

  if (data.oQueFariaDiferente) {
    await supabase.from("reflexoes_semanais").insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      check_in_semanal_id: row.id,
      semana_inicio: data.semanaInicio,
      o_que_faria_diferente: data.oQueFariaDiferente,
    });
  }

  revalidatePath("/registrar");
  revalidatePath("/registrar/semanal");
  revalidatePath("/painel");
}
