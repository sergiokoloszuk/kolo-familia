"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, loadFamilyContext } from "@/lib/auth/require-user";

const schema = z.object({
  nps: z.coerce.number().int().min(0).max(10),
  comentario: z.string().trim().max(1000).optional(),
  contexto: z.enum(["d7", "d30", "manual"]).default("manual"),
});

export async function enviarFeedbackNps(
  input: z.infer<typeof schema>,
): Promise<void> {
  const data = schema.parse(input);
  const { user } = await requireUser();
  const { supabase, family } = await loadFamilyContext();
  if (!family) throw new Error("Sem família ainda.");

  const { error } = await supabase.from("feedback_beta").insert({
    family_account_id: family.id,
    user_id: user.id,
    nps: data.nps,
    comentario: data.comentario ?? null,
    contexto: data.contexto,
  });
  if (error) throw new Error(`Falha ao enviar: ${error.message}`);
  revalidatePath("/painel");
}
