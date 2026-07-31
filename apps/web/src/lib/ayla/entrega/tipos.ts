/**
 * TIPOS DA CAMADA DE ENTREGA — ADR 0001.
 *
 * A ideia central: separar, no sistema de tipos, o que é interno do que pode
 * chegar à família. Não é decoração. É o que faz `publicar()` recusar, em tempo
 * de compilação, qualquer coisa que não tenha passado pela Validação — e é a
 * diferença entre "combinamos de validar" e "não dá para não validar".
 *
 * Antes disto a resposta ia ao WhatsApp parágrafo a parágrafo enquanto o modelo
 * gerava. Nunca existia um instante em que a resposta completa estivesse em
 * memória, então não havia onde inspecionar nada — e o que saiu não volta.
 */

// ============================================================
// Texto: bruto × validado
// ============================================================

/** Saída crua do modelo. NUNCA publicável. */
export type TextoBruto = string & { readonly __tipo: "TextoBruto" };

/** Texto aprovado pela Validação. O ÚNICO que `publicar()` aceita. */
export type TextoParaFamilia = string & { readonly __tipo: "TextoParaFamilia" };

/** Marca a saída do modelo. É só uma etiqueta — não valida nada. */
export function comoTextoBruto(s: string): TextoBruto {
  return s as TextoBruto;
}

/**
 * Promove texto a publicável.
 *
 * ⚠️ Só a Validação (`validacao.ts`) e os textos operacionais fixos do próprio
 * repositório podem chamar isto. Chamar daqui de fora derrota o propósito do
 * tipo — existe teste arquitetural cobrando.
 */
export function comoTextoParaFamilia(s: string): TextoParaFamilia {
  return s as TextoParaFamilia;
}

// ============================================================
// Anexos e ferramentas
// ============================================================

export type AnexoParaFamilia = {
  tipo: "documento";
  url: string;
  nomeArquivo: string;
  /** O que este anexo é, para a Montagem checar coerência com o texto. */
  rotulo?: string;
};

/**
 * Erro interno de ferramenta. Existe como TIPO PRÓPRIO para não haver como
 * concatená-lo ao texto sem querer: não é string, então não gruda.
 */
export type ErroInterno = {
  readonly __tipo: "ErroInterno";
  codigo: string;
  detalhe?: string;
};

export function erroInterno(codigo: string, detalhe?: string): ErroInterno {
  return { __tipo: "ErroInterno", codigo, detalhe };
}

/**
 * O que uma ferramenta (plano, rotina, ponte, PDF) devolve ao orquestrador.
 * Ferramenta NÃO publica — ela devolve isto e a Montagem decide.
 */
export type ResultadoFerramenta = {
  tipo: string;
  /** Texto que a ferramenta sugere entregar. Ainda passa por Validação. */
  textoSugerido?: string;
  anexos?: AnexoParaFamilia[];
  erroInterno?: ErroInterno;
};

// ============================================================
// A entrega
// ============================================================

export type TipoResposta =
  /** Conversa: a Ayla respondendo à mãe. */
  | "resposta"
  /** Entregável: plano, rotina, PDF. */
  | "entrega"
  /** Operacional para a família: convite de assinatura, filler, fallback. */
  | "sistema";

/** A única estrutura que `publicar()` aceita. */
export type RespostaFinal = {
  /** A família. (Uma conversa por família no WhatsApp.) */
  conversationId: string;
  /** A inbound que originou esta resposta. Chave de idempotência. */
  sourceMessageId: string;
  /** Quem está publicando. Confere posse. */
  executionId: string;
  phoneE164: string;
  text?: TextoParaFamilia;
  attachments?: AnexoParaFamilia[];
  responseType: TipoResposta;
  /** Segundos de "digitando" na primeira bolha. Preserva o ritmo atual. */
  delayInicialSegundos?: number;
};

// ============================================================
// Estados
// ============================================================

/**
 * Estados de uma execução, conforme o ADR. Os três finais que interessam:
 *  - CEDIDO    — perdeu o agrupamento; outra execução responde por todas
 *  - EXPIRADO  — estourou o tempo; nada publicado
 *  - DESCARTADO— chegou até o fim mas perdeu a posse; NÃO publica, nem fallback
 */
export type EstadoExecucao =
  | "IDLE"
  | "RECEBENDO"
  | "AGRUPANDO"
  | "GERANDO"
  | "VALIDANDO"
  | "PUBLICANDO"
  | "FINALIZADO"
  | "CEDIDO"
  | "EXPIRADO"
  | "DESCARTADO";

export type MotivoDescarte =
  | "posse_perdida"
  | "inbound_mais_recente"
  | "ja_publicado"
  | "execucao_expirada"
  | "sem_conteudo";

export type ResultadoPublicacao =
  | {
      status: "publicado";
      publicationId: string;
      partesConfirmadas: number;
      partesTotais: number;
    }
  | { status: "parcial"; publicationId: string; partesConfirmadas: number; partesTotais: number }
  | { status: "descartado"; motivo: MotivoDescarte }
  | { status: "falha"; publicationId: string; erro: string };
