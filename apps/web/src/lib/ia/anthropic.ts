import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/**
 * Cliente Anthropic em singleton. Lança erro claro se a chave não estiver
 * configurada — pra não falhar com mensagem opaca em produção.
 */
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Adicione em apps/web/.env.local.",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Modelos usados pelo produto (PRD §13.1, NFR-07):
 * - principal: skills e composição de respostas (Sonnet 4.6)
 * - leve: parser da Ayla, router, classificação (Haiku 4.5)
 */
export const MODELS = {
  principal: process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6",
  leve: process.env.ANTHROPIC_MODEL_LEVE || "claude-haiku-4-5",
} as const;
