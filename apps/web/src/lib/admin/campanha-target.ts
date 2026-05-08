/**
 * Resolução de famílias-alvo de uma campanha — PRD §7.13.
 *
 * A `segmentacao` é um JSONB simples no MVP. Suporta:
 *   - assinatura: ('trialing'|'active'|'past_due'|'canceled'|'incomplete')[]
 *       (default: ['trialing','active','past_due'])
 *   - exigir_consentimento_ayla: boolean (default true)
 *
 * Retorna apenas o filtro do público — a simulação ainda precisa rodar
 * regras temporais (opt-out, 2/dia, silêncio>10d, etc.) no envio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SegmentacaoCampanha = {
  assinatura?: Array<
    "trialing" | "active" | "past_due" | "canceled" | "incomplete"
  >;
  exigir_consentimento_ayla?: boolean;
};

const STATUS_DEFAULT: NonNullable<SegmentacaoCampanha["assinatura"]> = [
  "trialing",
  "active",
  "past_due",
];

export async function resolveDestinatarios(
  supabase: SupabaseClient,
  segmentacao: SegmentacaoCampanha,
): Promise<string[]> {
  const status = segmentacao.assinatura?.length
    ? segmentacao.assinatura
    : STATUS_DEFAULT;
  const exigirConsentimento = segmentacao.exigir_consentimento_ayla !== false;

  const { data: assinaturas } = await supabase
    .from("subscription_accesses")
    .select("family_account_id, status")
    .in("status", status);

  const ids = (assinaturas ?? []).map((a) => a.family_account_id as string);
  if (ids.length === 0) return [];

  if (!exigirConsentimento) return Array.from(new Set(ids));

  const { data: prefs } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, consentimento_em, desativada")
    .in("family_account_id", ids)
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  return Array.from(
    new Set((prefs ?? []).map((p) => p.family_account_id as string)),
  );
}
