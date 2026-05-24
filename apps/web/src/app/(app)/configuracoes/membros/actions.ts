"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dataBrParaIso, idadeAnos } from "@/lib/idade";

export type AtualizarMembroResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  data_nascimento: z
    .string()
    .trim()
    .refine((v) => {
      const iso = dataBrParaIso(v);
      if (!iso) return false;
      const a = idadeAnos(iso);
      return a !== null && a >= 0 && a <= 120;
    }, "Informe uma data válida (dd/mm/aaaa)"),
  perfil: z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"]),
});

/**
 * Edita um membro atípico (nome, data de nascimento, perfil) já cadastrado.
 * Faltava uma forma de corrigir isso fora do onboarding — sem isso, uma data
 * digitada errada (ex.: a do responsável) ficava presa pra sempre.
 *
 * Escopo duplo: além do RLS, o update filtra por family_account_id do usuário,
 * então ninguém consegue editar membro de outra família.
 */
export async function atualizarMembro(
  input: z.infer<typeof schema>,
): Promise<AtualizarMembroResult> {
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

    const { error } = await supabase
      .from("membros_atipicos")
      .update({
        nome: data.nome,
        data_nascimento: dataBrParaIso(data.data_nascimento),
        perfil: data.perfil,
      })
      .eq("id", data.id)
      .eq("family_account_id", family.id);

    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/membros");
    revalidatePath("/painel");
    revalidatePath("/kolo-vivo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
