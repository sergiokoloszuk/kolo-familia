import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente Anthropic INDEPENDENTE da Ayla.
 *
 * Reimplementa o singleton em vez de importar /lib/ia/anthropic — a
 * Ayla é produto separado por princípio (PRD §12.3). Os dois mundos
 * não se importam mutuamente.
 *
 * A Ayla usa Haiku como padrão (parser, classificação) — modelo leve
 * e barato, conforme NFR-07.
 */

let _client: Anthropic | null = null;

export function getAylaAnthropicClient(): Anthropic {
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

export const AYLA_MODEL = process.env.ANTHROPIC_MODEL_LEVE || "claude-haiku-4-5";
