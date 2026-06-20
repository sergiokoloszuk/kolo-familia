"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };
type Admin = ReturnType<typeof createServiceRoleClient>;

async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Falha ao buscar usuários: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function minhaFamilia(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("family_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  rotulo: z.string().trim().max(80).optional().nullable(),
});

/**
 * Autoriza um e-mail a acessar a SUA conta (co-acesso). A pessoa se cadastra e
 * define a própria senha no 1º acesso; ao entrar, cai na sua conta. Se o e-mail
 * já tiver conta, o vínculo é imediato.
 */
export async function addCoAcesso(input: z.infer<typeof addSchema>): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const { email, rotulo } = addSchema.parse(input);
    const admin = createServiceRoleClient();

    const familyId = await minhaFamilia(admin, user.id);
    if (!familyId) return { ok: false, error: "Sua família não está inicializada." };

    const existingUserId = await findUserIdByEmail(admin, email);

    const { data: existing } = await admin
      .from("family_acessos")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("family_acessos")
        .update({ ativo: true, rotulo: rotulo || null, user_id: existingUserId })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from("family_acessos").insert({
        family_account_id: familyId,
        email,
        user_id: existingUserId,
        rotulo: rotulo || null,
        ativo: true,
      });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/co-acessos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Remove o co-acesso (a pessoa perde o acesso à sua conta na hora). */
export async function removeCoAcesso(input: { id: string }): Promise<ActionResult> {
  try {
    const { user } = await requireAdmin();
    const id = z.string().uuid().parse(input.id);
    const admin = createServiceRoleClient();

    const familyId = await minhaFamilia(admin, user.id);
    if (!familyId) return { ok: false, error: "Sua família não está inicializada." };

    const { error } = await admin
      .from("family_acessos")
      .delete()
      .eq("id", id)
      .eq("family_account_id", familyId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/co-acessos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export type CoAcessoRow = {
  id: string;
  email: string;
  rotulo: string | null;
  cadastrado: boolean;
};

/** Lista os co-acessos da conta do admin logado. */
export async function listCoAcessos(): Promise<CoAcessoRow[]> {
  const { user } = await requireAdmin();
  const admin = createServiceRoleClient();
  const familyId = await minhaFamilia(admin, user.id);
  if (!familyId) return [];

  const { data } = await admin
    .from("family_acessos")
    .select("id, email, rotulo, user_id, created_at")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    rotulo: (r.rotulo as string | null) ?? null,
    cadastrado: Boolean(r.user_id),
  }));
}
