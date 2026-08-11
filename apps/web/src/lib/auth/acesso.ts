import type { SupabaseClient } from "@supabase/supabase-js";
import { assinaturaLiberada } from "./assinatura";

/**
 * "ESTA FAMÍLIA PODE USAR O PRODUTO?" — a pergunta, num lugar só.
 *
 * ⚠️ POR QUE ESTE MÓDULO EXISTE — incidente da Rosangela, 10/08/2026.
 *
 * A resposta era montada em CINCO lugares, e duas cópias envelheceram:
 *
 *   painel web (`(app)/layout.tsx`) ............... isenta staff  ✅
 *   escrita na web (`require-active-write.ts`) .... isenta staff  ✅
 *   conversa WhatsApp (`aylaServicoLiberado`) ..... isenta staff  ✅
 *   proativas do cron (`filtrarComAcesso`) ........ NÃO isentava  ❌
 *   regras de engajamento (`ayla/rules.ts`) ....... NÃO isentava  ❌
 *
 * O efeito foi exatamente a fresta entre as duas metades: os três primeiros
 * decidem se a Ayla ATENDE quem procurou; os dois últimos decidem se ela
 * PROCURA alguém. Uma operadora com `controle_acessos.ativo` e trial vencido
 * era atendida sempre e procurada nunca — parou de receber a mensagem diária
 * no dia exato do vencimento, sem que nada no sistema acusasse.
 *
 * ⚠️ QUEM NÃO DEVE USAR ISTO: a reconciliação do Stripe
 * (`lib/stripe/reconciliacao.ts`). Ela pergunta "o Stripe e a Kolo divergem?",
 * não "esta pessoa pode usar?" — isentar staff ali cegaria justamente o
 * mecanismo que precisa enxergar todo mundo. Ela continua chamando
 * `assinaturaLiberada` direto, e isso é correto.
 *
 * O que NÃO muda: `assinaturaLiberada` continua pura, sem banco, sendo a regra
 * de assinatura. Aqui só se acrescenta a camada de staff em volta dela.
 */

/**
 * A pessoa é staff da Kolo (admin ou agência)? Qualquer linha ATIVA em
 * `controle_acessos` vale — o produto não distingue níveis para efeito de
 * acesso, só para o que aparece no painel.
 */
export async function ehStaffPorUserId(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("controle_acessos")
    .select("ativo")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.ativo);
}

/**
 * A família pertence a alguém da equipe?
 *
 * Staff usa o produto de verdade — é assim que se testa o que as famílias
 * recebem. Sem isto, quem opera a Kolo vive uma versão pela metade do que
 * está avaliando.
 */
export async function familiaEhDeStaff(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<boolean> {
  const { data: fam } = await supabase
    .from("family_accounts")
    .select("user_id")
    .eq("id", familyAccountId)
    .maybeSingle();
  return ehStaffPorUserId(supabase, (fam?.user_id as string | null) ?? null);
}

/**
 * A VERSÃO EM LOTE — para o cron, que decide sobre dezenas de famílias por
 * execução. Uma consulta por família seria N idas ao banco a cada ciclo; aqui
 * são duas, independentemente do tamanho da lista.
 */
export async function familiasDeStaff(
  supabase: SupabaseClient,
  familyAccountIds: readonly string[],
): Promise<Set<string>> {
  if (familyAccountIds.length === 0) return new Set();
  const { data: fams } = await supabase
    .from("family_accounts")
    .select("id, user_id")
    .in("id", familyAccountIds as string[]);
  const porUser = new Map<string, string>();
  for (const f of (fams ?? []) as Array<{ id: string; user_id: string | null }>) {
    if (f.user_id) porUser.set(f.user_id, f.id);
  }
  if (porUser.size === 0) return new Set();
  const { data: staff } = await supabase
    .from("controle_acessos")
    .select("user_id, ativo")
    .in("user_id", [...porUser.keys()]);
  const saida = new Set<string>();
  for (const s of (staff ?? []) as Array<{ user_id: string; ativo: boolean | null }>) {
    const fid = s.ativo ? porUser.get(s.user_id) : undefined;
    if (fid) saida.add(fid);
  }
  return saida;
}

/**
 * A RESPOSTA COMPLETA: staff, cortesia, assinante ou trial dentro do prazo.
 *
 * FAIL CLOSED no que importa: sem linha de assinatura e sem staff, devolve
 * `false`. A dúvida resolve para o lado de quem já está funcionando — ninguém
 * ganha acesso por ausência de dado.
 */
export async function acessoLiberado(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<boolean> {
  if (await familiaEhDeStaff(supabase, familyAccountId)) return true;
  const { data } = await supabase
    .from("subscription_accesses")
    .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
    .eq("family_account_id", familyAccountId)
    .maybeSingle();
  return assinaturaLiberada(data);
}
