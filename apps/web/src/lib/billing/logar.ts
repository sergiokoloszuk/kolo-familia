import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularCustoTokens, calcularCustoPorChamada } from "./prices";

/**
 * Loga uma chamada de API (Anthropic / OpenAI) na tabela api_calls. Esse
 * registro alimenta o dashboard /admin/uso-api — custo total, custo por
 * família, custo por feature.
 *
 * Falha silenciosamente: nunca quebra o fluxo principal. Se a inserção
 * der erro, loga warn no console mas devolve normal — a feature do
 * usuário não pode quebrar porque a auditoria falhou.
 *
 * Para LLMs: passe input_tokens / output_tokens (lidos de resp.usage do
 * SDK Anthropic ou equivalente). O custo é calculado pela PRICE_TABLE.
 *
 * Para modelos por chamada (imagem, áudio): passe `quantidade` (nº de
 * imagens ou minutos de áudio) — o custo é PRICE_TABLE[model].usd *
 * quantidade. Não passe tokens nesse caso.
 *
 * Override: se a contagem padrão não couber (faturamento atípico, modelo
 * fora da tabela com custo conhecido), passe `custo_usd` direto.
 */
export async function logarUsoApi(
  supabase: SupabaseClient,
  params: {
    family_account_id?: string | null;
    provider: "anthropic" | "openai";
    model: string;
    feature: string;
    input_tokens?: number;
    output_tokens?: number;
    /** Pra modelos `per_call`: número de imagens / minutos de áudio. */
    quantidade?: number;
    /** Sobrescreve o cálculo padrão (use só quando souber o custo exato). */
    custo_usd?: number;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const inputTokens = params.input_tokens ?? 0;
    const outputTokens = params.output_tokens ?? 0;

    let custo: number;
    if (params.custo_usd != null) {
      custo = params.custo_usd;
    } else if (params.quantidade != null) {
      custo = calcularCustoPorChamada(params.model, params.quantidade);
    } else {
      custo = calcularCustoTokens(params.model, inputTokens, outputTokens);
    }

    const { error } = await supabase.from("api_calls").insert({
      family_account_id: params.family_account_id ?? null,
      provider: params.provider,
      model: params.model,
      feature: params.feature,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      custo_usd: custo,
      meta: params.meta ?? null,
    });

    if (error) {
      console.warn(
        `[billing] falha ao logar uso API (${params.feature}/${params.model}):`,
        error.message,
      );
    }
  } catch (e) {
    console.warn(
      `[billing] exceção ao logar uso API (${params.feature}/${params.model}):`,
      e instanceof Error ? e.message : e,
    );
  }
}
