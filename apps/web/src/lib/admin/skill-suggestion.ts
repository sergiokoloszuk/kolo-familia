import { z } from "zod";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";

/**
 * Assistente de curadoria de skills (PRD §11.3 / §7.4).
 *
 * Recebe descrição de demanda da fundadora + contexto das skills atuais.
 * Devolve uma de 3 recomendações:
 *   - 'coberta'   → demanda já é coberta por skill X (ampliar
 *                   keywords/scope eventualmente)
 *   - 'melhoria'  → ajustes em skill(s) existente(s)
 *   - 'nova'      → minuta de skill nova com objective/tone/scope/limits
 *                   e routing_keywords sugeridos
 */

const SuggestionSchema = z.object({
  recomendacao: z.enum(["coberta", "melhoria", "nova"]),
  justificativa: z.string().min(20).max(800),
  skillsAfetadas: z
    .array(
      z.object({
        name: z.string(),
        ajustes_sugeridos: z.string(),
      }),
    )
    .max(5),
  minutaNovaSkill: z
    .object({
      name: z.string(),
      display_name: z.string(),
      objective: z.string(),
      tone: z.string(),
      scope: z.string(),
      limits: z.string(),
      kolo_vivo_fields: z.array(z.string()).max(5),
      knowledge_tags: z.array(z.string()).max(8),
      routing_keywords: z.array(z.string()).max(20),
      routing_priority: z.number().int().min(0).max(100),
      fallback_questions: z.array(z.string()).length(4),
    })
    .optional(),
});

export type SkillSuggestion = z.infer<typeof SuggestionSchema>;

export type SkillResumo = {
  name: string;
  display_name: string;
  objective: string;
  routing_keywords: string[];
};

const SYSTEM_FALLBACK = `Você é o assistente de curadoria de skills do Kolo Família. A fundadora descreve uma demanda de skill nova e você decide se:

1. Já é coberta por uma skill existente — sugira ampliar keywords/scope se necessário
2. É melhoria — sugira ajustes em uma ou mais skills existentes
3. É skill nova — gere minuta completa pronta pra revisão

# Princípios
- Skills demais confundem o roteador. Prefira ampliar uma existente sempre que possível.
- Ler atentamente os "objective" e "routing_keywords" das skills atuais antes de decidir.
- Voz do produto Kolo Família: hipóteses, nunca causas afirmadas. Sem termos clínicos prescritivos. Não diagnostica/prescreve.

# Formato de saída
JSON estrito:
{
  "recomendacao": "coberta" | "melhoria" | "nova",
  "justificativa": "...",
  "skillsAfetadas": [{"name": "...", "ajustes_sugeridos": "..."}],
  "minutaNovaSkill": { ... }      // só se recomendacao === "nova"
}

Para minutaNovaSkill (só quando "nova"):
- name: snake_case curto
- display_name: 2-4 palavras
- objective: 1 frase com o que a skill faz
- tone: tom de voz
- scope: o que cobre
- limits: o que NÃO faz (NUNCA diagnosticar/prescrever)
- kolo_vivo_fields: subset de [essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, camada2_dinamica, camada2_recursos]
- knowledge_tags: 3-6 tags
- routing_keywords: 8-15 palavras-chave em PT-BR
- routing_priority: 50-85 normalmente
- fallback_questions: exatamente 4 perguntas pra manter conversa aberta`;

export async function sugerirSkill(params: {
  demanda: string;
  skillsAtuais: SkillResumo[];
}): Promise<SkillSuggestion | { erro: string }> {
  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return { erro: "ANTHROPIC_API_KEY não configurada." };
  }

  const skillsContext = params.skillsAtuais
    .map(
      (s) =>
        `- ${s.name} (${s.display_name})\n  objetivo: ${s.objective}\n  keywords: ${s.routing_keywords.join(", ")}`,
    )
    .join("\n\n");

  const userMsg = `<skills_atuais>
${skillsContext}
</skills_atuais>

<demanda>
${params.demanda}
</demanda>

Decida: coberta, melhoria, ou nova. Devolva o JSON.`;

  const systemPrompt = await getSystemPrompt("skill_suggestion", SYSTEM_FALLBACK);

  let texto: string;
  try {
    const stream = client.messages.stream({
      model: MODELS.principal,
      max_tokens: 2500,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const finalMessage = await stream.finalMessage();
    texto = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha do modelo" };
  }

  const json = parseJson(texto);
  if (!json) return { erro: "Resposta sem JSON válido" };

  const parsed = SuggestionSchema.safeParse(json);
  if (!parsed.success) {
    return { erro: `Estrutura inválida: ${parsed.error.message.slice(0, 200)}` };
  }

  return parsed.data;
}

function parseJson(texto: string): unknown {
  const t = texto.trim();
  try {
    return JSON.parse(t);
  } catch {
    const match = t.match(/```json\s*([\s\S]*?)\s*```/i) ?? t.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[match.length - 1] === "}" ? match[0] : match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
