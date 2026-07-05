import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mapa family_account_id → e-mail de login (de auth.users), via service-role.
 *
 * Serve de FALLBACK pra identificar quem cadastrou mas ainda não preencheu o
 * nome (criou a conta e não terminou o onboarding — não há nome_mae no banco).
 * Assim o dashboard mostra o e-mail em vez de "#hash".
 *
 * listUsers pagina em até 1000 por página; hoje a base cabe numa página. Se
 * passar disso, paginar aqui.
 */
export async function emailsPorFamilia(
  admin: SupabaseClient,
): Promise<Map<string, string>> {
  const [{ data: fams }, usersRes] = await Promise.all([
    admin.from("family_accounts").select("id, user_id"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailByUser = new Map(
    (usersRes.data?.users ?? []).map((u) => [u.id, (u.email ?? "").trim()]),
  );

  const m = new Map<string, string>();
  for (const f of fams ?? []) {
    const uid = f.user_id as string | null;
    const email = uid ? emailByUser.get(uid) : null;
    if (email) m.set(f.id as string, email);
  }
  return m;
}
