"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PreferenciasResult = { ok: true } | { ok: false; error: string };

export type Preferencias = {
  temas: string[];
  midia: string[];
  materiais: string[];
  musicas: string[];
};

const schema = z.object({
  membroId: z.string().uuid(),
  temas: z.array(z.string().trim().min(1)).max(30),
  midia: z.array(z.string().trim().min(1)).max(30),
  materiais: z.array(z.string().trim().min(1)).max(30),
  musicas: z.array(z.string().trim().min(1)).max(30),
});

export async function salvarPreferencias(
  input: z.infer<typeof schema>,
): Promise<PreferenciasResult> {
  try {
    const data = schema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };
    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!family) return { ok: false, error: "Família não inicializada." };

    // Confirma que o membro é da família (defesa dupla com RLS)
    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", data.membroId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Criança não encontrada." };

    // Mescla preferencias dentro de categorias_extras, sem perder outras chaves.
    const { data: atual } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", data.membroId)
      .maybeSingle();
    const extras =
      (atual?.categorias_extras as Record<string, unknown> | null) ?? {};
    const novasExtras = {
      ...extras,
      preferencias: {
        temas: data.temas,
        midia: data.midia,
        materiais: data.materiais,
        musicas: data.musicas,
      },
    };

    const { error } = await supabase
      .from("perfil_vivo_membro")
      .upsert(
        {
          membro_atipico_id: data.membroId,
          family_account_id: family.id,
          categorias_extras: novasExtras,
        },
        { onConflict: "membro_atipico_id" },
      );
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/preferencias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
