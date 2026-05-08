/**
 * Beta gate: valida e consome códigos de convite.
 *
 * Usa service role pra checar o convite (anon não vê beta_invites por
 * RLS). NUNCA loga o código completo — apenas hash visível.
 */

import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizarCodigo, validarFormatoCodigo } from "./codigos";

export type ValidacaoConvite =
  | { ok: true; invite_id: string; codigo: string }
  | { ok: false; motivo: string };

export async function validarConvite(
  rawCodigo: string,
): Promise<ValidacaoConvite> {
  const codigo = normalizarCodigo(rawCodigo);
  if (!validarFormatoCodigo(codigo)) {
    return { ok: false, motivo: "Código com formato inválido." };
  }

  const admin = createServiceRoleClient();
  const { data: invite } = await admin
    .from("beta_invites")
    .select("id, codigo, max_uses, uses_count, expira_em, revogado")
    .eq("codigo", codigo)
    .maybeSingle();

  if (!invite) return { ok: false, motivo: "Convite não encontrado." };
  if (invite.revogado)
    return { ok: false, motivo: "Convite revogado pelo administrador." };
  if (invite.expira_em && new Date(invite.expira_em as string) < new Date())
    return { ok: false, motivo: "Convite expirado." };
  if ((invite.uses_count as number) >= (invite.max_uses as number))
    return { ok: false, motivo: "Convite já atingiu o limite de usos." };

  return { ok: true, invite_id: invite.id as string, codigo };
}

/**
 * Consome o convite: cria registro em beta_invite_uses e incrementa
 * uses_count. Idempotente por (family_account_id) graças ao unique.
 */
export async function consumirConvite(params: {
  invite_id: string;
  family_account_id: string;
  user_id: string;
}): Promise<void> {
  const admin = createServiceRoleClient();

  // Insere idempotentemente (unique em family_account_id)
  const { error: errIns } = await admin.from("beta_invite_uses").insert({
    invite_id: params.invite_id,
    family_account_id: params.family_account_id,
    user_id: params.user_id,
  });
  // Se já existe, só ignora — significa que ela já consumiu antes
  if (errIns && !`${errIns.message}`.toLowerCase().includes("duplicate"))
    throw new Error(`Falha ao registrar uso: ${errIns.message}`);

  if (!errIns) {
    // Só incrementa se foi de fato um novo uso (RPC criada em 0008)
    const { error: errUpd } = await admin.rpc("increment_invite_uses", {
      p_invite_id: params.invite_id,
    });
    if (errUpd) {
      throw new Error(`Falha ao incrementar uses_count: ${errUpd.message}`);
    }
  }
}
