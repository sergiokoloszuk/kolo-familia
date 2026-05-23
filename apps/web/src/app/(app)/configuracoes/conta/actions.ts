"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, loadFamilyContext } from "@/lib/auth/require-user";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { logEvent, logServerError } from "@/lib/log";

export type PerfilResult = { ok: true } | { ok: false; error: string };

const perfilSchema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto").max(120, "Nome muito longo"),
  como_chamar: z.string().trim().max(60, "Apelido muito longo").optional(),
});

/**
 * Atualiza nome e apelido (como_chamar) do responsável. É o `como_chamar`
 * que alimenta o "Oi, {nome}" do painel e o nome na sidebar — daí
 * revalidar painel e layout do app.
 */
export async function salvarPerfilAction(
  input: z.infer<typeof perfilSchema>,
): Promise<PerfilResult> {
  try {
    const data = perfilSchema.parse(input);
    const { supabase, family } = await loadFamilyContext();
    if (!family) return { ok: false, error: "Família não inicializada." };

    const { error } = await supabase
      .from("family_profiles")
      .upsert(
        {
          family_account_id: family.id,
          nome_mae: data.nome_mae,
          como_chamar: data.como_chamar?.trim() ? data.como_chamar.trim() : null,
        },
        { onConflict: "family_account_id" },
      );
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/conta");
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const schema = z.object({
  confirmacao: z
    .string()
    .trim()
    .refine((s) => s === "EXCLUIR", {
      message: "Digite EXCLUIR (em maiúsculas) pra confirmar.",
    }),
});

/**
 * Exclui a conta da usuária — direito LGPD §18, V (eliminação).
 *
 * Ordem:
 *   1. Cancela subscription no Stripe se existir (best-effort — falha
 *      aqui não impede a deleção; evento fica em eventos_app).
 *   2. Deleta auth.users → cascateia para family_accounts e dependentes
 *      via ON DELETE CASCADE definido em 0001_init.sql.
 *   3. Loga evento.
 *
 * O fluxo é idempotente: chamar duas vezes não quebra (a segunda só
 * dispara unauthorized porque a sessão já caiu).
 */
export async function excluirContaAction(input: {
  confirmacao: string;
}): Promise<void> {
  const parsed = schema.parse(input);
  void parsed; // só pra validar

  const { user, supabase } = await requireUser();
  const { family } = await loadFamilyContext();
  const familyId = family?.id ?? null;

  // 1. Cancela subscription Stripe
  if (familyId) {
    const { data: sub } = await supabase
      .from("subscription_accesses")
      .select("stripe_subscription_id")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const subId = sub?.stripe_subscription_id as string | null;
    if (subId) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(subId);
      } catch (e) {
        await logServerError("excluir_conta_stripe", e, {
          family_account_id: familyId,
          user_id: user.id,
        });
      }
    }
  }

  // 2. Deleta o user — cascateia
  const admin = createServiceRoleClient();
  const { error: errDel } = await admin.auth.admin.deleteUser(user.id);
  if (errDel) {
    await logServerError("excluir_conta_delete_user", errDel, {
      user_id: user.id,
      family_account_id: familyId,
    });
    throw new Error(`Não consegui excluir agora: ${errDel.message}`);
  }

  await logEvent({
    kind: "conta_excluida",
    severity: "warn",
    user_id: user.id,
    family_account_id: familyId,
    message: "Usuária acionou exclusão de conta (LGPD).",
  });

  // 3. Encerra sessão e leva pra home
  await supabase.auth.signOut();
  redirect("/?conta_excluida=1");
}
