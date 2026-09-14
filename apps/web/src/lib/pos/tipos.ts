/**
 * A BASE DA PÓS EM NEURODESENVOLVIMENTO — ESTRUTURA.
 *
 * ⚠️ POR QUE UM MÓDULO PRÓPRIO, E NÃO `bia_chunks`. A tentação era óbvia: a
 * BIA já tem tabela, retriever e pontuação. A bancada de 10/09
 * (`scripts/bancada/bia-pos/README.md`) mediu o que aconteceria, e o resultado
 * foi arquitetural, não de ajuste:
 *
 *   1. `montarBlocoBia` renderiza SÓ `texto_original`. `hipoteses`,
 *      `perguntas_investigativas` e `estrategias` são gravados e nunca lidos —
 *      ou seja, o raciocínio da pós teria de ser reescrito como prosa dentro de
 *      um campo de 600 caracteres, perdendo a estrutura que o torna útil.
 *   2. As cotas do bloco DESCARTAM SEMPRE os tipos `principio_de_ouro`,
 *      `explicacao_para_familia` e `fundamento` — isto é, a §1 e a §10 de A
 *      inteiras, que são exatamente a filosofia de raciocínio.
 *   3. `ContextoBia.dominio` aceita UM domínio, e metade do raciocínio da pós é
 *      cross-domain ("dispersão no foco → investigue o sensorial" vive em
 *      dois). `nucleos_relacionados` existe no schema e não é lido.
 *
 * A BIA é um corpus amplo pontuado por aderência textual. A pós é um GRAFO DE
 * PRÉ-REQUISITOS com regras de decisão. Forçar a segunda na primeira foi o que
 * produziu, em 05/09, 14 chunks gigantes e a conclusão falsa de "sem ganho".
 *
 * ⚠️ E AS TRÊS FONTES CONTINUAM SEPARADAS, por papel:
 *   Boas Práticas → repertório: o que FAZER amanhã de manhã.
 *   Pós           → raciocínio: ONDE está a lacuna e PARA ONDE ir.
 *   BIA           → corpus amplo, frente própria, desligada.
 * Uma unidade da pós que descreva uma atividade concreta está no lugar errado;
 * há teste proibindo.
 */

/** O papel que a unidade cumpre no raciocínio — governa como ela é usada. */
export type PapelDaUnidade =
  /** POR QUE o comportamento acontece. Muda a leitura do relato. */
  | "mecanismo"
  /** Degrau de pré-requisito. Ordena a investigação. */
  | "escada"
  /** SE… ENTÃO. Muda qual pergunta vale mais agora. */
  | "regra_decisao"
  /** Sinal que exige excluir causa orgânica antes de plano comportamental. */
  | "sinal_de_alerta"
  /** O esperado para a idade. Contextualiza; nunca vira régua de cobrança. */
  | "marco_etario"
  /** O que a Ayla NÃO faz. */
  | "limite"
  /** Princípio de raciocínio transversal. */
  | "principio";

/** De onde a unidade veio. A procedência não se perde na estruturação. */
export type FonteDaPos = "A" | "B" | "A+B";

export type UnidadeDaPos = {
  /** Estável e citável na telemetria. Nunca o texto. */
  id: string;
  fonte: FonteDaPos;
  /** Seção literal do documento de origem. */
  secao: string;
  titulo: string;
  papel: PapelDaUnidade;
  /**
   * Domínios do Perfil em que a unidade é pertinente.
   *
   * ⚠️ LISTA, NÃO UM VALOR — é a correção direta do achado 2 da bancada da BIA.
   * "Dispersão no foco investiga o sensorial" pertence a `foco` E `sensorial`;
   * num modelo de domínio único ela some do turno que mais precisa dela.
   */
  temas: readonly string[];
  /** O que, na fala da mãe, aciona esta unidade. Vazio = só por tema. */
  gatilhos: readonly RegExp[];
  /** Janela etária em meses. `null` = vale para qualquer idade. */
  faixaMesesMin: number | null;
  faixaMesesMax: number | null;
  /**
   * O RACIOCÍNIO — é isto que chega à Ayla, e só isto.
   *
   * Escrito como explicação de mecanismo, não como fala para a família: o Core
   * governa a voz. Curto porque o orçamento do turno é curto.
   */
  mecanismo: string;
  /**
   * Campos do Perfil que esta unidade manda olhar, em `dominio.campo`.
   *
   * ⚠️ NÃO É A PERGUNTA. É o CAMPO. A redação é da Ayla — a pós entregar a
   * pergunta literal ("Quando você entra no quarto, ela desvia o foco?") é o
   * caminho mais curto para o interrogatório que o §14 proíbe.
   */
  investigar: readonly string[];
  /** Ids de unidades que precisam estar resolvidas ANTES desta. O grafo. */
  prerequisitos: readonly string[];
  /**
   * Para onde ir. DIREÇÃO, nunca atividade.
   *
   * "Sustentar a atenção compartilhada antes de cobrar palavra" é direção.
   * "Segure o biscoito ao lado do rosto e espere 5 segundos" é Boa Prática — e
   * se aparecer aqui, duplica o acervo e desalinha as duas fontes.
   */
  direcao: string | null;
  /** O limite que anda junto com esta unidade. */
  cautela: string | null;
  /** Citação rastreável, quando a fonte tem. A não tem; B tem. */
  procedencia: string | null;
  /**
   * JÁ ESTÁ NO CORE v11 — medido em 10/09 contra `ayla_documentos`.
   *
   * ⚠️ NÃO SIGNIFICA "DESCARTAR". Significa que a unidade NÃO é injetada no
   * prompt (o Core já a diz, e melhor, na voz da Ayla), mas continua valendo
   * como pré-requisito no grafo e como critério de ordenação. Sem esta marca,
   * a pós repetiria no contexto o que já é piso.
   */
  jaNoCore: boolean;
};

/**
 * O QUE FOI DELIBERADAMENTE **NÃO PROMOVIDO** — e por quê.
 *
 * ⚠️ ESTA LISTA É PARTE DA BASE, não um apêndice. "Pós integral" não significa
 * "tudo vira contexto de conversa": significa que nada foi descartado em
 * silêncio. Um item aqui é uma decisão registrada, com motivo, auditável — e um
 * teste lê os dois documentos originais e exige que TODA seção esteja coberta
 * por uma unidade ou por uma linha desta lista.
 */
export type NaoPromovido = {
  fonte: FonteDaPos;
  secao: string;
  o_que: string;
  motivo: string;
  /** Onde aquilo vive, se vive em outro lugar do produto. */
  vive_em: string | null;
};
