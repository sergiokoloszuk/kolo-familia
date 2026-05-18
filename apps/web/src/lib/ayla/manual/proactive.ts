/**
 * Política de proatividade da Ayla — Manual §9, §10.
 *
 * Esta camada define COMO a Ayla decide quando aparecer e quando recuar.
 * NÃO executa scheduler — isso fica pra fase de implementação. Aqui só:
 *
 *   - regras de silêncio (§10) como dado
 *   - cadência aceitável (§9)
 *   - tipos de check-in proativo
 *   - schema do estado de silêncio por família
 *
 * Princípio (§9): "presença contínua, principalmente via WhatsApp, mas
 * não funciona como automação de engajamento."
 *
 * Princípio (§10): "a Ayla precisa saber desaparecer."
 *
 * IMPORTANTE: a Ayla v1 (`../rules.ts`) já tem regras duras (consentimento,
 * 2/dia, silêncio 10d). Esta camada NÃO substitui isso — herda como
 * invariante e adiciona políticas mais finas que o v1 não tem.
 */

import type { EstadoEmocional, FamilyAccountId } from "./types";

// ============================================================
// Tipos de check-in (§9)
// ============================================================

/**
 * Os 4 tipos de check-in que a Ayla v2 pode disparar. Cada um exige um
 * contexto disponível — não disparar tipo sem o que ele precisa.
 */
export type TipoCheckIn =
  | "ancorado_evento" // refere evento recente concreto
  | "follow_up_estrategia" // checa estratégia sugerida em turno anterior
  | "observacao_leve" // micro observação sem peso
  | "percepcao_evolutiva"; // mudança percebida pela Ayla

export interface CheckInRequisitos {
  tipo: TipoCheckIn;
  exige: string[]; // descritivo — o que precisa estar presente no contexto
  evita_se: string[]; // descritivo — quando NÃO usar este tipo
}

/**
 * Pré-condições de contexto pra cada tipo de check-in. Usado pelo gerador
 * de check-in (futuro) pra escolher um tipo cabível.
 */
export const CHECK_IN_REQUISITOS: Record<TipoCheckIn, CheckInRequisitos> = {
  ancorado_evento: {
    tipo: "ancorado_evento",
    exige: [
      "evento de alta intensidade nos últimos 3 dias",
      "evento não foi a última coisa que a Ayla mencionou",
    ],
    evita_se: [
      "mãe em estado emocional baixo (cansada/sobrecarregada) — preferir silêncio",
      "evento já teve follow-up nos últimos 24h",
    ],
  },
  follow_up_estrategia: {
    tipo: "follow_up_estrategia",
    exige: [
      "estratégia sugerida nos últimos 3-7 dias",
      "sem follow-up dela ainda",
    ],
    evita_se: [
      "mãe respondeu evasivamente ao último follow-up",
      "estratégia foi sugerida no contexto de crise (espera mais)",
    ],
  },
  observacao_leve: {
    tipo: "observacao_leve",
    exige: [
      "última conversa há 24-72h",
      "estado emocional inferido estável",
    ],
    evita_se: [
      "qualquer sinal de sobrecarga",
      "sem contexto recente pra ancorar",
    ],
  },
  percepcao_evolutiva: {
    tipo: "percepcao_evolutiva",
    exige: [
      "padrão emergente em estado 'observado' (3+ evidências)",
      "padrão ainda não confirmado pela mãe",
    ],
    evita_se: [
      "padrão muito recente (<1 semana)",
      "padrão de natureza preocupante sem acompanhamento profissional",
    ],
  },
};

// ============================================================
// Regras de silêncio (§10)
// ============================================================

/**
 * Sinais que disparam REDUÇÃO de interação (não pausa total). Quando algum
 * destes está presente, a Ayla:
 *   - não inicia novo tópico
 *   - pausa follow-ups
 *   - se for responder, mantém modo `acolhimento`
 */
export const SINAIS_REDUZIR = {
  sem_resposta_horas: 48, // §10
  respostas_curtas_consecutivas: 3, // §10 — sinal de saturação
  estados_emocionais_baixos: [
    "cansada",
    "sobrecarregada",
    "frustrada",
    "culpada",
  ] as EstadoEmocional[],
  /** Quando >=N tipos de check-in falharam em sequência. */
  check_ins_sem_engajamento_seguidos: 2,
} as const;

/**
 * Sinais que disparam PAUSA COMPLETA. Mais drástico que reduzir. A Ayla
 * só volta a aparecer quando a mãe iniciar conversa.
 *
 * NOTA: a v1 (`../rules.ts:128`) já implementa "silêncio total após 10
 * dias sem resposta". Mantemos a regra aqui pra a v2 herdar sem
 * reimplementar.
 */
export const SINAIS_PAUSA_COMPLETA = {
  sem_resposta_dias: 10, // §10 + PRD §12.5 (já em produção via v1)
  pausada_explicitamente: true, // comando "pausar" da mãe (v1 já trata)
  desativada_explicitamente: true, // comando "sair" da mãe (v1 já trata)
} as const;

// ============================================================
// Cadência aceitável (§9)
// ============================================================

/**
 * Limites de frequência. Estes valores convivem com as regras duras da v1
 * (`../rules.ts` — máx 2 proativas/dia). Quando v2 estiver em produção,
 * estes valores são INTERSECTADOS com as regras duras — o mais restritivo
 * vence.
 */
export const LIMITES_FREQUENCIA = {
  /** Não mais de 1 check-in por dia POR PADRÃO. v1 permite 2/dia mas em geral usamos 1. */
  min_intervalo_horas: 24,

  /** Em uma semana, máx 3 check-ins (mãe ativa) ou 1 (mãe quieta). */
  max_check_ins_semana_mae_ativa: 3,
  max_check_ins_semana_mae_quieta: 1,

  /** Horário padrão se a família não tiver `ayla_preferences` específica. */
  janela_horario_default: { inicio: "09:00", fim: "20:00" },
} as const;

// ============================================================
// Estado de silêncio por família
// ============================================================

/**
 * Schema da tabela `ayla_silencio_estado` (a ser criada).
 *
 * Mantida por job que monitora `ayla_messages` + classifier outputs.
 * Lida pelo scheduler de proativas v2 (futuro) pra decidir se envia.
 */
export interface EstadoSilencio {
  family_account_id: FamilyAccountId;
  /** Última vez que a mãe respondeu (qualquer canal). */
  ultima_resposta_em: string | null;
  /**
   * Quantidade de respostas curtas seguidas. Atualizado pelo extractor
   * pós-turno. Quando atinge `SINAIS_REDUZIR.respostas_curtas_consecutivas`,
   * `reduzir_ate` é setado pra 48h.
   */
  respostas_curtas_seguidas: number;
  /** Estado emocional inferido pelo último classifier output. */
  estado_emocional_inferido: EstadoEmocional | null;
  /** Pausa leve (não envia proativas, mas responde se mãe falar). */
  reduzir_ate: string | null;
  /** Pausa total (não envia nada). v1 já trata isso via `ayla_preferences.desativada`. */
  pausa_completa_ate: string | null;
  atualizado_em: string;
}

// ============================================================
// Contratos (stubs)
// ============================================================

/**
 * Decide se a Ayla DEVE enviar um check-in pra esta família agora. Combina:
 *   - regras duras v1 (`../rules.ts:podeEnviarProativa`)
 *   - estado de silêncio v2 (`EstadoSilencio`)
 *   - cadência (`LIMITES_FREQUENCIA`)
 *   - requisitos do tipo de check-in disponível
 *
 * Retorna `null` se nada deve ser enviado, ou o tipo recomendado.
 */
export async function avaliarCheckInProativo(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  familyAccountId: FamilyAccountId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  agora: Date,
): Promise<TipoCheckIn | null> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/proactive.avaliarCheckInProativo — " +
      "stub aguardando integração com EstadoSilencio + v1 rules em fase futura.",
  );
}
