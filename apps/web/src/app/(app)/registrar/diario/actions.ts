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

const schema = z.object({
  membroAtipicoId: z.string().uuid().nullable(),
  data: z.string().date(),

  // Check-in leve
  escalaEmocionalMae: z.enum(ESCALA_EMOCIONAL),
  escalaEmocionalMembro: z.enum(ESCALA_EMOCIONAL).nullable().optional(),

  // Camada A
  conquista: z.string().trim().max(500).optional(),
  desafio: z.string().trim().max(500).optional(),
  observacaoLivre: z.string().trim().max(1000).optional(),
  possivelGatilho: z.string().trim().max(500).optional(),

  // Camada B
  quemEstava: z
    .enum(["mae", "pai", "avo_a", "avo_o", "irmao_a", "baba", "professor_a", "outro"])
    .nullable()
    .optional(),
  estadoAdulto: z
    .enum(["calmo", "firme", "cansado", "ansioso", "impaciente"])
    .nullable()
    .optional(),
  reacaoAdulto: z
    .enum(["acolhedor", "esperou", "interveio", "impositivo", "chamou_ajuda", "outro"])
    .nullable()
    .optional(),
});

export type RegistrarDiaInput = z.infer<typeof schema>;

export async function registrarDia(input: RegistrarDiaInput): Promise<void> {
  const data = schema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  // 1. Check-in diário (upsert por familyId + membro + data)
  await supabase.from("check_ins_diarios").upsert(
    {
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      escala_emocional_mae: data.escalaEmocionalMae,
      escala_emocional_membro: data.escalaEmocionalMembro ?? null,
      origem: "app",
    },
    { onConflict: "family_account_id,membro_atipico_id,data" },
  );

  // 2. Diário (só insere se houver alguma das 3 colunas A preenchida)
  const temCamadaA = Boolean(
    data.conquista?.trim() || data.desafio?.trim() || data.observacaoLivre?.trim(),
  );

  if (temCamadaA && data.membroAtipicoId) {
    const temCamadaB = Boolean(data.quemEstava || data.estadoAdulto || data.reacaoAdulto);
    const incompleto = Boolean(data.conquista || data.desafio) && !temCamadaB;

    await supabase.from("diarios").insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      conquista: data.conquista?.trim() || null,
      desafio: data.desafio?.trim() || null,
      observacao_livre: data.observacaoLivre?.trim() || null,
      possivel_gatilho: data.possivelGatilho?.trim() || null,
      quem_estava: data.quemEstava ?? null,
      estado_adulto: data.estadoAdulto ?? null,
      reacao_adulto: data.reacaoAdulto ?? null,
      origem: "app",
      incompleto,
    });
  }

  revalidatePath("/painel");
  revalidatePath("/registrar");
  revalidatePath("/registrar/diario");
}
