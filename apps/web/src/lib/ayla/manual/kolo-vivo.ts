/**
 * Kolo Vivo derivado — Manual §12, §13, §14, §15 + visão da Karina.
 *
 * Princípio condutor:
 *
 *   "O Kolo Vivo deve funcionar como perfil VIVO da criança. Não cadastro.
 *    Precisa consolidar padrões, sensibilidades, hiperfocos, estratégias
 *    que ajudam, evolução emocional, comunicação, alimentação, socialização.
 *    Tudo vindo da memória longitudinal."
 *
 * Esta camada define o CONTRATO de consolidação: dado um membro e uma janela
 * de análise, produz uma fotografia derivada dos eventos longitudinais.
 *
 * IMPORTANTE: consolidação é INFORMATIVA, não mutativa. Ela ALIMENTA
 * `sugestao_perfil_vivos` (já existe), nunca escreve direto em
 * `perfil_vivo_membro`. A mãe sempre revisa/aprova/edita/rejeita.
 */

import type {
  Confianca,
  DominioKolo,
  MembroAtipicoId,
} from "./types";
import type { EventoId } from "./types";

// ============================================================
// Tipos das células de consolidação
//
// Cada bloco é OPCIONAL — só vem na consolidação se houver evidência
// suficiente. Sem evidência = bloco ausente. NUNCA fabricar.
// ============================================================

export interface PerfilSensorialConsolidado {
  /** Hipótese narrativa curta — ex: "sensibilidade tátil hiper provável". */
  hipotese: string;
  confianca: Confianca;
  /** Áreas sensoriais com sinal — ex: ['tatil', 'auditivo']. */
  modalidades_evidenciadas: string[];
  /** Eventos que sustentam a hipótese. */
  evidencias_evento_ids: EventoId[];
}

export interface HiperfocoConsolidado {
  /** Tema do hiperfoco — ex: "dinossauros", "trens", "Pokémon". */
  tema: string;
  confianca: Confianca;
  primeira_evidencia: string;
  ultima_evidencia: string;
  evidencias_evento_ids: EventoId[];
}

export interface PreferenciaConsolidada {
  /** Descrição curta — ex: "comidas brancas", "sons agudos". */
  objeto: string;
  /** Direção da preferência. */
  valencia: "gosta" | "evita";
  dominio: DominioKolo;
  confianca: Confianca;
  evidencias_evento_ids: EventoId[];
}

export interface EstrategiaQueAjudaConsolidada {
  estrategia_id: string;
  /** Nome humano da estratégia, lido da base Kolo. */
  nome: string;
  /** Domínios onde foi observada melhora após uso. */
  dominios_melhora: DominioKolo[];
  /** Confiança no efeito (depende de quantas evidências + magnitude). */
  veredito: "ajuda_claramente" | "ajuda_parcial" | "sem_confirmacao";
  confianca: Confianca;
  evidencias_evento_ids: EventoId[];
}

export interface EvolucaoEmocionalConsolidada {
  /** Direção observada na janela. */
  tendencia: "melhora" | "estavel" | "piora" | "oscilando";
  /** Indicadores curtos (3 frases máx). */
  observacoes: string[];
  confianca: Confianca;
  evidencias_evento_ids: EventoId[];
}

/**
 * Bloco genérico por domínio (sono, alimentacao, etc.) — usado quando
 * há observação consolidável que não cabe nos blocos especializados.
 */
export interface BlocoDominio {
  dominio: DominioKolo;
  observacao: string;
  confianca: Confianca;
  evidencias_evento_ids: EventoId[];
}

// ============================================================
// Consolidação completa
// ============================================================

export type JanelaConsolidacao =
  | "ultimos_30d"
  | "ultimos_90d"
  | "ultimos_6m"
  | "todo_periodo";

export interface ConsolidacaoKoloVivo {
  membro_atipico_id: MembroAtipicoId;
  janela: JanelaConsolidacao;
  data_inicio: string;
  data_fim: string;
  gerada_em: string;

  /** Total de eventos analisados pra produzir a consolidação. */
  total_eventos_base: number;

  // Blocos especializados — todos opcionais
  perfil_sensorial?: PerfilSensorialConsolidado;
  hiperfocos?: HiperfocoConsolidado[];
  preferencias?: PreferenciaConsolidada[];
  estrategias_que_ajudam?: EstrategiaQueAjudaConsolidada[];
  evolucao_emocional?: EvolucaoEmocionalConsolidada;

  /** Outros domínios com observações que não couberam nos blocos especializados. */
  dominios_extras?: BlocoDominio[];

  /**
   * Padrões hipotéticos identificados na janela (referência aos
   * `ayla_padroes` correspondentes).
   */
  padroes_ativos_ids?: string[];

  /**
   * Sumário narrativo curto (≤ 3 frases) destinado a aparecer no topo
   * do Kolo Vivo na app — apoia a mãe a "ver" a evolução em uma olhada.
   * NÃO entra como afirmação clínica — sempre com tom de "hipótese".
   */
  sumario_narrativo: string;
}

// ============================================================
// Contratos (stubs)
// ============================================================

/**
 * Gera uma consolidação fresca a partir dos eventos longitudinais do
 * membro na janela dada. Roda em cron + ad-hoc após alteração relevante.
 *
 * Implementação real (futura):
 *   1. lê `ayla_eventos_longitudinais` filtrado por membro + janela
 *   2. lê `ayla_padroes` ativos do membro
 *   3. agrupa eventos por (dominio, tipo) e calcula evidência mínima
 *   4. gera blocos de consolidação apenas onde há evidência ≥ threshold
 *   5. produz `sumario_narrativo` (pode usar Sonnet ou ser determinístico)
 *
 * Não persiste mutações no perfil — só retorna a consolidação. Caller
 * decide o que fazer (mostrar na UI, gerar sugestões, etc).
 */
export async function consolidarKoloVivo(
  _membro: MembroAtipicoId,
  _janela: JanelaConsolidacao,
): Promise<ConsolidacaoKoloVivo> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/kolo-vivo.consolidarKoloVivo — " +
      "stub aguardando consumidor de `ayla_eventos_longitudinais` + " +
      "`ayla_padroes` em fase futura.",
  );
}

/**
 * Compara uma consolidação nova com o `perfil_vivo_membro` atual e emite
 * sugestões de atualização (via `sugestao_perfil_vivos`) onde houver
 * divergência confiável.
 *
 * Princípio: a Ayla NUNCA escreve no perfil silenciosamente — gera
 * sugestões revisáveis. Ver lib/ayla/manual/memory.ts — SugestaoAyla.
 */
export async function gerarSugestoesDeAtualizacao(
  _consolidacao: ConsolidacaoKoloVivo,
): Promise<string[]> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/kolo-vivo.gerarSugestoesDeAtualizacao — " +
      "stub aguardando diff perfil_vivo_membro vs ConsolidacaoKoloVivo em fase futura.",
  );
}
