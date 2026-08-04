import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PARA ONDE UM LINK DA AYLA PODE LEVAR.
 *
 * Antes, `destinoSeguro` aceitava qualquer caminho começando com "/". Isso
 * bloqueia open redirect externo — que é o risco grave — mas deixa passar rota
 * interna inexistente, e aí a família cai num 404 depois de clicar num link que
 * a Ayla prometeu.
 *
 * A allowlist é por PREFIXO, não por rota exata: `/planos/{id}` e
 * `/ludico/rotinas/{id}` têm id variável, e listar cada um seria impossível.
 */

/** Os únicos destinos que um link de acesso pode ter. */
const PERMITIDOS: readonly RegExp[] = [
  /^\/painel$/,
  /^\/estrategias$/,
  /^\/assinatura$/,
  /^\/precos$/,
  /^\/configuracoes(\/[a-z-]+)?$/,
  /^\/evolucao(\/(registros|relatorio))?$/,
  /^\/historias(\/criar)?$/,
  /^\/ludico$/,
  /^\/ludico\/(desenhos|meditacao|timer)$/,
  /^\/ludico\/rotinas$/,
  /^\/ludico\/rotinas\/semana$/,
  /^\/ludico\/rotinas\/[0-9a-f-]{36}$/,
  /^\/planos$/,
  /^\/planos\/[0-9a-f-]{36}$/,
];

/** Quando o destino pedido não serve, cada área tem uma volta decente. */
const FALLBACK: ReadonlyArray<[RegExp, string]> = [
  [/^\/planos/, "/planos"],
  [/^\/ludico\/rotinas/, "/ludico/rotinas"],
  [/^\/ludico/, "/ludico"],
  [/^\/evolucao/, "/evolucao"],
  [/^\/historias/, "/historias"],
];

export const DESTINO_PADRAO = "/painel";

/** O caminho está na allowlist? */
export function destinoPermitido(destino: string): boolean {
  const d = (destino ?? "").trim();
  if (!d.startsWith("/") || d.startsWith("//")) return false;
  const semQuery = d.split(/[?#]/)[0];
  return PERMITIDOS.some((re) => re.test(semQuery));
}

/** O destino, ou a volta mais próxima que existe. Nunca devolve algo inválido. */
export function normalizarDestino(destino: string | null | undefined): string {
  const d = (destino ?? "").trim();
  if (destinoPermitido(d)) return d;
  const area = FALLBACK.find(([re]) => re.test(d));
  return area ? area[1] : DESTINO_PADRAO;
}

/**
 * O ARTEFATO NO DESTINO É MESMO DESTA FAMÍLIA?
 *
 * Um token é de uma família; o `{id}` dentro do destino não era conferido por
 * ninguém. Sem isto, um id trocado (por erro ou de propósito) abriria o plano
 * ou a rotina de outra família com uma sessão legítima.
 *
 * Devolve o destino quando está tudo certo, ou a volta segura da área quando
 * o artefato não existe ou não é dela. Em erro de consulta devolve o fallback
 * — negar o acesso é melhor que abrir o que não se conferiu.
 */
export async function destinoDaFamilia(
  supabase: SupabaseClient,
  params: { destino: string; familyId: string },
): Promise<string> {
  const destino = normalizarDestino(params.destino);

  const plano = destino.match(/^\/planos\/([0-9a-f-]{36})$/);
  const rotina = destino.match(/^\/ludico\/rotinas\/([0-9a-f-]{36})$/);
  if (!plano && !rotina) return destino;

  const tabela = plano ? "planos" : "rotinas";
  const id = (plano ?? rotina)![1];
  try {
    const { data, error } = await supabase
      .from(tabela)
      .select("id")
      .eq("id", id)
      .eq("family_account_id", params.familyId)
      .maybeSingle();
    if (error || !data) {
      console.warn(
        `[auth:wa] destino recusado — ${tabela}/${id} não é da família ${params.familyId}`,
      );
      return plano ? "/planos" : "/ludico/rotinas";
    }
    return destino;
  } catch {
    return plano ? "/planos" : "/ludico/rotinas";
  }
}
