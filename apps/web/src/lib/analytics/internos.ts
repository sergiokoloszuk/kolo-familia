import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Identifica marcações explícitas de teste/demonstração na atribuição.
 * Não usa apenas o nome da fonte: uma parceria real futura continua contando.
 */
export function atribuicaoEhTeste(row: {
  utm_source?: string | null;
  utm_campaign?: string | null;
}): boolean {
  const normalizar = (valor: string | null | undefined) =>
    (valor ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  const source = normalizar(row.utm_source);
  const campaign = normalizar(row.utm_campaign);

  return campaign.startsWith("teste") || source === "escalasaasgravacao";
}

/**
 * Famílias INTERNAS ou de TESTE — a EXCLUIR dos dashboards, pra os números
 * refletirem usuários de verdade. Inclui admin, analista em co-acesso e contas
 * cuja própria UTM declara teste/demonstração.
 */
export async function familiasInternas(admin: SupabaseClient): Promise<Set<string>> {
  const [{ data: admins }, { data: analistas }, { data: fams }] = await Promise.all([
    admin.from("controle_acessos").select("user_id").eq("ativo", true),
    admin.from("family_acessos").select("user_id").eq("ativo", true).not("user_id", "is", null),
    admin.from("family_accounts").select("id, user_id, utm_source, utm_campaign"),
  ]);

  const userIds = new Set<string>();
  for (const a of admins ?? []) if (a.user_id) userIds.add(a.user_id as string);
  for (const a of analistas ?? []) if (a.user_id) userIds.add(a.user_id as string);
  const internas = new Set<string>();
  for (const f of fams ?? []) {
    if (
      userIds.has(f.user_id as string) ||
      atribuicaoEhTeste({
        utm_source: f.utm_source as string | null,
        utm_campaign: f.utm_campaign as string | null,
      })
    ) {
      internas.add(f.id as string);
    }
  }
  return internas;
}
