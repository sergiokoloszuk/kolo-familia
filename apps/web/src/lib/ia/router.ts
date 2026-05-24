import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";

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
 * Roteamento semântico por IA (modelo leve) — escolhe os especialistas
 * por SENTIDO, não por palavra exata. Resolve a fragilidade do keyword
 * (frases naturais raramente batem os termos cadastrados, e o fallback
 * acabava sempre nas 2 skills de maior prioridade).
 *
 * Degradação graciosa: sem chave, erro do modelo, ou JSON inválido →
 * cai no routeSkills() por keyword/prioridade. Nunca trava o fluxo.
 */
export async function routeSkillsAI(
  input: string,
  skills: SkillRow[],
  options: { maxSkills?: number } = {},
): Promise<RoutedSkill[]> {
  const { maxSkills = 2 } = options;
  if (skills.length === 0) return [];
  if (skills.length === 1) {
    return [{ skill: skills[0], score: 100, matchedKeywords: [] }];
  }

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return routeSkills(input, skills, { maxSkills });
  }

  const catalogo = skills
    .map((s) => `- ${s.name}: ${s.display_name} — ${(s.scope || s.objective || "").slice(0, 160)}`)
    .join("\n");

  const system = `Você é o roteador de especialistas do Kolo Família. Dada a mensagem de um adulto responsável sobre uma criança neurodivergente, escolha de 1 a ${maxSkills} especialistas MAIS relevantes da lista, do mais relevante ao menos. Responda APENAS com JSON, sem texto antes/depois: {"skills":["name1","name2"]}. Use EXATAMENTE os identificadores (name) da lista. Não invente nomes.`;

  const user = `Especialistas disponíveis:
${catalogo}

Mensagem do adulto:
"""${input.slice(0, 2000)}"""

Quais especialistas? Responda só o JSON.`;

  let raw: string;
  try {
    const stream = client.messages.stream({
      model: MODELS.leve,
      max_tokens: 150,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const final = await stream.finalMessage();
    raw = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch {
    return routeSkills(input, skills, { maxSkills });
  }

  const names = parseSkillNames(raw);
  if (!names || names.length === 0) return routeSkills(input, skills, { maxSkills });

  const byName = new Map(skills.map((s) => [s.name, s]));
  const selecionadas: RoutedSkill[] = [];
  for (const n of names) {
    const sk = byName.get(n);
    if (sk && !selecionadas.some((x) => x.skill.name === n)) {
      selecionadas.push({ skill: sk, score: 100 - selecionadas.length, matchedKeywords: [] });
    }
    if (selecionadas.length >= maxSkills) break;
  }

  return selecionadas.length > 0
    ? selecionadas
    : routeSkills(input, skills, { maxSkills });
}

function parseSkillNames(s: string): string[] | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    try {
      candidate = JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  if (
    candidate &&
    typeof candidate === "object" &&
    Array.isArray((candidate as { skills?: unknown }).skills)
  ) {
    return (candidate as { skills: unknown[] }).skills.filter(
      (x): x is string => typeof x === "string",
    );
  }
  return null;
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
