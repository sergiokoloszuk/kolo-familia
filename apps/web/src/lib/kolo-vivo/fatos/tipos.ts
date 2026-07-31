/**
 * FACT STORE do Perfil Vivo — contratos. Migração 0073.
 *
 * O primeiro corte tem um objetivo só: **parar de perder origem, tempo,
 * contexto e natureza** das informações que entram na memória. Hoje
 * `appendFato` cola texto num blob jsonb e tudo isso some — inclusive a
 * diferença entre o que a família relatou e o que a IA inferiu.
 *
 * Nada aqui é lido em produção. Escrita paralela, atrás de flag.
 */

/** De onde a informação veio. TIPO da fonte — não confundir com autor nem canal. */
export type SourceType =
  | "caregiver_report"
  | "accompanied_person_report"
  | "professional_report"
  | "teacher_report"
  | "manual_entry"
  | "ai_inference"
  | "system_migration";

export type SourceChannel = "whatsapp" | "web" | "diario" | "tela" | "sistema";

/**
 * O quanto sabemos. SEPARADO da temporalidade de propósito: um fato pode ser
 * histórico e confirmado, ou atual e incerto.
 */
export type VerificationStatus =
  | "reported"
  | "observed"
  | "inferred"
  | "confirmed"
  | "uncertain"
  | "contested";

export type TemporalStatus = "current" | "historical" | "unknown";

/**
 * O que o fato é.
 *
 * `observation` é o padrão e não estava na taxonomia original — foi
 * acrescentado porque sem ele todo relato extraído viraria `event`, afirmando
 * uma temporalidade que o texto não tem ("ele gosta de música" não é evento).
 * Na dúvida, observação: é o único default que não inventa nada.
 *
 * Nada nesta etapa grava `trait` ou `pattern`. Generalizar exige recorrência, e
 * recorrência é trabalho da maturação, que ainda não existe.
 */
export type FactKind =
  | "observation"
  | "event"
  | "pattern"
  | "trait"
  | "preference"
  | "ability"
  | "trigger"
  | "support"
  | "goal"
  | "tested_strategy"
  | "milestone";

export type EscopoTipo =
  | "sempre"
  | "context"
  | "campaign"
  | "school"
  | "professional"
  | "life_phase"
  | "conversation";

export type Escopo = { tipo: EscopoTipo; id?: string | null };

/** Proveniência: tipo, autor e canal são três coisas distintas. */
export type Proveniencia = {
  sourceType: SourceType;
  /** "mãe", "professora", "fono" — rótulo legível. */
  actorLabel?: string | null;
  actorId?: string | null;
  channel?: SourceChannel | null;
  /** Referência à mensagem original. NÃO copiamos o texto: ele já vive em
   *  `ayla_messages`, e duplicar aumentaria a exposição sem ganho. */
  messageId?: string | null;
  conversationId?: string | null;
};

/** O candidato que o serviço recebe. */
export type CandidatoFato = {
  familyId: string;
  membroId: string | null;
  conceito: string;
  dominio: string;
  afirmacao: string;
  contexto?: string | null;
  factKind?: FactKind;
  /** Quando foi observado. Ausente = hoje, e `preciso: false`. */
  observadoEm?: string | null;
  observadoEmPreciso?: boolean;
  escopo?: Escopo;
  proveniencia: Proveniencia;
  verificationStatus?: VerificationStatus;
  temporalStatus?: TemporalStatus;
  extractionConfidence?: number | null;
};

export type ResultadoRegistro =
  | { status: "gravado"; id: string }
  | { status: "duplicado" }
  | { status: "ignorado"; motivo: "flag_desligada" | "sem_membro" }
  | { status: "rejeitado"; motivo: string }
  | { status: "falhou"; erro: string };

/**
 * Versão do processo que produz os fatos. Muda quando a forma de derivar
 * conceito, tipo ou proveniência muda — é o que permite reprocessar depois sem
 * confundir o que já existia, e faz parte da chave de idempotência.
 */
export const EXTRACTOR_VERSION = "kv-blob-v1";
