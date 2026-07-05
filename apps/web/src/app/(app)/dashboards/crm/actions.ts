"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ehAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type CrmActionResult = { ok: true } | { ok: false; error: string };

const excluirSchema = z.object({
  familyId: z.string().uuid(),
  motivo: z.string().trim().min(2, "Diga o porquê.").max(500),
});

/** Exclui um lead do radar com um motivo guardado (ex.: "é teste"). Reversível. */
export async function excluirLead(input: {
  familyId: string;
  motivo: string;
}): Promise<CrmActionResult> {
  try {
    if (!(await ehAdmin())) return { ok: false, error: "Só admin." };
    const { familyId, motivo } = excluirSchema.parse(input);
    const admin = createServiceRoleClient();
    const { error } = await admin.from("crm_leads").upsert(
      {
        family_account_id: familyId,
        excluido: true,
        excluido_motivo: motivo,
        excluido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "family_account_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboards/crm");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const scriptSchema = z.object({
  fase: z.string().min(2).max(40),
  textoAyla: z.string().max(2000),
  textoSugestao: z.string().max(2000),
});

/** Salva o roteiro de uma fase (Configuração): o que a Ayla faz + sugestão sua. */
export async function salvarFaseScript(input: {
  fase: string;
  textoAyla: string;
  textoSugestao: string;
}): Promise<CrmActionResult> {
  try {
    if (!(await ehAdmin())) return { ok: false, error: "Só admin." };
    const { fase, textoAyla, textoSugestao } = scriptSchema.parse(input);
    const admin = createServiceRoleClient();
    const { error } = await admin.from("crm_fase_scripts").upsert(
      {
        fase,
        texto_ayla: textoAyla,
        texto_sugestao: textoSugestao,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "fase" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboards/crm/config");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
