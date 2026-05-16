import { z } from "zod";
import { getAnthropicClient, MODELS } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";
import type { ValidationResult } from "./validators";

/**
 * Validador IA — Adendo PRD §4 (Grupos A + B).
 *
 * Roda DEPOIS da resposta primária e DEPOIS dos validators regex (tom),
 * pra checar critérios semânticos:
 *   A1. Cita Kolo Vivo (nome, idade, interesse, desafio específico)
 *   A2. Compatível com idade
 *   A3. Incorpora interesse quando há atividade lúdica
 *   B4. Abre hipóteses, não afirma causa
 *
 * Custo: +15-18% por mensagem (estimado). Modelo: leve (Haiku), max_tokens
 * baixo, JSON-only response.
 *
 * Hierarquia (Adendo): tolera 1 falha aqui (passa com warning), 2+ regenera.
 */

const ResultSchema = z.object({
  cita_kolo_vivo: z.object({
    ok: z.boolean(),
    motivo: z.string().optional(),
  }),
  compativel_com_idade: z.object({
    ok: z.boolean(),
    motivo: z.string().optional(),
  }),
  incorpora_interesse: z.object({
    ok: z.boolean(),
    motivo: z.string().optional(),
    aplicavel: z.boolean(), // false quando não há atividade lúdica sugerida
  }),
  abre_hipoteses: z.object({
    ok: z.boolean(),
    motivo: z.string().optional(),
  }),
});

export type AiValidatorContext = {
  nome_crianca?: string | null;
  idade?: number | null;
  perfil?: string | null;
  interesses?: string | null;
  desafios?: string | null;
};

const SYSTEM_FALLBACK = `Você é o Validador IA do Kolo Família. Sua única função é auditar uma resposta de skill em 4 critérios semânticos e retornar um JSON estrito. Sem texto antes/depois.

# Critérios (Adendo PRD v1 §4)

A1. **Cita Kolo Vivo** — a resposta cita pelo menos UM elemento concreto do contexto da família: nome da criança, idade, perfil/diagnóstico, interesse específico, ou desafio específico que foi passado. Genérico não conta.

A2. **Compatível com idade** — as orientações/atividades/exemplos sugeridos fazem sentido para a faixa etária da criança. Brincadeira de bebê pra adolescente falha. Conselho pra criança de 8 anos falha em bebê.

A3. **Incorpora interesse quando há atividade lúdica** — SE a resposta propõe brincadeira ou atividade, ela usa pelo menos 1 interesse declarado. Se NÃO há atividade lúdica proposta, marque aplicavel=false.

B4. **Abre hipóteses, não afirma causa** — quando a resposta lê o que está em jogo, oferece múltiplas possibilidades ou usa linguagem de hipótese ("pode ser", "uma hipótese", "às vezes acontece"). Fechar em causa única afirmada falha.

# Formato OBRIGATÓRIO

Devolva APENAS este JSON, nada antes ou depois:

{
  "cita_kolo_vivo": { "ok": true|false, "motivo": "..." },
  "compativel_com_idade": { "ok": true|false, "motivo": "..." },
  "incorpora_interesse": { "ok": true|false, "aplicavel": true|false, "motivo": "..." },
  "abre_hipoteses": { "ok": true|false, "motivo": "..." }
}

motivo só obrigatório quando ok=false.`;

/**
 * Roda o Validador IA. Retorna lista de falhas (vazia se passou em tudo).
 * Aplica a regra: tolera 1 falha total (passa), 2+ regenera.
 */
export async function validateWithAI(
  resposta: string,
  ctx: AiValidatorContext,
): Promise<ValidationResult> {
  let client;
  try {
    client = getAnthropicClient();
  } catch {
    // Sem chave: pula validação IA silenciosamente. Não bloqueia o fluxo.
    return { ok: true };
  }

  const systemPrompt = await getSystemPrompt("validador_ai", SYSTEM_FALLBACK);

  const linhas: string[] = [];
  if (ctx.nome_crianca) linhas.push(`nome: ${ctx.nome_crianca}`);
  if (ctx.idade != null) linhas.push(`idade: ${ctx.idade}`);
  if (ctx.perfil) linhas.push(`perfil: ${ctx.perfil}`);
  if (ctx.interesses) linhas.push(`interesses: ${ctx.interesses}`);
  if (ctx.desafios) linhas.push(`desafios: ${ctx.desafios}`);

  const userMsg = `<contexto_familia>
${linhas.join("\n")}
</contexto_familia>

<resposta_a_validar>
${resposta}
</resposta_a_validar>

Audite a resposta nos 4 critérios e devolva o JSON.`;

  let raw: string;
  try {
    const stream = client.messages.stream({
      model: MODELS.principal,
      max_tokens: 600,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const finalMessage = await stream.finalMessage();
    raw = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (e) {
    console.warn("[validator-ai] falha do modelo, passando silencioso:", e);
    return { ok: true };
  }

  const parsed = parseValidatorJson(raw);
  if (!parsed) {
    console.warn("[validator-ai] JSON inválido, passando silencioso:", raw.slice(0, 200));
    return { ok: true };
  }

  // Conta falhas
  const falhas: string[] = [];
  if (!parsed.cita_kolo_vivo.ok) {
    falhas.push(`A1 (cita Kolo Vivo): ${parsed.cita_kolo_vivo.motivo ?? "sem motivo"}`);
  }
  if (!parsed.compativel_com_idade.ok) {
    falhas.push(`A2 (compatível com idade): ${parsed.compativel_com_idade.motivo ?? "sem motivo"}`);
  }
  // A3 só conta se for aplicável (resposta propôs atividade lúdica)
  if (parsed.incorpora_interesse.aplicavel && !parsed.incorpora_interesse.ok) {
    falhas.push(`A3 (incorpora interesse): ${parsed.incorpora_interesse.motivo ?? "sem motivo"}`);
  }
  if (!parsed.abre_hipoteses.ok) {
    falhas.push(`B4 (abre hipóteses): ${parsed.abre_hipoteses.motivo ?? "sem motivo"}`);
  }

  // Regra do Adendo: 1 falha passa (com warning), 2+ regenera
  if (falhas.length >= 2) {
    return {
      ok: false,
      motivo: `Validador IA: ${falhas.length} falhas — ${falhas.join("; ")}`,
      sugestao: "Reescreva atendendo todos os critérios, especialmente os que falharam acima.",
    };
  }

  // 0 ou 1 falha → passa, mas loga pra auditoria
  if (falhas.length === 1) {
    console.warn(`[validator-ai] 1 falha tolerada: ${falhas[0]}`);
  }
  return { ok: true };
}

function parseValidatorJson(s: string): z.infer<typeof ResultSchema> | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (match) {
      try {
        candidate = JSON.parse(match[1]);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }
  const parsed = ResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
