import type { SupabaseClient } from "@supabase/supabase-js";
import type { MotivoDescarte } from "./tipos";

/**
 * POSSE DO TURNO — ADR 0001, seção 4.
 *
 * O agrupamento (`lote-inbound.ts`) já elege uma execução por rajada. O buraco
 * que sobrava é o TEMPO: o lote é claimado antes da chamada ao modelo, que leva
 * 40–90 s. Se a mãe escreve de novo nesse intervalo, nasce uma segunda execução
 * — e as duas publicam. Pior: a antiga pode terminar depois da nova, e a
 * resposta das 22h42 aparece embaixo da de 23h10.
 *
 * A correção não é um lock mais longo (a serverless morre, o lock vaza). É uma
 * RECONFERÊNCIA no último instante possível, imediatamente antes de publicar:
 * "ainda sou eu?". Barato, sem estado novo, e correto mesmo se a execução
 * antiga demorar minutos.
 *
 * Um detalhe que importa: quando a execução perde a posse, ela é DESCARTADA em
 * silêncio — sem fallback. Fallback existe para resposta barrada pela
 * Validação, não para resposta obsoleta. Mandar um "tô aqui com você" porque
 * perdemos uma corrida seria ruído gerado pela nossa própria infraestrutura.
 */

export type ContextoPosse = {
  familyId: string;
  /** A inbound que originou esta resposta. */
  sourceMessageId: string;
  executionId: string;
  /** Quando esta execução começou — para o teto de tempo. */
  iniciadaEm: number;
};

/**
 * Teto de vida de uma execução. Abaixo do `maxDuration` do webhook (300 s) com
 * folga para publicar: se estourasse junto, a função morreria no meio da
 * entrega, que é o cenário de publicação parcial.
 */
export const TETO_EXECUCAO_MS = 240_000;

export type VeredictoPosse = { ok: true } | { ok: false; motivo: MotivoDescarte };

/**
 * Ainda posso publicar?
 *
 * Falha segura invertida em relação ao resto do produto: em caso de erro de
 * banco, PERMITE publicar. Ficar mudo por uma indisponibilidade seria pior que
 * o risco de uma duplicata — a mãe sem resposta é o pior resultado possível.
 */
export async function confirmarPosse(
  supabase: SupabaseClient,
  ctx: ContextoPosse,
): Promise<VeredictoPosse> {
  if (Date.now() - ctx.iniciadaEm > TETO_EXECUCAO_MS) {
    return { ok: false, motivo: "execucao_expirada" };
  }

  try {
    // Alguém já publicou para esta inbound?
    const { data: publicada } = await supabase
      .from("ayla_publicacoes")
      .select("id")
      .eq("source_message_id", ctx.sourceMessageId)
      .limit(1);
    if ((publicada?.length ?? 0) > 0) return { ok: false, motivo: "ja_publicado" };
  } catch {
    // Tabela ainda não migrada (0072). Degrada: sem esta checagem, mas as
    // outras continuam valendo. Mesmo padrão do controle de turno (0070).
  }

  try {
    // Chegou inbound mais nova e ainda não processada? Então quem chegou depois
    // responde por todas — esta resposta virou obsoleta enquanto era gerada.
    const { data: novas } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", ctx.familyId)
      .eq("direcao", "inbound")
      .is("processada_em", null)
      .limit(1);
    if ((novas?.length ?? 0) > 0) return { ok: false, motivo: "inbound_mais_recente" };
  } catch {
    /* idem */
  }

  return { ok: true };
}
