/**
 * Tabela de preços dos modelos que o app usa. USD por 1M tokens, exceto
 * onde dito (imagem/áudio são por chamada).
 *
 * Atualize aqui quando o provider mudar preço. O commit fica como registro
 * histórico — útil pra explicar variações no dashboard.
 *
 * Fonte: docs públicos do provider (verificar antes de atualizar).
 */

export type PriceEntry =
  | { kind: "token"; input_per_million: number; output_per_million: number }
  | { kind: "per_call"; usd: number };

export const PRICE_TABLE: Record<string, PriceEntry> = {
  // Anthropic — Claude
  "claude-haiku-4-5": { kind: "token", input_per_million: 1.0, output_per_million: 5.0 },
  "claude-haiku-4-5-20251001": { kind: "token", input_per_million: 1.0, output_per_million: 5.0 },
  "claude-sonnet-4-6": { kind: "token", input_per_million: 3.0, output_per_million: 15.0 },
  "claude-opus-4-7": { kind: "token", input_per_million: 15.0, output_per_million: 75.0 },

  /**
   * OpenAI — texto. DERIVADO DA PRÓPRIA FATURA DA KOLO, não da tabela pública.
   *
   * Em 06/08/2026 cruzei duas APIs de organização na mesma janela de 3 dias:
   *   /v1/organization/usage/completions?group_by=model   → tokens por modelo
   *   /v1/organization/costs?group_by=line_item           → US$ por line item
   *
   * Para `gpt-5.6-luna`, com os 180 turnos da bancada A/B no meio:
   *   output ......... US$ 0,1000 /    83.374 tok → US$ 1,199/M
   *   cache writes ... US$ 0,0362 /   145.439 tok → US$ 0,249/M  (entrada nova)
   *   cached input ... US$ 0,0354 / 1.769.974 tok → US$ 0,020/M
   *
   * As proporções fecham entre si (saída ≈ 4,8× a entrada; leitura de cache ≈
   * 8% da entrada), o que dá confiança de que os line items foram mapeados
   * para as classes certas de token.
   *
   * ⚠️ CONFERIR contra a página oficial de preços antes de usar este número
   * para decidir migração. A fatura prova o que FOI cobrado; ela não garante
   * que não exista desconto, tier ou promoção embutida. `PRICE_TABLE` não
   * modela cache — o custo real de entrada fica ENTRE 0,02 e 0,249, e usar
   * 0,249 é o lado conservador (superestima).
   */
  "gpt-5.6-luna": { kind: "token", input_per_million: 0.249, output_per_million: 1.199 },

  // OpenAI — imagem (gpt-image-1, 1024x1024 medium quality, por imagem gerada)
  "gpt-image-1": { kind: "per_call", usd: 0.04 },

  // OpenAI — STT (whisper-1, por minuto de áudio — caller passa minutos como "n_calls")
  "whisper-1": { kind: "per_call", usd: 0.006 },
};

/**
 * Calcula o custo em USD pra uma chamada de modelo token-based. Para
 * modelos `per_call`, use `calcularCustoPorChamada` (passa quantidade).
 *
 * Modelos desconhecidos retornam 0 — a chamada é logada mas sem custo.
 * Isso evita explosão silenciosa; o dashboard mostra a divergência vs
 * snapshot do provider e o admin atualiza a tabela.
 */
export function calcularCustoTokens(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICE_TABLE[model];
  if (!p || p.kind !== "token") return 0;
  return (
    (inputTokens / 1_000_000) * p.input_per_million +
    (outputTokens / 1_000_000) * p.output_per_million
  );
}

/**
 * Calcula custo pra modelos faturados por unidade (imagens, minutos de
 * áudio). `quantidade` = nº de imagens / minutos.
 */
export function calcularCustoPorChamada(model: string, quantidade: number): number {
  const p = PRICE_TABLE[model];
  if (!p || p.kind !== "per_call") return 0;
  return p.usd * quantidade;
}
