"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ehAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["nova", "respondida", "implementar", "arquivada"]),
});

export type StatusResult = { ok: true } | { ok: false; error: string };

/** Muda o status de um feedback (implementar / arquivada / respondida). Só admin. */
export async function atualizarStatusFeedback(input: {
  id: string;
  status: "nova" | "respondida" | "implementar" | "arquivada";
}): Promise<StatusResult> {
  try {
    if (!(await ehAdmin())) return { ok: false, error: "Só admin pode mexer." };
    const { id, status } = schema.parse(input);
    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("feedbacks")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboards/feedback");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
