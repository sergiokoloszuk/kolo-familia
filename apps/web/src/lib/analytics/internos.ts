import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Famílias INTERNAS (admin + analista de tráfego em co-acesso) — a EXCLUIR dos
 * dashboards, pra os números refletirem usuários de verdade. A Karina/Sérgio
 * testam muito e a agência mexe no painel; sem isso, "telas mais visitadas" e
 * afins ficam inflados pelo uso interno. Retorna o set de family_account_id
 * dos usuários internos (dono da própria conta).
 */
export async function familiasInternas(admin: SupabaseClient): Promise<Set<string>> {
  const [{ data: admins }, { data: analistas }] = await Promise.all([
    admin.from("controle_acessos").select("user_id").eq("ativo", true),
    admin.from("family_acessos").select("user_id").eq("ativo", true).not("user_id", "is", null),
  ]);

  const userIds = new Set<string>();
  for (const a of admins ?? []) if (a.user_id) userIds.add(a.user_id as string);
  for (const a of analistas ?? []) if (a.user_id) userIds.add(a.user_id as string);
  if (userIds.size === 0) return new Set();

  const { data: fams } = await admin
    .from("family_accounts")
    .select("id")
    .in("user_id", [...userIds]);
  return new Set((fams ?? []).map((f) => f.id as string));
}
