import type { SkillDoCatalogo } from "./intent";

/**
 * O CATÁLOGO DO CLASSIFICADOR — só as skills LIGADAS, só nome e keywords.
 *
 * Vive fora de `intent.ts` de propósito. Aquele módulo é classificação pura:
 * texto entra, quatro campos saem, e `entrega.test.ts` trava isso com
 * `expect(INTENT).not.toMatch(/from\("/)` — a garantia, de 02/08, de que o tema
 * ativo não trouxe dependência de banco junto. Somar um `select` lá dentro
 * quebraria essa propriedade por conveniência.
 *
 * `ativo=false` não chega ao prompt, então uma skill desligada não tem como ser
 * roteada pra família real. É a trava na origem: não depende de ninguém lembrar
 * de filtrar depois.
 *
 * Cacheado em memória por 5 minutos porque isto roda a cada mensagem e a lista
 * muda uma vez por mês. Não é chamada de LLM — é um select de duas colunas —
 * mas somar uma ida ao banco por turno no caminho mais quente do produto seria
 * pagar caro por um dado praticamente estático.
 */
let _cache: { em: number; skills: SkillDoCatalogo[] } | null = null;
const TTL_MS = 5 * 60_000;

export async function carregarCatalogoSkills(
  supabase: { from: (t: string) => any },
): Promise<SkillDoCatalogo[]> {
  if (_cache && Date.now() - _cache.em < TTL_MS) return _cache.skills;
  try {
    const { data, error } = await supabase
      .from("specialist_prompt_templates")
      .select("name, routing_keywords")
      .eq("ativo", true);
    if (error) throw new Error(error.message);
    const skills = ((data ?? []) as Array<{ name: string; routing_keywords: unknown }>)
      .map((s) => ({
        name: String(s.name),
        routing_keywords: Array.isArray(s.routing_keywords)
          ? (s.routing_keywords as unknown[]).map(String)
          : [],
      }))
      .filter((s) => s.name);
    _cache = { em: Date.now(), skills };
    return skills;
  } catch (e) {
    console.warn("[ayla:catalogo] skills não carregaram:", e instanceof Error ? e.message : e);
    // Sem catálogo o classificador segue funcionando e devolve `skills: []` —
    // a conversa não pode parar porque a lista de skills não carregou.
    return [];
  }
}
