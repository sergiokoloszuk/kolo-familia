import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Skill carregada do banco com os campos que o roteador precisa.
 */
export type SkillRow = {
  id: string;
  name: string;
  display_name: string;
  objective: string;
  tone: string;
  scope: string;
  limits: string;
  kolo_vivo_fields: string[];
  knowledge_tags: string[];
  routing_keywords: string[];
  routing_priority: number;
  fallback_questions: string[];
};

export type RoutedSkill = {
  skill: SkillRow;
  score: number;
  matchedKeywords: string[];
};

/**
 * Roteamento por contexto — PRD §7.4.1.
 *
 * Algoritmo simples para a primeira versão:
 *   score = (keywords matched) × 10 + routing_priority × 0.1
 * Skills com score ≥ threshold entram. Pelo menos 1 skill sempre é
 * retornada (fallback: priorizada por routing_priority).
 *
 * Próximas iterações podem trocar por router IA-based (Haiku) quando
 * keywords forem ambíguas.
 */
export function routeSkills(
  input: string,
  skills: SkillRow[],
  options: { maxSkills?: number; minScore?: number } = {},
): RoutedSkill[] {
  const { maxSkills = 2, minScore = 5 } = options;
  const lower = input.toLowerCase();

  const scored: RoutedSkill[] = skills.map((skill) => {
    const matched = skill.routing_keywords.filter((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    const score = matched.length * 10 + skill.routing_priority * 0.1;
    return { skill, score, matchedKeywords: matched };
  });

  scored.sort((a, b) => b.score - a.score);

  const selecionadas = scored.filter((s) => s.score >= minScore).slice(0, maxSkills);

  if (selecionadas.length > 0) return selecionadas;

  // Fallback: skill de maior routing_priority. Garante que sempre tem
  // alguém respondendo, mesmo em input vago.
  return scored.slice(0, 1);
}

/**
 * Carrega skills ativas do banco. Usado pelo engine antes de rotear.
 */
export async function loadActiveSkills(
  supabase: SupabaseClient,
): Promise<SkillRow[]> {
  const { data, error } = await supabase
    .from("specialist_prompt_templates")
    .select(
      "id, name, display_name, objective, tone, scope, limits, kolo_vivo_fields, knowledge_tags, routing_keywords, routing_priority, fallback_questions",
    )
    .eq("ativo", true);

  if (error) throw new Error(`Falha ao carregar skills: ${error.message}`);
  return (data ?? []) as SkillRow[];
}
