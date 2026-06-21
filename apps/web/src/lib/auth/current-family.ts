import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a família ATIVA do usuário logado pela MESMA função do RLS
 * (`current_family_account_id`): dono → a própria família; co-acesso ativo → a
 * família vinculada (co-parente).
 *
 * Devolve no MESMO shape de um `.select("id")...maybeSingle()` do supabase
 * (`{ data: { id } | null }`), pra ser DROP-IN onde antes se consultava
 * `family_accounts` por `user_id`. Para o dono o resultado é idêntico ao de
 * antes — então trocar não muda nada pra usuários comuns; só faz o co-acesso
 * agir na conta certa.
 *
 * Use em ações de CONTEÚDO da família. NÃO usar em fluxos só-do-dono
 * (onboarding, assinatura/billing, exportar LGPD, aceitar termos, admin).
 */
export async function resolveFamily(
  supabase: SupabaseClient,
): Promise<{ data: { id: string } | null }> {
  const { data } = await supabase.rpc("current_family_account_id");
  return { data: data ? { id: data as string } : null };
}
