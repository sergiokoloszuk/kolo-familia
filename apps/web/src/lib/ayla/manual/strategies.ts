/**
 * Estratégias aplicadas — registro estruturado de uso de estratégias da
 * base Kolo, com contexto e percepção de efeito.
 *
 * Princípio Karina (18/05/2026):
 *
 *   "Quero começar a registrar: estratégias utilizadas, contexto,
 *    resposta percebida, melhora/piora posterior."
 *
 *   Exemplos:
 *     • antecipação visual ajudou banho
 *     • rotina curta ajudou alimentação
 *     • pressão profunda ajudou sono
 *
 * Implementação:
 *
 *   Eventos do tipo `estrategia_testada` (já no vocabulário) guardam essa
 *   informação em `metadados`. Este módulo define o SCHEMA OBRIGATÓRIO
 *   desse `metadados` pra que a análise longitudinal posterior consiga
 *   computar efeito de forma consistente.
 *
 *   Quando o composer v2 entrar (fase futura), ele lerá este schema pra
 *   registrar estratégias quando a mãe disser "testei o tal e funcionou".
 */

import type {
  Confianca,
  DominioKolo,
  EventoId,
  MembroAtipicoId,
} from "./types";

// ============================================================
// Schema do metadados em eventos `estrategia_testada`
// ============================================================

export type RespostaPercebida =
  | "ajudou_claramente"
  | "ajudou_parcial"
  | "sem_mudanca"
  | "piorou"
  | "indefinido";

/**
 * Forma esperada do `metadados` quando um evento de
 * `tipo='estrategia_testada'` é registrado.
 *
 * Campos obrigatórios:
 *   - estrategia_id: FK pra `boas_praticas.id` (ou outra tabela de estratégias)
 *   - estrategia_nome: cópia do nome no momento (estável a renomeações)
 *   - contexto_dominio: domínio onde se esperaria efeito
 *
 * Campos opcionais:
 *   - resposta_percebida: classificação da mãe (se ela respondeu) ou inferência
 *   - observacao_mae: texto livre da mãe sobre como foi
 *   - dias_testando: quantos dias está sendo aplicada
 */
export interface EstrategiaTestadaMetadados {
  // Obrigatórios
  estrategia_id: string;
  estrategia_nome: string;
  contexto_dominio: DominioKolo;

  // Opcionais — preenchidos conforme contexto disponível
  resposta_percebida?: RespostaPercebida;
  observacao_mae?: string;
  dias_testando?: number;

  // Trilha de origem — quem registrou
  origem: "mae_disse" | "ayla_inferiu" | "admin";
  origem_detalhe?: string;
}

// ============================================================
// Vocabulário "humano" pra apresentar na UI / no composer
// ============================================================

export const RESPOSTA_HUMANA: Record<RespostaPercebida, string> = {
  ajudou_claramente: "ajudou claramente",
  ajudou_parcial: "ajudou em parte",
  sem_mudanca: "sem mudança percebida",
  piorou: "pareceu piorar",
  indefinido: "ainda incerto",
};

// ============================================================
// Resumo derivado — alimenta consolidação do Kolo Vivo
// ============================================================

/**
 * Agrupamento de eventos `estrategia_testada` por estratégia, com cálculo
 * de efeito qualitativo. Esta visão é DERIVADA — não persiste em tabela
 * própria. Computada sob demanda pelo motor longitudinal.
 */
export interface ResumoEstrategiaPorMembro {
  membro_atipico_id: MembroAtipicoId;
  estrategia_id: string;
  estrategia_nome: string;
  contextos_dominio: DominioKolo[];
  total_testes: number;
  ultima_aplicacao: string;

  /** Distribuição da resposta percebida — frequência por classificação. */
  distribuicao_resposta: Partial<Record<RespostaPercebida, number>>;

  /** Veredito qualitativo agregado, com confiança. */
  veredito: "ajuda_consistente" | "ajuda_eventual" | "sem_padrao" | "ineficaz";
  confianca: Confianca;

  /** Ids dos eventos `estrategia_testada` agregados. */
  evidencias_evento_ids: EventoId[];
}

// ============================================================
// Contratos (stubs)
// ============================================================

/**
 * Registra um evento `estrategia_testada` com metadados estruturados.
 * Wrapper de `registrarEvento()` de `memory.ts` com validação de schema.
 *
 * Implementação real (fase futura) validará que `estrategia_id` existe
 * na base proprietária Kolo antes de gravar.
 */
export async function registrarEstrategiaTestada(
  _input: {
    membro_atipico_id: MembroAtipicoId;
    family_account_id: string;
    metadados: EstrategiaTestadaMetadados;
    ocorreu_em?: string;
    texto_livre?: string;
  },
): Promise<EventoId> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/strategies.registrarEstrategiaTestada — " +
      "stub aguardando integração com base proprietária Kolo em fase futura.",
  );
}

/**
 * Agrega todos os eventos `estrategia_testada` de um membro e produz o
 * `ResumoEstrategiaPorMembro` pra cada estratégia distinta.
 *
 * Calcula veredito qualitativo baseado em:
 *   - distribuição de `resposta_percebida` (peso de cada categoria)
 *   - quantidade de testes (saturação)
 *   - presença de eventos negativos no mesmo domínio antes vs depois
 */
export async function resumirEstrategiasDoMembro(
  _membro: MembroAtipicoId,
): Promise<ResumoEstrategiaPorMembro[]> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/strategies.resumirEstrategiasDoMembro — " +
      "stub aguardando consumidor de ayla_eventos_longitudinais em fase futura.",
  );
}
