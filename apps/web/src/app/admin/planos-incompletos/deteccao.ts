import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detecção dos planos AMPUTADOS já gravados em produção.
 *
 * Até 29/07/2026 o multi-call engolia falha por seção em silêncio: 18 de 60
 * planos foram salvos só com "entender + observar" (ou menos) — diagnóstico
 * sem nenhum "o que fazer" — e entregues como se estivessem completos. O
 * gerador agora barra isso na origem (guard em `lib/ia/plano.ts`); esta parte
 * cuida do passivo que já está no banco.
 *
 * A regra de "completo" tem que ser a MESMA do gerador, senão a tela mostra
 * pendência que não existe (ou esconde plano quebrado).
 */

/** Espelha SECOES_SEMPRE e MINIMO_PRATICAS do gerador. */
const PRATICAS = ["crencas", "diferente", "brincadeiras", "atividades", "frases"];
const MINIMO_PRATICAS = 3;

export type PlanoRow = {
  id: string;
  family_account_id: string;
  membro_atipico_id: string | null;
  conversa_id: string | null;
  titulo: string | null;
  tema: string | null;
  origem: string | null;
  created_at: string;
  secoes: unknown;
};

export type PlanoIncompleto = PlanoRow & { tipos: string[] };

function tiposDe(secoes: unknown): string[] {
  if (!Array.isArray(secoes)) return [];
  return secoes
    .map((s) => (s as { tipo?: unknown; conteudo_markdown?: unknown } | null) ?? {})
    .filter((s) => typeof s.conteudo_markdown === "string" && s.conteudo_markdown.trim())
    .map((s) => (typeof s.tipo === "string" ? s.tipo : ""))
    .filter(Boolean);
}

export function estaAmputado(secoes: unknown): boolean {
  // __erro__ é recado pra mãe, não conteúdo — pode vir sozinho (geração que
  // falhou) ou junto do plano (ajuste que não deu certo e devolveu o anterior).
  const tipos = tiposDe(secoes).filter((t) => t !== "__erro__");
  // Plano ainda "montando…" (secoes=[]) ou só com o recado: não é passivo
  // antigo, é geração em curso / já sinalizada pra mãe.
  if (tipos.length === 0) return false;
  return tipos.filter((t) => PRATICAS.includes(t)).length < MINIMO_PRATICAS;
}

/**
 * Varre os planos do fluxo multi-call (origem != fim_de_semana, que é
 * single-call e nunca teve o problema) e devolve os amputados, mais recentes
 * primeiro. Filtra em JS porque a contagem de seções mora dentro do jsonb.
 */
export async function listarPlanosAmputados(
  admin: SupabaseClient,
  limite = 500,
): Promise<PlanoIncompleto[]> {
  const { data } = await admin
    .from("planos")
    .select(
      "id, family_account_id, membro_atipico_id, conversa_id, titulo, tema, origem, created_at, secoes",
    )
    .neq("origem", "fim_de_semana")
    .order("created_at", { ascending: false })
    .limit(limite);

  return ((data ?? []) as PlanoRow[])
    .filter((p) => estaAmputado(p.secoes))
    .map((p) => ({ ...p, tipos: tiposDe(p.secoes) }));
}
