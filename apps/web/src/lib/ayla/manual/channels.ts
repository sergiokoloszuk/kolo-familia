/**
 * Separação WhatsApp vs App — Manual §11.
 *
 *   "WhatsApp é a conversa principal emocional e conversacional.
 *    O app é a representação visual da jornada da criança.
 *    O app NÃO é um grande chat."
 *
 * Esta camada define o CONTRATO de cada canal: que comportamentos da Ayla
 * são apropriados onde. É consultada pelo composer e pelo scheduler.
 */

import type { Canal } from "./types";

export interface ContratoCanal {
  /** Identidade conceitual do canal. */
  papel: string;

  /** O que faz sentido ACONTECER neste canal. */
  permite: string[];

  /** O que NÃO faz sentido / vai contra o desenho do canal. */
  nao_permite: string[];

  /** Forma típica de mensagem. */
  forma: {
    tom_dominante: string;
    tamanho_tipico: string;
    perguntas_por_turno_max: number;
    permite_audio: boolean;
  };
}

/**
 * Contratos por canal. Manual §11.
 */
export const CANAIS: Record<Canal, ContratoCanal> = {
  // ============================================================
  // WhatsApp — conversa principal emocional e conversacional (§11)
  // ============================================================
  whatsapp: {
    papel: "conversa principal emocional e conversacional",
    permite: [
      "check_in_proativo",
      "acolhimento",
      "registro_rapido_via_conversa",
      "follow_up_contextual",
      "micro_interacao",
      "continuidade_contextual",
      "audio_em_acolhimento_ou_conquista", // §23
    ],
    nao_permite: [
      "navegacao_estruturada",
      "visualizacao_de_dados_complexos",
      "edicao_estruturada_do_kolo_vivo",
      "audio_operacional",
      "audio_em_pergunta_simples", // §23
    ],
    forma: {
      tom_dominante: "humano, curto, contextual",
      tamanho_tipico: "1-3 frases",
      perguntas_por_turno_max: 1,
      permite_audio: true,
    },
  },

  // ============================================================
  // App — visualização da jornada da criança (§11)
  // ============================================================
  app: {
    papel: "visualização da jornada da criança",
    permite: [
      "linha_do_tempo_evolutiva",
      "visualizacao_padroes",
      "edicao_kolo_vivo",
      "revisao_sugestoes_pendentes",
      "consulta_historico",
      "consulta_estrategias_salvas",
      "navegacao_estruturada",
    ],
    nao_permite: [
      "grande_chat_persistente",
      "interacao_proativa_continua",
      "substituicao_da_conversa_no_whatsapp",
      "notificacoes_estilo_chatbot",
    ],
    forma: {
      tom_dominante: "informativo, contextual, sóbrio",
      tamanho_tipico: "blocos visuais — não chat",
      perguntas_por_turno_max: 1,
      permite_audio: false,
    },
  },
};

/**
 * Mensagens proativas SEMPRE vão no WhatsApp (§9 + §11). Esta constante
 * existe pra deixar a invariante explícita no código.
 */
export const CANAL_PROATIVO: Canal = "whatsapp";

/**
 * Helper sincronizado: dado um comportamento desejado, retorna o canal
 * apropriado. Lança erro se o comportamento não estiver mapeado em
 * nenhum canal.
 *
 * Implementação leve (pura consulta de constantes) — pode ser usado em
 * tempo de execução sem stub.
 */
export function canalPara(
  comportamento: string,
): { canal: Canal; permitido: true } | { canal: null; permitido: false; motivo: string } {
  for (const canalKey of Object.keys(CANAIS) as Canal[]) {
    if (CANAIS[canalKey].permite.includes(comportamento)) {
      return { canal: canalKey, permitido: true };
    }
  }
  // Não permitido em lugar nenhum? Ou só não mapeado?
  for (const canalKey of Object.keys(CANAIS) as Canal[]) {
    if (CANAIS[canalKey].nao_permite.includes(comportamento)) {
      return {
        canal: null,
        permitido: false,
        motivo: `'${comportamento}' está explicitamente bloqueado no canal '${canalKey}' (§11).`,
      };
    }
  }
  return {
    canal: null,
    permitido: false,
    motivo: `'${comportamento}' não está mapeado em CANAIS — adicione ao contrato antes de usar.`,
  };
}
