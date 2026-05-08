"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

const aylaPrefsSchema = z.object({
  desativada: z.boolean(),
  horario_preferido_inicio: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  horario_preferido_fim: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  frequencia: z.enum(["diaria", "3x_semana", "semanal"]),
});

export type SalvarAylaPrefsInput = z.infer<typeof aylaPrefsSchema>;

export async function salvarAylaPrefs(input: SalvarAylaPrefsInput): Promise<void> {
  const data = aylaPrefsSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { error } = await supabase
    .from("ayla_preferences")
    .update({
      desativada: data.desativada,
      horario_preferido_inicio: `${data.horario_preferido_inicio}:00`,
      horario_preferido_fim: `${data.horario_preferido_fim}:00`,
      frequencia: data.frequencia,
    })
    .eq("family_account_id", family.id);
  if (error) throw new Error(`Falha ao salvar: ${error.message}`);

  revalidatePath("/configuracoes");
}

const optoutSchema = z.object({
  categoria: z.enum(["informacional", "promocional", "avaliacao"]),
  optar_out: z.boolean(),
});

export async function alterarOptOut(input: z.infer<typeof optoutSchema>): Promise<void> {
  const { categoria, optar_out } = optoutSchema.parse(input);
  const { supabase, family } = await requireFamily();

  if (optar_out) {
    await supabase
      .from("categorias_optout")
      .upsert(
        { family_account_id: family.id, categoria },
        { onConflict: "family_account_id,categoria" },
      );
  } else {
    await supabase
      .from("categorias_optout")
      .delete()
      .eq("family_account_id", family.id)
      .eq("categoria", categoria);
  }

  revalidatePath("/configuracoes");
}
