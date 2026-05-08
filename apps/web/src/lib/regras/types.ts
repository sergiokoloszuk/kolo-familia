/**
 * Tipos do Rules Engine — PRD §12.10.
 *
 * Cada regra é uma função pura que recebe (supabase, contexto da família,
 * parâmetros) e devolve EITHER:
 *   - { fired: true, severidade, mensagem, contexto, sugestaoAdaptacao? }
 *     Quando a condição de disparo é verdadeira.
 *   - { fired: false, resolved: true } quando a condição de resolução é
 *     verdadeira (limpa alerta open).
 *   - { fired: false, resolved: false } quando nada muda.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type RegraKey =
  | "mae_emocional_baixa_3em7"
  | "dass21_moderado_ou_severo"
  | "inatividade_diarios_5d"
  | "gatilho_recorrente";

export type Severidade = "info" | "warn" | "high";

export type RegraEvalCtx = {
  family_account_id: string;
  agora: Date;
  parametros: Record<string, unknown>;
};

export type AdaptacaoTipo =
  | "adicionar_kolo_vivo_desafio"
  | "ajustar_ayla_horario"
  | "sugerir_boa_pratica";

export type SugestaoAdaptacao = {
  tipo: AdaptacaoTipo;
  titulo: string;
  descricao: string;
  membro_atipico_id?: string | null;
  payload_proposto: Record<string, unknown>;
};

export type RegraFired = {
  fired: true;
  severidade: Severidade;
  mensagem: string;
  membro_atipico_id?: string | null;
  contexto: Record<string, unknown>;
  sugestaoAdaptacao?: SugestaoAdaptacao;
};

export type RegraResolved = {
  fired: false;
  resolved: true;
  contexto?: Record<string, unknown>;
};

export type RegraNoOp = { fired: false; resolved: false };

export type RegraResult = RegraFired | RegraResolved | RegraNoOp;

export type RegraEvaluator = (
  supabase: SupabaseClient,
  ctx: RegraEvalCtx,
) => Promise<RegraResult>;
