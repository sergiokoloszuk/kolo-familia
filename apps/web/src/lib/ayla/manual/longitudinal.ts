/**
 * Análise longitudinal — Manual §13, §14, §19.
 *
 * Princípio condutor:
 *
 *   A Ayla precisa evoluir para "especialista acompanhando continuamente",
 *   não "chatbot que responde perguntas". Isso significa: conectar
 *   eventos ao longo do tempo, perceber padrões, identificar mudanças de
 *   fase, relacionar estratégias com melhora/piora.
 *
 * Esta camada define o CONTRATO da máquina analítica que opera sobre
 * `ayla_eventos_longitudinais`. Tudo é stub — implementação real virá
 * em cron semanal + ad-hoc após eventos de alta intensidade.
 *
 * IMPORTANTE: a análise é DESCRITIVA (o que observamos), não preditiva
 * nem prescritiva. O ato de transformar análise em ação fica com o
 * composer (Sonnet 4.7 em fase futura), que NUNCA contorna
 * `sugestao_perfil_vivos`.
 */

import type {
  Confianca,
  DominioKolo,
  Intensidade,
  MembroAtipicoId,
} from "./types";
import type { TipoEvento, PadraoHipotetico } from "./memory";

// ============================================================
// Janela temporal
// ============================================================

export type JanelaTemporal =
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "6m"
  | "12m"
  | "todo_periodo";

export interface PeriodoTemporal {
  janela: JanelaTemporal;
  data_inicio: string;
  data_fim: string;
}

// ============================================================
// Análise agregada de uma janela
// ============================================================

export interface AnaliseLongitudinal {
  membro_atipico_id: MembroAtipicoId;
  periodo: PeriodoTemporal;

  total_eventos: number;

  /** Histograma de tipos de evento na janela. */
  eventos_por_tipo: Partial<Record<TipoEvento, number>>;

  /** Histograma de domínios ativados (eventos podem ter múltiplos). */
  eventos_por_dominio: Partial<Record<DominioKolo, number>>;

  /** Intensidade modal (a mais frequente) — útil pra dashboards. */
  intensidade_modal: Intensidade | null;

  /** Padrões hipotéticos identificados/atualizados durante a análise. */
  padroes_detectados: PadraoHipotetico[];

  /** Mudanças de fase detectadas durante a análise. */
  mudancas_fase_detectadas: MudancaFase[];

  /** Estratégias avaliadas (com efeito mensurável). */
  efeitos_estrategia: EfeitoEstrategia[];
}

// ============================================================
// Mudança de fase (§19)
// ============================================================

/**
 * Detecção de mudança estrutural (transição de fase) num domínio.
 * Ex: "sono melhorou estruturalmente nas últimas 4 semanas" ou
 * "alimentação regrediu — voltou a recusar texturas que aceitava".
 *
 * Confianca alta exige:
 *   - sustentação por janela mínima (4+ semanas)
 *   - múltiplas evidências consistentes
 *   - ausência de evidências fortes na direção oposta
 */
export interface MudancaFase {
  membro_atipico_id: MembroAtipicoId;
  dominio: DominioKolo;
  /** Descrição do estado anterior (vinha de consolidação anterior ou perfil). */
  fase_anterior: string;
  /** Descrição do estado novo. */
  fase_nova: string;
  /** Data inferida em que a mudança "passou a valer". Aproximação. */
  data_inferida: string;
  /** Direção da mudança. */
  direcao: "progressao" | "regressao" | "lateral";
  confianca: Confianca;
  evidencias_evento_ids: string[];
}

// ============================================================
// Efeito de estratégia
// ============================================================

/**
 * Avalia se uma estratégia testada (`estrategia_testada` no event log)
 * produziu mudança mensurável em janelas pré e pós.
 *
 * Implementação real compara intensidade média e frequência de eventos
 * negativos no domínio relevante. Não é causal — é correlação observada.
 * O Sonnet (futuro composer) precisa traduzir isso pra mãe sem afirmar
 * causalidade.
 */
export interface EfeitoEstrategia {
  estrategia_id: string;
  membro_atipico_id: MembroAtipicoId;
  /** Domínio onde se esperaria efeito. */
  dominio_alvo: DominioKolo;

  janela_pre: PeriodoTemporal;
  janela_pos: PeriodoTemporal;

  /** Métricas comparáveis pré/pós. */
  intensidade_media_pre: number | null;
  intensidade_media_pos: number | null;
  frequencia_eventos_negativos_pre: number;
  frequencia_eventos_negativos_pos: number;

  /** Veredito qualitativo. */
  veredito:
    | "melhora_clara"
    | "melhora_parcial"
    | "sem_mudanca"
    | "piora"
    | "insuficiente"; // janelas pequenas demais

  confianca: Confianca;

  /** Eventos pré e pós (referência completa pra auditoria). */
  evidencias_pre_ids: string[];
  evidencias_pos_ids: string[];
}

// ============================================================
// Contratos (stubs)
// ============================================================

/**
 * Análise completa pra um membro numa janela. Roda em cron semanal +
 * sob demanda após evento de alta intensidade.
 *
 * Implementação real (fase futura):
 *   1. Lê eventos da janela
 *   2. Agrega métricas (tipos, domínios, intensidade)
 *   3. Chama `detectarPadroes` (ver memory.ts:avaliarPadroes — extensão)
 *   4. Chama `detectarMudancasFase`
 *   5. Chama `avaliarEstrategias` pra cada estrategia_testada na janela
 *   6. Persiste resultados em `ayla_padroes` e log de análise
 */
export async function analisar(
  _membro: MembroAtipicoId,
  _janela: JanelaTemporal,
): Promise<AnaliseLongitudinal> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/longitudinal.analisar — " +
      "stub aguardando motor analítico em fase futura.",
  );
}

/**
 * Detecta mudanças de fase comparando consolidações de janelas
 * consecutivas. Implementação cuidadosa: exige ≥4 semanas de
 * sustentação pra confirmar transição estrutural.
 */
export async function detectarMudancasFase(
  _membro: MembroAtipicoId,
): Promise<MudancaFase[]> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/longitudinal.detectarMudancasFase — " +
      "stub aguardando heurística em fase futura.",
  );
}

/**
 * Avalia o efeito observado de uma estratégia específica num membro.
 * Compara janela pré e pós uso da estratégia.
 *
 * Cuidado importante: correlação, não causalidade. Vários fatores podem
 * estar mudando simultaneamente. O Sonnet (futuro composer) precisa
 * comunicar isso à mãe sem prometer mais do que se observou.
 */
export async function avaliarEstrategia(
  _estrategiaId: string,
  _membro: MembroAtipicoId,
): Promise<EfeitoEstrategia> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/longitudinal.avaliarEstrategia — " +
      "stub aguardando comparador pre/pos em fase futura.",
  );
}

/**
 * Helper sincronizado: converte JanelaTemporal pra PeriodoTemporal
 * concreto com data_inicio e data_fim baseados em `agora`.
 *
 * Implementação leve (pura) — pode rodar sem stub. NÃO lança erro.
 */
export function periodoPara(
  janela: JanelaTemporal,
  agora: Date = new Date(),
): PeriodoTemporal {
  const fim = new Date(agora);
  const inicio = new Date(agora);

  switch (janela) {
    case "7d":
      inicio.setDate(inicio.getDate() - 7);
      break;
    case "14d":
      inicio.setDate(inicio.getDate() - 14);
      break;
    case "30d":
      inicio.setDate(inicio.getDate() - 30);
      break;
    case "90d":
      inicio.setDate(inicio.getDate() - 90);
      break;
    case "6m":
      inicio.setMonth(inicio.getMonth() - 6);
      break;
    case "12m":
      inicio.setFullYear(inicio.getFullYear() - 1);
      break;
    case "todo_periodo":
      // Marco distante — caller pode interpretar como "sem limite inferior"
      inicio.setFullYear(2000, 0, 1);
      break;
  }

  return {
    janela,
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
  };
}
