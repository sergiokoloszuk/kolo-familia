"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sincronizarAssinaturaDoStripe } from "@/lib/stripe/sync";

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

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  // null = vitalícia; número = dias a partir de agora.
  dias: z.number().int().min(1).max(3650).nullable(),
});

/**
 * Concede cortesia (acesso comp) a uma conta pelo e-mail. dias=null = vitalícia.
 * A pessoa precisa já ter conta (ela define a própria senha ao se cadastrar).
 */
export async function grantCortesia(input: z.infer<typeof grantSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { email, dias } = grantSchema.parse(input);
    const admin = createServiceRoleClient();

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) {
      return {
        ok: false,
        error: `Ninguém com o e-mail '${email}' tem conta ainda. Peça pra criar a conta (a pessoa define a senha) e conceda depois.`,
      };
    }
    const { data: fam } = await admin
      .from("family_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!fam) return { ok: false, error: "Conta sem família inicializada." };

    const ate = dias ? new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString() : null;

    const { data: sub } = await admin
      .from("subscription_accesses")
      .select("family_account_id")
      .eq("family_account_id", fam.id)
      .maybeSingle();
    if (sub) {
      const { error } = await admin
        .from("subscription_accesses")
        .update({ cortesia: true, cortesia_ate: ate })
        .eq("family_account_id", fam.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin
        .from("subscription_accesses")
        .insert({ family_account_id: fam.id, status: "trialing", cortesia: true, cortesia_ate: ate });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/cortesias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido");

/** Remove a cortesia (volta a valer status/trial/Stripe normais). */
export async function revokeCortesia(input: { email: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const email = emailSchema.parse(input.email);
    const admin = createServiceRoleClient();

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) return { ok: false, error: "Usuário não encontrado." };
    const { data: fam } = await admin
      .from("family_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!fam) return { ok: false, error: "Família não encontrada." };

    const { error } = await admin
      .from("subscription_accesses")
      .update({ cortesia: false, cortesia_ate: null })
      .eq("family_account_id", fam.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/cortesias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Re-sincroniza a assinatura da conta com o Stripe (fonte da verdade). Conserta
 * o descompasso quando o webhook não chegou (ex.: pagou no Stripe mas o app ficou
 * em past_due). NÃO inventa nada — só reflete o que o Stripe diz.
 */
export async function sincronizarStripe(
  input: { email: string },
): Promise<{ ok: true; resumo: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const email = emailSchema.parse(input.email);
    const admin = createServiceRoleClient();

    const userId = await findUserIdByEmail(admin, email);
    if (!userId) return { ok: false, error: `Ninguém com o e-mail '${email}' tem conta.` };
    const { data: fam } = await admin
      .from("family_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!fam) return { ok: false, error: "Conta sem família inicializada." };

    const r = await sincronizarAssinaturaDoStripe(admin, fam.id as string);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath("/admin/cortesias");
    const seta = r.mudou ? `${r.antes ?? "—"} → ${r.depois}` : `${r.depois} (já estava certo)`;
    return { ok: true, resumo: `Stripe: "${r.stripeStatus}" · App: ${seta}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export type CortesiaRow = { email: string; ate: string | null };

/** Lista as cortesias ativas, com o e-mail de cada conta. */
export async function listarCortesias(): Promise<CortesiaRow[]> {
  await requireAdmin();
  const admin = createServiceRoleClient();

  const { data: subs } = await admin
    .from("subscription_accesses")
    .select("family_account_id, cortesia_ate")
    .eq("cortesia", true);
  if (!subs || subs.length === 0) return [];

  const { data: fams } = await admin
    .from("family_accounts")
    .select("id, user_id")
    .in(
      "id",
      subs.map((s) => s.family_account_id as string),
    );
  const userByFam = new Map((fams ?? []).map((f) => [f.id as string, f.user_id as string]));

  const emailByUser = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    for (const u of data.users) if (u.email) emailByUser.set(u.id, u.email);
    if (data.users.length < 200) break;
  }

  return subs
    .map((s) => ({
      ate: (s.cortesia_ate as string | null) ?? null,
      email: emailByUser.get(userByFam.get(s.family_account_id as string) ?? "") ?? "(sem e-mail)",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
