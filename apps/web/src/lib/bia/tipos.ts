/**
 * BIA — Biblioteca de Inteligência da Ayla: vocabulário canônico e tipos.
 *
 * ⚠️ NADA AQUI É IMPORTADO POR NINGUÉM AINDA — e isso é de propósito.
 *
 * Esta etapa é INFRAESTRUTURA: existe a tabela (migração 0071), existe o
 * importer (scripts/bia/) e existe este contrato de tipos. O prompt, o decisor
 * de entrega, os planos e os PDFs continuam exatamente como estavam. Quando a
 * BIA for integrada, é daqui que o retriever vai partir — não de strings soltas
 * espalhadas pelo código, que foi o que aconteceu com os domínios do Kolo Vivo
 * antes de `lib/kolo-vivo/campos.ts` existir.
 *
 * A FONTE DA VERDADE do vocabulário são os CHECKs da migração 0071. Estas listas
 * são o espelho em TypeScript. Se divergirem, o banco recusa o INSERT — a
 * inconsistência aparece na importação, não em silêncio numa resposta.
 *
 * FRONTEIRA COM AS BOAS PRÁTICAS (importante, é o principal risco de duplicação):
 *   boas_praticas → O QUE FAZER. 368 fichas curadas. Fonte da verdade, intocada.
 *   bia_chunks    → COMO PENSAR antes de escolher o que fazer.
 * Um trecho da BIA que vira "faça X com a criança" provavelmente é uma BP, não
 * um chunk de BIA. Na dúvida, não duplicar.
 */

// ============================================================
// Núcleos
// ============================================================

/**
 * Os 12 núcleos + o transversal + a Parte I + o anexo. Fechado de propósito:
 * "não invente novos núcleos durante a importação". Trecho que não couber vai
 * pra revisão, nunca pra um núcleo novo.
 */
export const BIA_NUCLEOS = [
  "fundamentos",
  "regulacao_emocional",
  "sono",
  "alimentacao",
  "rotina",
  "sensorial",
  "comunicacao",
  "imitacao",
  "socializacao",
  "motor",
  "autonomia",
  "aprendizagem",
  "foco_executivas",
  "pensamentos_crencas",
  "brincadeiras_atividades",
] as const;

export type BiaNucleo = (typeof BIA_NUCLEOS)[number];

/** Rótulo legível — para o painel admin e para conferência da importação. */
export const BIA_NUCLEO_LABEL: Record<BiaNucleo, string> = {
  fundamentos: "Fundamentos de condução",
  regulacao_emocional: "Regulação Emocional",
  sono: "Sono e Descanso",
  alimentacao: "Alimentação e Nutrição",
  rotina: "Rotina, Previsibilidade e Organização do Dia",
  sensorial: "Processamento Sensorial",
  comunicacao: "Comunicação",
  imitacao: "Imitação e Aprendizado por Observação",
  socializacao: "Socialização e Conexões Sociais",
  motor: "Desenvolvimento Motor e Planejamento do Corpo",
  autonomia: "Autonomia e Atividades da Vida Diária",
  aprendizagem: "Aprendizagem e Construção do Conhecimento",
  foco_executivas: "Foco, Atenção e Funções Executivas",
  pensamentos_crencas: "Pensamentos, sentimentos e crenças (transversal)",
  brincadeiras_atividades: "Brincadeiras e atividades (catálogo)",
};

// ============================================================
// Tipo de conhecimento
// ============================================================

/**
 * Os 15 tipos da especificação, sem acréscimos.
 *
 * NOTA DE CLASSIFICAÇÃO: "crenças limitantes" e "erros comuns dos adultos" —
 * dois blocos grandes e valiosos da BIA — entram hoje como `interpretacao`,
 * porque são reenquadres de uma leitura equivocada. Se virarem tipo próprio
 * (`crenca_limitante`), é um CHECK na 0071 e uma entrada aqui. Decisão em
 * aberto, registrada em docs/bia-infraestrutura.md.
 */
export const BIA_TIPOS_CONHECIMENTO = [
  "fundamento",
  "conceito",
  "pergunta_investigativa",
  "interpretacao",
  "estrategia",
  "regra_operacional",
  "principio_de_ouro",
  "explicacao_para_familia",
  "orientacao_para_escola",
  "sinal_de_alerta",
  "encaminhamento",
  "brincadeira",
  "atividade",
  "ferramenta",
  "cautela_cientifica",
] as const;

export type BiaTipoConhecimento = (typeof BIA_TIPOS_CONHECIMENTO)[number];

// ============================================================
// Nível de cautela
// ============================================================

/**
 * Escala de segurança. NÃO substitui o PISO do Core
 * (lib/conducao/diretrizes.ts) — o PISO vale acima de tudo, sempre. Isto é um
 * filtro de RECUPERAÇÃO: um chunk `requer_encaminhamento` não deveria ser
 * servido como se fosse orientação de rotina.
 */
export const BIA_NIVEIS_CAUTELA = [
  "baixo",
  "moderado",
  "alto",
  "nao_usar_sem_contexto",
  "requer_encaminhamento",
] as const;

export type BiaNivelCautela = (typeof BIA_NIVEIS_CAUTELA)[number];

// ============================================================
// Público
// ============================================================

export const BIA_PUBLICOS = ["familia", "escola", "terapeuta"] as const;
export type BiaPublico = (typeof BIA_PUBLICOS)[number];

// ============================================================
// Mapa núcleo da BIA → domínios do Kolo Vivo
// ============================================================

/**
 * A ponte entre o conhecimento (BIA) e o que sabemos DESTA criança (Kolo Vivo).
 *
 * Sem este mapa, um retriever futuro não consegue usar o perfil como filtro —
 * os 12 núcleos e os 20 domínios de `lib/kolo-vivo/campos.ts` têm nomes
 * diferentes e granularidades diferentes. As chaves à direita são exatamente
 * `MEMBRO_CAMPOS_TODOS`.
 *
 * A relação é 1:N nos dois sentidos e isso é esperado: `emocional` alimenta
 * tanto Regulação Emocional quanto o capítulo transversal de crenças.
 *
 * Não há import de `campos.ts` aqui de propósito — este módulo é neutro e não
 * puxa nada do resto do app nesta etapa. A conferência de que as chaves batem é
 * feita na integração, quando houver um consumidor.
 */
export const BIA_NUCLEO_PARA_DOMINIOS: Record<BiaNucleo, readonly string[]> = {
  fundamentos: [],
  regulacao_emocional: ["emocional", "desafios_regulacao"],
  sono: ["sono"],
  alimentacao: ["nutricional"],
  rotina: ["rotina", "corpo_rotina"],
  sensorial: ["sensorial"],
  comunicacao: ["comunicacao"],
  imitacao: ["imitacao"],
  socializacao: ["socializacao"],
  motor: ["motor"],
  autonomia: ["autonomia"],
  aprendizagem: ["aprendizado", "escola"],
  foco_executivas: ["foco"],
  pensamentos_crencas: ["emocional"],
  brincadeiras_atividades: ["gostos", "como_e"],
};

/** Inverso: domínio do perfil → núcleos da BIA que podem ajudar. */
export function nucleosParaDominio(dominio: string): BiaNucleo[] {
  return BIA_NUCLEOS.filter((n) => BIA_NUCLEO_PARA_DOMINIOS[n].includes(dominio));
}

// ============================================================
// A linha
// ============================================================

/** Espelho de uma linha de `public.bia_chunks` (migração 0071). */
export type BiaChunk = {
  id: string;

  documento_origem: string;
  versao_documento: string;
  pagina_origem: number | null;
  ordem: number;

  titulo: string | null;
  nucleo: BiaNucleo;
  subnucleo: string | null;
  secao: string | null;

  tipo_conhecimento: BiaTipoConhecimento;

  faixa_etaria_min_meses: number | null;
  faixa_etaria_max_meses: number | null;
  faixa_rotulo: string | null;

  publico: BiaPublico[];
  situacoes_relacionadas: string[];
  habilidades_relacionadas: string[];
  diagnosticos_relacionados: string[];
  nucleos_relacionados: string[];

  perguntas_investigativas: string[];
  hipoteses: string[];
  estrategias: string[];
  o_que_evitar: string[];
  quando_encaminhar: string | null;

  nivel_de_cautela: BiaNivelCautela;
  muda_conduta: boolean | null;

  texto_original: string;

  hash: string;
  ativo: boolean;
  revisao_pendente: boolean;
  revisao_motivo: string | null;

  created_at: string;
  updated_at: string;
};

/** O que o importer produz — sem os campos que o banco preenche. */
export type BiaChunkNovo = Omit<
  BiaChunk,
  "id" | "created_at" | "updated_at" | "ativo"
> & { ativo?: boolean };

// ============================================================
// Utilitários de faixa etária
// ============================================================

/** Anos → meses. A BIA raciocina em anos; o perfil guarda data de nascimento. */
export function anosParaMeses(anos: number): number {
  return Math.round(anos * 12);
}

/**
 * Uma faixa da BIA serve para esta idade?
 *
 * Faixa aberta (null dos dois lados) serve sempre — é conhecimento geral do
 * núcleo, não específico de idade. Mesma semântica de `faixa_etaria_min/max`
 * em `boas_praticas`, para os dois filtros se comportarem igual.
 */
export function faixaServe(
  chunk: Pick<BiaChunk, "faixa_etaria_min_meses" | "faixa_etaria_max_meses">,
  idadeMeses: number | null,
): boolean {
  if (idadeMeses == null) return true;
  const { faixa_etaria_min_meses: min, faixa_etaria_max_meses: max } = chunk;
  if (min != null && idadeMeses < min) return false;
  if (max != null && idadeMeses > max) return false;
  return true;
}
