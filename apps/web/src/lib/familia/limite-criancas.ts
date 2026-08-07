import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * UMA CRIANÇA POR FAMÍLIA — regra de produto (Sérgio, 08/08/2026).
 *
 * Só contas administrativas têm mais de um membro atípico ATIVO. A regra
 * existia como intenção e nunca tinha sido construída: em 08/08/2026 havia duas
 * famílias não-admin com duas crianças (cadastradas sem nenhum obstáculo).
 *
 * ⚠️ VALE PARA CRIAÇÃO NOVA. Quem já tem duas continua com as duas, continua
 * lendo e editando normalmente — a trava não olha pra trás e não desativa
 * ninguém.
 *
 * CONTA SÓ MEMBRO ATIVO. Hoje não existe caminho de desativação de membro
 * atípico no app (o `togglePessoaAtiva` é de `pessoas_familia`, outra tabela),
 * então "ativo" e "todos" dão o mesmo número. Contar ativo é a escolha que
 * envelhece melhor: no dia em que desativar existir, uma família que cadastrou
 * a criança errada corrige sozinha, em vez de ficar travada pra sempre.
 */
export const LIMITE_CRIANCAS_NAO_ADMIN = 1;

export const MSG_LIMITE_CRIANCAS =
  "Neste momento, cada família pode cadastrar uma criança. O cadastro de mais de uma está disponível apenas para contas administrativas.";

/**
 * A família é de uma conta admin?
 *
 * Lê do BANCO (`family_accounts.user_id` → `controle_acessos.ativo`), não da
 * sessão — assim a mesma resposta vale para qualquer chamador: server action
 * com sessão, rota com service role, ou qualquer caminho futuro. É o que impede
 * a trava de depender de por onde a criação entrou.
 */
async function familiaEhAdmin(db: SupabaseClient, familyId: string): Promise<boolean> {
  const { data: fam } = await db
    .from("family_accounts")
    .select("user_id")
    .eq("id", familyId)
    .maybeSingle();
  const userId = (fam?.user_id as string | null) ?? null;
  if (!userId) return false;

  const { data: acesso } = await db
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", userId)
    .maybeSingle();
  return acesso?.ativo === true;
}

/**
 * Pode criar `novos` membros nesta família?
 *
 * Chamado ANTES do insert, em todo caminho de criação self-service. Devolve a
 * mensagem pronta pra tela em vez de um booleano: quem chama não deve ter que
 * saber redigir a recusa.
 */
export async function checarLimiteDeCriancas(
  db: SupabaseClient,
  params: { familyId: string; novos: number },
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  if (params.novos <= 0) return { ok: true };

  const { count } = await db
    .from("membros_atipicos")
    .select("id", { count: "exact", head: true })
    .eq("family_account_id", params.familyId)
    .eq("ativo", true);
  const jaTem = count ?? 0;

  if (jaTem + params.novos <= LIMITE_CRIANCAS_NAO_ADMIN) return { ok: true };
  if (await familiaEhAdmin(db, params.familyId)) return { ok: true };

  return { ok: false, mensagem: MSG_LIMITE_CRIANCAS };
}
