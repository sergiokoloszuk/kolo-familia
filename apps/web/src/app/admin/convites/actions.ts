"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { gerarCodigo } from "@/lib/beta/codigos";

const criarSchema = z.object({
  rotulo: z.string().trim().max(80).optional(),
  max_uses: z.coerce.number().int().min(1).max(500).default(1),
  expira_em_dias: z.coerce.number().int().min(1).max(365).optional(),
  quantidade: z.coerce.number().int().min(1).max(100).default(1),
  notas: z.string().trim().max(500).optional(),
});

export async function criarConvites(
  input: z.infer<typeof criarSchema>,
): Promise<{ codigos: string[] }> {
  const data = criarSchema.parse(input);
  const { user, supabase } = await requireAdmin();

  const expira_em = data.expira_em_dias
    ? new Date(
        Date.now() + data.expira_em_dias * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  const codigos: string[] = [];
  for (let i = 0; i < data.quantidade; i++) {
    // Loop curto: tenta até 5 vezes em caso de colisão
    let inserido = false;
    for (let tentativa = 0; tentativa < 5 && !inserido; tentativa++) {
      const codigo = gerarCodigo();
      const { error } = await supabase.from("beta_invites").insert({
        codigo,
        rotulo: data.rotulo ?? null,
        max_uses: data.max_uses,
        expira_em,
        criado_por_user_id: user.id,
        notas: data.notas ?? null,
      });
      if (!error) {
        codigos.push(codigo);
        inserido = true;
      } else if (!`${error.message}`.toLowerCase().includes("duplicate")) {
        throw new Error(`Falha ao criar convite: ${error.message}`);
      }
    }
    if (!inserido) {
      throw new Error("Não consegui gerar código único após 5 tentativas.");
    }
  }

  revalidatePath("/admin/convites");
  return { codigos };
}

export async function revogarConvite(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("beta_invites")
    .update({ revogado: true })
    .eq("id", id);
  if (error) throw new Error(`Falha ao revogar: ${error.message}`);
  revalidatePath("/admin/convites");
}

export async function reativarConvite(id: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("beta_invites")
    .update({ revogado: false })
    .eq("id", id);
  if (error) throw new Error(`Falha ao reativar: ${error.message}`);
  revalidatePath("/admin/convites");
}
