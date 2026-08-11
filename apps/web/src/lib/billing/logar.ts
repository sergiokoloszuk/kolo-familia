import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularCustoTokens, calcularCustoPorChamada } from "./prices";
import { logEvent } from "@/lib/log";

/**
 * Loga uma chamada de API (Anthropic / OpenAI) na tabela api_calls. Esse
 * registro alimenta o dashboard /admin/uso-api — custo total, custo por
 * família, custo por feature.
 *
 * Nunca quebra o fluxo principal: se a inserção falhar, a resposta da família
 * segue normalmente. O que MUDOU em 11/08/2026 é que a falha deixa de sumir.
 *
 * ⚠️ POR QUE. A conversa da web chamava esta função com os dados certos desde
 * que foi instrumentada — e `api_calls` tinha ZERO registros de `conversa_web`
 * em todo o histórico, enquanto o WhatsApp tinha milhares. A rota web usa
 * `createClient()` (sessão do usuário, sujeito a RLS); o `INSERT` batia na
 * política, o erro voltava em `error`, e o `console.warn` daqui morria com a
 * retenção do stdout da Vercel. Meses de custo da conversa web fora do
 * `/admin/uso-api`, e ninguém tinha como saber.
 *
 * O cliente continua vindo de QUEM CHAMA — de propósito. Construir um
 * service-role aqui dentro consertaria a web e quebraria as bancadas, que
 * passam um stub que ESTOURA justamente para garantir que nada seja gravado
 * em produção durante um teste. Privilégio é decisão de quem chama.
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

    if (error) await naoGravou(params, error.message);
  } catch (e) {
    await naoGravou(params, e instanceof Error ? e.message : String(e));
  }
}

/**
 * A FALHA DE TELEMETRIA NÃO PODE SUMIR — e também não pode derrubar a conversa.
 *
 * Reusa `logEvent` com severidade `error`, que já persiste em `eventos_app` por
 * service role. Nenhum mecanismo de alerta novo: o que faltava não era um canal,
 * era usar o que existe. `logEvent` tem o próprio `try/catch`, então uma falha
 * aqui continua sendo invisível para a família — só deixa de ser invisível para
 * nós.
 *
 * ⚠️ O `await` é deliberado. Sem ele, numa rota que fecha o stream logo em
 * seguida, o registro pode nunca sair — seria trocar um silêncio por outro.
 */
async function naoGravou(
  params: { feature: string; model: string; provider: string; family_account_id?: string | null },
  motivo: string,
): Promise<void> {
  await logEvent({
    kind: "billing_nao_gravou",
    severity: "error",
    family_account_id: params.family_account_id ?? null,
    message: `api_calls não gravou ${params.feature} (${params.provider}/${params.model}): ${motivo.slice(0, 200)}`,
    payload: { feature: params.feature, provider: params.provider, model: params.model, motivo: motivo.slice(0, 400) },
  });
}
