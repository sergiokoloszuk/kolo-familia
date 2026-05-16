"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ROLES = ["admin_geral", "admin_conteudo", "admin_suporte"] as const;
export type AdminRole = (typeof ROLES)[number];

export type ActionResult = { ok: true } | { ok: false; error: string };

const addAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(ROLES),
});

/**
 * Adiciona um admin pelo email. O usuário precisa já existir em
 * auth.users (signup feito) — não pré-cria conta.
 *
 * Retorna Result em vez de lançar erro porque Server Actions do Next 16
 * em produção mascaram exceptions com mensagem genérica de segurança.
 */
export async function addAdmin(
  input: z.infer<typeof addAdminSchema>,
): Promise<ActionResult> {
  try {
    const parsed = addAdminSchema.parse(input);
    await requireAdmin();

    const admin = createServiceRoleClient();

    let userId: string | null = null;
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return { ok: false, error: `Falha ao buscar usuários: ${error.message}` };
      const found = data.users.find((u) => u.email?.toLowerCase() === parsed.email);
      if (found) { userId = found.id; break; }
      if (data.users.length < 200) break;
    }
    if (!userId) {
      return {
        ok: false,
        error: `Nenhum usuário com email '${parsed.email}'. Peça para fazer signup primeiro.`,
      };
    }

    const { error } = await admin
      .from("controle_acessos")
      .upsert(
        { user_id: userId, role: parsed.role, ativo: true },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false, error: `Falha ao gravar: ${error.message}` };

    revalidatePath("/admin/admins");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function setAdminAtivo(
  userId: string,
  ativo: boolean,
): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    if (userId === user.id && !ativo) {
      return { ok: false, error: "Você não pode desativar a si mesmo." };
    }

    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("controle_acessos")
      .update({ ativo })
      .eq("user_id", userId);
    if (error) return { ok: false, error: `Falha: ${error.message}` };

    revalidatePath("/admin/admins");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function setAdminRole(
  userId: string,
  role: AdminRole,
): Promise<ActionResult> {
  try {
    if (!ROLES.includes(role)) {
      return { ok: false, error: "Cargo inválido." };
    }
    await requireAdmin();

    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("controle_acessos")
      .update({ role })
      .eq("user_id", userId);
    if (error) return { ok: false, error: `Falha: ${error.message}` };

    revalidatePath("/admin/admins");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
