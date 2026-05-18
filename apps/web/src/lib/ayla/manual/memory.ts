/**
 * Memória longitudinal da Ayla — Manual §12, §13, §14, §15.
 *
 * Tipos pra:
 *   - eventos (registros granulares ao longo do tempo)
 *   - padrões (hipóteses emergentes a partir de eventos repetidos)
 *   - sugestões de atualização do Kolo Vivo (já existe `sugestao_perfil_vivos`
 *     no banco — reutilizamos; aqui só tipos de integração)
 *
 * Princípios não-negociáveis (§13):
 *
 *   1. A Ayla NÃO altera o perfil estrutural silenciosamente.
 *      Toda inferência vira `Sugestao` que a mãe revisa.
 *   2. A Ayla NÃO transforma evento isolado em padrão.
 *      Padrão exige recorrência + contexto.
 *   3. A Ayla NÃO conclui sem evidência suficiente.
 *      `confianca < 0.5` ⇒ sugestão pendente, não vai à mãe.
 */

import type {
  Confianca,
  DominioKolo,
  EventoId,
  FamilyAccountId,
  Intensidade,
  MembroAtipicoId,
  PadraoId,
} from "./types";

// ============================================================
// Eventos longitudinais
// ============================================================

/**
 * Tipos de evento que a Ayla registra (§13, §14, §15).
 *
 * Vocabulário fechado — adicionar tipo exige decisão de produto + migração
 * SQL (CHECK constraint em `ayla_eventos_longitudinais`).
 *
 * Organização:
 *   - Manifestações agudas: crise, meltdown, shutdown
 *   - Progresso: conquista, melhora
 *   - Retrocesso: regressao
 *   - Revelações de perfil: sensibilidade, hiperfoco, preferencia
 *   - Mudanças estruturais: mudanca_observada (genérica), mudanca_fase (transição)
 *   - Interação com base: estrategia_testada
 *   - Conversa: conversa_turno, check_in_resposta, follow_up_resposta
 *   - Captura neutra: registro_explicito
 */
export type TipoEvento =
  // Manifestações agudas
  | "crise_relatada"
  | "meltdown_relatado"          // §18 — externalização
  | "shutdown_relatado"          // §18 — internalização

  // Progresso
  | "conquista_relatada"
  | "melhora_relatada"           // mudança positiva clara, ex: dormiu melhor por 1 semana

  // Retrocesso
  | "regressao_observada"        // perda de capacidade que já estava estabelecida

  // Revelações do perfil neurofuncional
  | "sensibilidade_evidenciada"  // perfil sensorial/alimentar/etc evidenciado em evento
  | "hiperfoco_evidenciado"      // interesse intenso identificado
  | "preferencia_revelada"       // gosta de / evita algo concreto

  // Mudanças
  | "mudanca_observada"          // mudança geral (sem afirmar que é fase nova)
  | "mudanca_fase"               // §19 — transição estrutural confirmada

  // Interação com a base de estratégias
  | "estrategia_testada"

  // Conversa
  | "conversa_turno"
  | "check_in_resposta"
  | "follow_up_resposta"

  // Captura neutra (sem inferência de natureza)
  | "registro_explicito";

export interface EventoLongitudinal {
  id: EventoId;
  family_account_id: FamilyAccountId;
  /** Eventos sem membro = sobre a família/mãe (§22, §11). */
  membro_atipico_id: MembroAtipicoId | null;
  tipo: TipoEvento;
  dominios: DominioKolo[];
  intensidade: Intensidade | null;
  ocorreu_em: string; // ISO 8601
  /** Texto livre que descreve o evento (curto). */
  texto_livre: string | null;
  /**
   * Metadados livres específicos do tipo. Ex: pra `estrategia_testada`,
   * `{ estrategia_id: "...", resultado: "ajudou" | "nao_ajudou" | "indef" }`.
   */
  metadados: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Padrões emergentes (hipóteses)
// ============================================================

/**
 * Estado de um padrão. Toda hipótese começa como `hipotese`. Vira `observado`
 * quando atinge 3+ evidências consistentes em janela apropriada. Passa a
 * `confirmado_mae` quando a mãe explicitamente confirma. `descartado` quando
 * a mãe rejeita ou evidências contraditórias se acumulam.
 */
export type EstadoPadrao =
  | "hipotese" // 1-2 evidências, ainda não usado em resposta
  | "observado" // 3+ evidências, pode aparecer em resposta com "parece que..."
  | "confirmado_mae" // mãe confirmou, pode aparecer sem disclaimer
  | "descartado"; // mãe rejeitou ou evidências viraram

export interface PadraoHipotetico {
  id: PadraoId;
  family_account_id: FamilyAccountId;
  membro_atipico_id: MembroAtipicoId;
  /**
   * Chave canônica do padrão. Ex: `resistencia_banho`, `crise_apos_escola`,
   * `melhora_sono_com_rotina`. Vocabulário emergente — não declarado em
   * `./types.ts` pra permitir crescimento orgânico.
   */
  padrao_key: string;
  /**
   * Narrativa curta em linguagem OBSERVACIONAL (Karina, §13). NÃO contém
   * verbos clínicos/assertivos. Gerada via `pattern-language.ts` que
   * valida vocabulário antes de persistir.
   */
  descricao: string;
  evidencias_count: number;
  confianca: Confianca;
  estado: EstadoPadrao;
  primeira_evidencia: string;
  ultima_evidencia: string;
  /** Ids de `EventoLongitudinal` que sustentam o padrão. */
  evidencias_evento_ids: EventoId[];

  // ============================================================
  // Rastreabilidade (Karina: "não quero caixa preta")
  // ============================================================

  /**
   * Qual heurística determinística disparou. Auditoria — permite saber
   * de onde veio cada padrão. Ver `pattern-language.ts:TipoHeuristica`.
   */
  motivo_hipotese: string | null;

  /**
   * Sinais descritivos que pesaram na detecção. Ex:
   *   ["3 ocorrências em 14d", "mesmo domínio", "intensidade modal alta"]
   */
  sinais_correlacionados: string[];

  /**
   * Janela temporal usada na detecção. Ex: "30d", "90d", "6m", "todo_periodo".
   * Permite refazer a análise se necessário com a mesma janela.
   */
  janela_analisada: string | null;

  // ============================================================
  // Revisão humana (treinamento longitudinal — Karina)
  // ============================================================

  /**
   * Ajuste de relevância manual:
   *   -1 = irrelevante (ignorar futuramente)
   *    0 = sem ajuste
   *  1..5 = relevância crescente (5 = altamente relevante)
   */
  relevancia_karina: number | null;

  /** Quando a Karina revisou. */
  revisado_em: string | null;

  /** Quem revisou (user id). */
  revisado_por: string | null;

  metadados: Record<string, unknown>;
}

// ============================================================
// Sugestões de atualização do Kolo Vivo
// ============================================================

/**
 * Reutiliza `sugestao_perfil_vivos` (tabela existente). Aqui só os tipos
 * que a Ayla v2 emite ao gerar sugestão.
 *
 * IMPORTANTE: a Ayla NUNCA escreve diretamente em `perfil_vivo_membro` ou
 * `perfil_vivo_familia`. Toda atualização inferida passa por esta camada
 * de sugestão, que a mãe revisa em `/kolo-vivo`.
 */
export type TipoSugestao =
  | "novo_dado" // informação nova sobre o membro
  | "atualizacao" // contradição com o que está no perfil hoje
  | "padrao" // padrão emergente que virou hipótese
  | "reforco" // mesma informação observada novamente (não cria sugestão; só incrementa contador)
  | "mudanca_fase"; // §19 — sugere que houve mudança de fase

export interface SugestaoAyla {
  family_account_id: FamilyAccountId;
  membro_atipico_id: MembroAtipicoId;
  tipo: TipoSugestao;
  /** Camada do Kolo Vivo afetada — espelha o schema existente. */
  camada: "camada1" | "camada2" | "camada3";
  /** Campo específico dentro da camada. */
  campo: string;
  texto_sugerido: string;
  /** "ayla_v2_evento", "ayla_v2_padrao", etc. — origem auditável. */
  origem: string;
  confianca: Confianca;
  /**
   * Ids de eventos que sustentam a sugestão — fonte de verdade pra revisão
   * da mãe ("por que você sugeriu isso?").
   */
  evidencias_evento_ids: EventoId[];
  /** Padrão associado (se a sugestão deriva de um padrão). */
  padrao_id: PadraoId | null;
}

// ============================================================
// Resumo de estado recente (L3)
// ============================================================

/**
 * Resumo curto do estado recente do membro — alimenta o classifier e o
 * composer como contexto compacto. Tipicamente regenerado em cron semanal,
 * com regeneração ad-hoc se houver evento de alta intensidade.
 */
export interface ResumoEstadoRecente {
  membro_atipico_id: MembroAtipicoId;
  janela: "7d" | "14d" | "30d";
  data_inicio: string;
  data_fim: string;
  /** Narrativa curta (1-3 frases) destinada a entrar no prompt. */
  resumo_compacto: string;
  /** Lista bullet de eventos críticos da janela (descritivo). */
  eventos_criticos: string[];
  /** Humor médio inferido da mãe na janela. */
  humor_mae_dominante: string | null;
  /** Padrões ativos relevantes na janela. */
  padroes_ativos_keys: string[];
  gerado_em: string;
}

// ============================================================
// Contratos (stubs) — implementação em fase futura
// ============================================================

/** Registra um evento. Implementação real escreve em `ayla_eventos_longitudinais`. */
export async function registrarEvento(
  _evento: Omit<EventoLongitudinal, "id" | "created_at">,
): Promise<EventoId> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/memory.registrarEvento — " +
      "stub aguardando integração com `ayla_eventos_longitudinais` em fase futura.",
  );
}

/**
 * Avalia se um conjunto de eventos sustenta um padrão emergente. Se sim,
 * cria/atualiza `PadraoHipotetico`. Roda em cron + ad-hoc após registrar
 * evento de alta intensidade.
 */
export async function avaliarPadroes(
  _membro: MembroAtipicoId,
): Promise<PadraoHipotetico[]> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/memory.avaliarPadroes — " +
      "stub aguardando heurística de detecção em fase futura.",
  );
}
