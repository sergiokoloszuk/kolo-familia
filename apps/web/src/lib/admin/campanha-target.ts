/**
 * Resolução de famílias-alvo de uma campanha — PRD §7.13.
 *
 * A `segmentacao` é um JSONB simples. Suporta:
 *   - assinatura: SegmentoAssinatura[]  (default: EM_TESTE, ASSINANTE, PAGAMENTO_FALHOU)
 *   - exigir_consentimento_ayla: boolean (default true)
 *
 * Retorna apenas o filtro do público — a simulação ainda precisa rodar
 * regras temporais (opt-out, 2/dia, silêncio>10d, etc.) no envio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE O SEGMENTO NÃO É MAIS O `status` CRU
 *
 * O trial não expira sozinho: a linha continua `status = 'trialing'` depois de
 * `trial_ends_at` passar. Medido em produção em 2026-08-08: **163 linhas
 * `trialing`, das quais 121 com o trial já vencido**. Segmentar por `trialing`
 * significava mandar "você está no seu teste" para 121 famílias cujo teste
 * acabou — e é mensagem chegando na casa da família, não número errado numa
 * tela.
 *
 * Agora o segmento é semântico e a validade do trial sai de `trialValido`, a
 * MESMA função que o gate de acesso e o funil usam. Uma regra só.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trialValido, type AcessoAssinatura } from "@/lib/auth/assinatura";

export type SegmentoAssinatura =
  | "em_teste"
  | "trial_vencido"
  | "assinante"
  | "pagamento_falhou"
  | "pausada"
  | "cancelada";

/**
 * Os segmentos oferecidos no Admin, com a definição junto — a tela lê daqui,
 * então o rótulo e o significado não podem divergir do que o código faz.
 * Nada de vocabulário de banco para quem monta a campanha.
 */
export const SEGMENTOS_ASSINATURA: ReadonlyArray<{
  value: SegmentoAssinatura;
  label: string;
  definicao: string;
}> = [
  { value: "em_teste", label: "Em teste", definicao: "trial ainda válido" },
  { value: "trial_vencido", label: "Trial vencido", definicao: "o período gratuito terminou e ela não assinou" },
  { value: "assinante", label: "Assinante", definicao: "assinatura em dia" },
  { value: "pagamento_falhou", label: "Pagamento falhou", definicao: "cobrança recusada" },
  { value: "pausada", label: "Pausada", definicao: "assinatura suspensa" },
  { value: "cancelada", label: "Cancelada", definicao: "encerrou a assinatura" },
] as const;

export const SEGMENTOS_DEFAULT: SegmentoAssinatura[] = [
  "em_teste",
  "assinante",
  "pagamento_falhou",
];

export type SegmentacaoCampanha = {
  /** Aceita os segmentos novos; valores antigos são traduzidos (ver `normalizarSegmentos`). */
  assinatura?: Array<SegmentoAssinatura | string>;
  exigir_consentimento_ayla?: boolean;
};

/** Linha de `subscription_accesses` com o que o segmento precisa para decidir. */
export const COLUNAS_SEGMENTO = "family_account_id, status, trial_ends_at";

/**
 * Compatibilidade com segmentação salva antes desta mudança.
 *
 * `'trialing'` significava "status trialing", que incluía trial vencido.
 * Traduzimos para **`em_teste`** — o significado que o rótulo antigo ("Em
 * trial") prometia — e isso só pode **estreitar** o público, nunca alargar:
 * ninguém passa a receber mensagem que não receberia antes.
 *
 * Conferido em 2026-08-08: **nenhuma campanha salva** no banco, então esta
 * tradução não reinterpreta intenção de ninguém. Ela existe para um rascunho
 * em tela antiga não quebrar em silêncio.
 *
 * `'incomplete'` era aceito pelo filtro e é **impossível**: o `check` da coluna
 * só permite trialing/active/past_due/paused/canceled. Filtro que nunca casava,
 * descartado.
 */
const LEGADO: Record<string, SegmentoAssinatura | null> = {
  trialing: "em_teste",
  active: "assinante",
  past_due: "pagamento_falhou",
  paused: "pausada",
  canceled: "cancelada",
  incomplete: null, // nunca casou com nada
};

export function normalizarSegmentos(
  bruto: SegmentacaoCampanha["assinatura"],
): SegmentoAssinatura[] {
  if (!bruto?.length) return [...SEGMENTOS_DEFAULT];
  const validos = new Set(SEGMENTOS_ASSINATURA.map((s) => s.value));
  const out: SegmentoAssinatura[] = [];
  for (const v of bruto) {
    const seg = validos.has(v as SegmentoAssinatura)
      ? (v as SegmentoAssinatura)
      : LEGADO[v as string];
    if (seg && !out.includes(seg)) out.push(seg);
  }
  // Segmentação que só continha valores mortos não pode virar "todo mundo".
  return out;
}

/** Em qual segmento esta linha cai? `null` quando o status é desconhecido. */
export function segmentoDa(
  linha: { status?: string | null; trial_ends_at?: string | null },
  agora: number = Date.now(),
): SegmentoAssinatura | null {
  switch (linha.status) {
    case "trialing":
      return trialValido(linha as AcessoAssinatura, agora) ? "em_teste" : "trial_vencido";
    case "active":
      return "assinante";
    case "past_due":
      return "pagamento_falhou";
    case "paused":
      return "pausada";
    case "canceled":
      return "cancelada";
    default:
      return null;
  }
}

export async function resolveDestinatarios(
  supabase: SupabaseClient,
  segmentacao: SegmentacaoCampanha,
): Promise<string[]> {
  const segmentos = normalizarSegmentos(segmentacao.assinatura);
  if (segmentos.length === 0) return [];
  const exigirConsentimento = segmentacao.exigir_consentimento_ayla !== false;

  // O filtro não cabe mais no SQL: "trial válido" depende da data, não da
  // coluna. Lê as linhas dos status que interessam e decide em memória, com a
  // mesma função do gate de acesso.
  const statusRelevantes = Array.from(
    new Set(
      segmentos.map((s) =>
        s === "em_teste" || s === "trial_vencido"
          ? "trialing"
          : s === "assinante"
            ? "active"
            : s === "pagamento_falhou"
              ? "past_due"
              : s === "pausada"
                ? "paused"
                : "canceled",
      ),
    ),
  );

  const { data: assinaturas } = await supabase
    .from("subscription_accesses")
    .select(COLUNAS_SEGMENTO)
    .in("status", statusRelevantes);

  const ids = (assinaturas ?? [])
    .filter((a) => {
      const seg = segmentoDa(a as { status?: string | null; trial_ends_at?: string | null });
      return seg !== null && segmentos.includes(seg);
    })
    .map((a) => a.family_account_id as string);
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
