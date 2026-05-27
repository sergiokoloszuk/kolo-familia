"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Boas-vindas (Sprint A): mãe escolhe a janela de WhatsApp e marca que viu a
 * tela. Depois disso, /boas-vindas redireciona pro /painel — a tela só
 * aparece uma vez na vida da família.
 *
 * Janelas mapeiam pra horario_preferido_inicio/fim em ayla_preferences
 * (defaults da tabela são 19:00–21:00; aqui sobrescrevemos com a escolha).
 */

const JANELAS = {
  manha: { inicio: "08:00", fim: "10:00" },
  meio_dia: { inicio: "12:00", fim: "14:00" },
  tarde: { inicio: "15:00", fim: "17:00" },
  noite: { inicio: "19:00", fim: "21:00" },
} as const;

export type JanelaKey = keyof typeof JANELAS;

const schema = z.object({
  janela: z.enum(["manha", "meio_dia", "tarde", "noite"]),
});

export type SalvarBoasVindasResult = { ok: true } | { ok: false; error: string };

export async function salvarBoasVindas(
  input: z.infer<typeof schema>,
): Promise<SalvarBoasVindasResult> {
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

    const janela = JANELAS[data.janela];

    // Upsert das preferências da Ayla (linha pode não existir ainda).
    const { error: errPref } = await supabase
      .from("ayla_preferences")
      .upsert(
        {
          family_account_id: family.id,
          horario_preferido_inicio: janela.inicio,
          horario_preferido_fim: janela.fim,
        },
        { onConflict: "family_account_id" },
      );
    if (errPref) return { ok: false, error: `Não consegui salvar a janela: ${errPref.message}` };

    // Marca que a tela foi vista — agora /boas-vindas redireciona /painel.
    const { error: errFam } = await supabase
      .from("family_accounts")
      .update({ boas_vindas_vista_at: new Date().toISOString() })
      .eq("id", family.id);
    if (errFam) return { ok: false, error: `Não consegui marcar boas-vindas: ${errFam.message}` };

    revalidatePath("/painel");
    revalidatePath("/boas-vindas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Atalho usado pelo botão "pular por enquanto" — marca como vista sem
 * mudar horário (mantém o default 19-21). Pra não travar quem só quer
 * passar reto na primeira vez.
 */
export async function pularBoasVindas(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) return;

  await supabase
    .from("family_accounts")
    .update({ boas_vindas_vista_at: new Date().toISOString() })
    .eq("id", family.id);
  revalidatePath("/painel");
  redirect("/painel");
}
