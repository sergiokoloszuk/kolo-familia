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
 * `statement` é o padrão e não estava na taxonomia original — foi acrescentado
 * porque sem um tipo neutro todo relato extraído viraria `event`, afirmando uma
 * temporalidade que o texto não tem ("ele gosta de música" não é evento).
 *
 * O nome NÃO é `observation`: `observed` já é um verification status (o sistema
 * observou direto), e dois nomes quase iguais em dimensões diferentes se
 * confundem em revisão. `statement` diz apenas "algo foi afirmado" — sem
 * implicar confirmação, observação clínica nem verdade consolidada.
 *
 * Nada nesta etapa grava `trait` ou `pattern`. Generalizar exige recorrência, e
 * recorrência é trabalho da maturação, que ainda não existe.
 */
export type FactKind =
  | "statement"
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
import type { SujeitoCandidato } from "./sujeito";

/** Linhagem: identidade do conteúdo e da execução que produziram o fato. */
export type Linhagem = {
  /** Identidade estável do conteúdo de origem, entre reprocessamentos. */
  sourceContentId?: string | null;
  /** Agrupa tudo que saiu de uma mesma passada de extração. */
  extractionRunId?: string | null;
};

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
  /** A expressao temporal como a familia disse. Ausente = extraida do texto. */
  tempoOriginal?: string | null;
  escopo?: Escopo;
  proveniencia: Proveniencia;
  verificationStatus?: VerificationStatus;
  temporalStatus?: TemporalStatus;
  extractionConfidence?: number | null;
  linhagem?: Linhagem;
  /**
   * Resolução do membro (ver `foco-membro.ts`). Quando a decisão é
   * `quarentena`, o fato é gravado FORA da leitura, com o motivo — em vez de
   * perdido.
   */
  foco?: {
    decisao: "persistir" | "quarentena" | "rejeitar";
    motivo: string;
    sujeito: SujeitoCandidato;
  };
};

export type ResultadoRegistro =
  | { status: "gravado"; id: string }
  | { status: "quarentena"; id: string; motivo: string }
  | { status: "duplicado" }
  // `familia_nao_autorizada` cobre os dois lados da barreira da amostra
  // controlada — flag desligada ou família fora da lista. Um motivo só, porque
  // do ponto de vista do chamador o efeito é idêntico: não se coleta.
  | { status: "ignorado"; motivo: "flag_desligada" | "familia_nao_autorizada" | "sem_membro" }
  | { status: "rejeitado"; motivo: string }
  | { status: "falhou"; erro: string };

/**
 * Versão do processo que produz os fatos. Fonte ÚNICA — nunca repita este
 * literal em outro arquivo.
 *
 * REGRA: incremente a cada mudança que altere sujeito, domínio, subcampo,
 * conceito, afirmação, natureza, status epistemológico, data observada, escopo,
 * idempotência ou critério de aceitação/rejeição.
 *
 * v1 → v2 (Fase 4A): `confirmed` deixou de ser gravado pelos fluxos atuais,
 * entrou a barreira de sujeito e o filtro de afirmação sem conteúdo. Sem o
 * bump, fatos de antes e depois das correções seriam indistinguíveis — foi o
 * que a auditoria da Fase 3 apontou entre `81aa526` e `dfef78b`.
 */
export const EXTRACTOR_VERSION = "kv-blob-v2";
