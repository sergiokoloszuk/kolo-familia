/**
 * Bridge v1 ↔ v2.
 *
 * Permite que a camada v2 (esta `manual/`) reuse as regras duras da v1
 * (`../rules.ts`) sem duplicá-las. Funciona como:
 *
 *   1. Mapeamentos de vocabulário (v1 ↔ v2) — emoções, tipos proativos
 *   2. `podeEnviarV2()` — wrapper que chama v1 + aplica extensões v2
 *   3. Helpers de tradução pra leitura/escrita compatível com v1
 *
 * Princípio: as regras DURAS da v1 (consentimento, 2/dia, comercial pós-crise,
 * engajamento <36h, silêncio 10d) são INVARIANTES. A v2 herda, não substitui.
 *
 * Quando a v2 estiver em produção e estável, esta camada pode virar caminho
 * único — a v1 não precisa ser deletada, só não é mais ponto de entrada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { podeEnviarProativa, type RuleCheckResult } from "../rules";
import type { AylaTipoProativa } from "../types";
import type { EstadoEmocional, FamilyAccountId } from "./types";
import type { TipoCheckIn } from "./proactive";

// ============================================================
// Mapeamento: TipoCheckIn (v2) → AylaTipoProativa (v1)
// ============================================================

/**
 * Cada tipo de check-in da v2 herda as regras duras de um tipo proativo
 * v1 equivalente. Tradução aproximada — escolhe o tipo v1 com a política
 * mais próxima.
 *
 * Quando v2 evoluir e adicionar tipos novos, este mapeamento decide qual
 * conjunto de regras v1 aplicar como invariante.
 */
export const CHECK_IN_TO_V1_TIPO: Record<TipoCheckIn, AylaTipoProativa> = {
  // Refere evento — comportamento similar à rotina (atenção contínua)
  ancorado_evento: "rotina",
  // Follow-up de estratégia — similar a rotina (presença regular, sem comercial)
  follow_up_estrategia: "rotina",
  // Observação leve — tipo `insight` na v1 (sem hipérbole, com base contextual)
  observacao_leve: "insight",
  // Percepção evolutiva — também tipo `insight` (uma observação fundamentada)
  percepcao_evolutiva: "insight",
};

// ============================================================
// Mapeamento de emoções v1 ↔ v2
// ============================================================

/**
 * v1 usa vocabulário restrito (`ayla_daily_checkins.emocao_mae`):
 *   muito_bem | bem | neutro | triste | cansada | ansiosa_estressada
 *
 * v2 usa vocabulário mais granular (`EstadoEmocional`):
 *   estavel | cansada | frustrada | culpada | sobrecarregada | aliviada | feliz
 *
 * Mapeamentos são unidirecionais (nem sempre reversíveis sem perda).
 */
export type EmocaoMaeV1 =
  | "muito_bem"
  | "bem"
  | "neutro"
  | "triste"
  | "cansada"
  | "ansiosa_estressada";

export function v2ParaV1(emocao: EstadoEmocional): EmocaoMaeV1 {
  switch (emocao) {
    case "feliz":
      return "muito_bem";
    case "aliviada":
      return "bem";
    case "estavel":
      return "neutro";
    case "culpada":
      return "triste";
    case "cansada":
      return "cansada";
    case "frustrada":
    case "sobrecarregada":
      return "ansiosa_estressada";
  }
}

export function v1ParaV2(emocao: EmocaoMaeV1): EstadoEmocional {
  switch (emocao) {
    case "muito_bem":
      return "feliz";
    case "bem":
      return "aliviada";
    case "neutro":
      return "estavel";
    case "triste":
      // Tradução com perda — pode ser culpada ou cansada
      // Default conservador: culpada (mais frequente em contexto Kolo)
      return "culpada";
    case "cansada":
      return "cansada";
    case "ansiosa_estressada":
      // Tradução com perda — pode ser frustrada ou sobrecarregada
      // Default conservador: sobrecarregada (impacta política de silêncio)
      return "sobrecarregada";
  }
}

// ============================================================
// Adapter de regras: podeEnviarV2
// ============================================================

export interface PodeEnviarV2Input {
  family_account_id: FamilyAccountId;
  agora: Date;
  tipo: TipoCheckIn;
}

/**
 * Verifica se a Ayla v2 pode enviar um check-in deste tipo agora.
 *
 * Combina:
 *   1. **Regras duras v1** (`../rules.ts:podeEnviarProativa`) — invariantes:
 *      consentimento + não desativada + não pausada + 2/dia + comercial-pós-crise +
 *      engajamento<36h + silêncio 10d
 *   2. **Extensões v2** (stubs) — reduzir_ate, cadência adaptativa, requisitos
 *      do tipo de check-in
 *
 * Hoje retorna o resultado da v1 e marca extensões v2 como pendentes (não
 * bloqueia). Quando as extensões v2 forem implementadas, este wrapper passa
 * a interseccionar as duas camadas (mais restritivo vence).
 */
export async function podeEnviarV2(
  supabase: SupabaseClient,
  input: PodeEnviarV2Input,
): Promise<RuleCheckResult> {
  // 1. Herda regras duras v1 — invariante não-negociável
  const v1Tipo = CHECK_IN_TO_V1_TIPO[input.tipo];
  const v1Result = await podeEnviarProativa(
    supabase,
    {
      family_account_id: input.family_account_id,
      agora: input.agora,
    },
    v1Tipo,
  );
  if (!v1Result.permitido) {
    return v1Result;
  }

  // 2. Extensões v2 — ainda stub. Ver issues:
  //    a) consultar ayla_silencio_estado.reduzir_ate / pausa_completa_ate
  //    b) aplicar LIMITES_FREQUENCIA da v2 (mais restritivo que v1)
  //    c) validar CHECK_IN_REQUISITOS pro tipo escolhido
  //
  // Por ora, passa direto (v2 não restringe além da v1). Quando a fase de
  // implementação chegar, este return vira uma lista de checks.

  return { permitido: true };
}

// ============================================================
// Helper de checagem do estado de silêncio v2 (consultivo)
// ============================================================

export interface EstadoSilencioRow {
  family_account_id: string;
  ultima_resposta_em: string | null;
  respostas_curtas_seguidas: number;
  estado_emocional_inferido: EstadoEmocional | null;
  reduzir_ate: string | null;
  pausa_completa_ate: string | null;
  atualizado_em: string;
}

/**
 * Lê estado de silêncio v2 da família. Retorna null se ainda não foi
 * inicializado (esperado — a tabela é populada assincronamente).
 *
 * Não bloqueia envio diretamente — caller usa o resultado pra decidir
 * (combinado com `podeEnviarV2`).
 */
export async function lerEstadoSilencio(
  supabase: SupabaseClient,
  familyAccountId: FamilyAccountId,
): Promise<EstadoSilencioRow | null> {
  const { data, error } = await supabase
    .from("ayla_silencio_estado")
    .select("*")
    .eq("family_account_id", familyAccountId)
    .maybeSingle();

  if (error) {
    // Falha de leitura não bloqueia — apenas degrada pra invariantes v1
    return null;
  }
  return (data as EstadoSilencioRow | null) ?? null;
}

/**
 * Aplica regra "reduzir_ate" sobre um resultado v1 já liberado. Se houver
 * `reduzir_ate > agora`, transforma o resultado em "permitido: false" com
 * motivo descritivo. Útil pra usar a tabela `ayla_silencio_estado` sem
 * mexer em `podeEnviarV2`.
 *
 * Uso típico:
 *   const r = await podeEnviarV2(supabase, input);
 *   if (!r.permitido) return r;
 *   const estado = await lerEstadoSilencio(supabase, input.family_account_id);
 *   return aplicarReduzirAte(r, estado, input.agora);
 */
export function aplicarReduzirAte(
  base: RuleCheckResult,
  estado: EstadoSilencioRow | null,
  agora: Date,
): RuleCheckResult {
  if (!base.permitido) return base;
  if (!estado) return base;

  if (estado.pausa_completa_ate && new Date(estado.pausa_completa_ate) > agora) {
    return {
      permitido: false,
      motivo: "Pausa completa v2 em vigor (sinais de sobrecarga).",
    };
  }
  if (estado.reduzir_ate && new Date(estado.reduzir_ate) > agora) {
    return {
      permitido: false,
      motivo: "Redução v2 em vigor — Ayla está em modo 'desaparecer' (§10).",
    };
  }
  return base;
}
