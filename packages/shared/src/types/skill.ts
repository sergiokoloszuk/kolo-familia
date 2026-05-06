import { z } from "zod";

/**
 * SpecialistPromptTemplate — PRD §7.4.5
 *
 * Identidade da skill no banco. Visual fica no frontend, separado.
 */
export const SpecialistPromptTemplate = z.object({
  id: z.string().uuid(),
  name: z.string(),
  objective: z.string(),
  tone: z.string(),
  scope: z.string(),
  limits: z.string(),
  kolo_vivo_fields: z.array(z.string()),
  knowledge_tags: z.array(z.string()),
  routing_keywords: z.array(z.string()),
  routing_priority: z.number().min(0).max(100),
  fallback_questions: z.array(z.string()).length(4),
  ativo: z.boolean(),
  versao: z.number().int().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type SpecialistPromptTemplate = z.infer<typeof SpecialistPromptTemplate>;

/**
 * Tipo de saída — botões de apoio (PRD §7.12). 7 tipos.
 */
export const OutputTypeKey = z.enum([
  "brincadeiras",
  "atividades",
  "crencas",
  "o_que_fazer_diferente",
  "historias_sociais",
  "frases_prontas",
  "rotinas",
]);
export type OutputTypeKey = z.infer<typeof OutputTypeKey>;

export const OutputType = z.object({
  key: OutputTypeKey,
  label: z.string(),
  icone: z.string(),
  prompt_template: z.string(),
  gera_imagem_opcional: z.boolean(),
  ativo: z.boolean(),
});
export type OutputType = z.infer<typeof OutputType>;
