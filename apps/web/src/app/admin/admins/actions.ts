"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ROLES = ["admin_geral", "admin_conteudo", "admin_suporte"] as const;
export type AdminRole = (typeof ROLES)[number];

const addAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(ROLES),
});

/**
 * Adiciona um admin pelo email. O usuário precisa já existir em
 * auth.users (signup feito) — não pré-cria conta.
 */
export async function addAdmin(input: z.infer<typeof addAdminSchema>): Promise<void> {
  const { email, role } = addAdminSchema.parse(input);
  await requireAdmin();

  const admin = createServiceRoleClient();

  let userId: string | null = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao buscar usuários: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) { userId = found.id; break; }
    if (data.users.length < 200) break;
  }
  if (!userId) {
    throw new Error(`Nenhum usuário com email '${email}'. Peça para fazer signup primeiro.`);
  }

  const { error } = await admin
    .from("controle_acessos")
    .upsert(
      { user_id: userId, role, ativo: true },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`Falha ao gravar: ${error.message}`);

  revalidatePath("/admin/admins");
}

export async function setAdminAtivo(userId: string, ativo: boolean): Promise<void> {
  const { user } = await requireAdmin();
  if (userId === user.id && !ativo) {
    throw new Error("Você não pode desativar a si mesmo.");
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("controle_acessos")
    .update({ ativo })
    .eq("user_id", userId);
  if (error) throw new Error(`Falha: ${error.message}`);

  revalidatePath("/admin/admins");
}

export async function setAdminRole(userId: string, role: AdminRole): Promise<void> {
  if (!ROLES.includes(role)) throw new Error("Cargo inválido.");
  await requireAdmin();

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("controle_acessos")
    .update({ role })
    .eq("user_id", userId);
  if (error) throw new Error(`Falha: ${error.message}`);

  revalidatePath("/admin/admins");
}
