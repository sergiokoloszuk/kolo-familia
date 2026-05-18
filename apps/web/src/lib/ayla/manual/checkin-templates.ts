/**
 * Templates de check-in proativo natural — Manual §9, §16.
 *
 * Princípio condutor:
 *
 *   "O check-in diário NÃO deve parecer formulário.
 *    Precisa funcionar como micro conversa natural."
 *
 * Cada template é uma frase humana, curta, contextual, fácil de responder.
 * NUNCA texto longo, NUNCA múltiplos temas, NUNCA "bom dia / como vai
 * tudo na vida".
 *
 * Esta camada é VOCABULÁRIO + CATÁLOGO + CONTRATO. A seleção real do
 * template a usar fica como stub.
 */

import type { TipoCheckIn } from "./proactive";
import type { DominioKolo } from "./types";

/**
 * Variáveis que o composer resolve antes de mandar:
 *   {nome_membro}     — primeiro nome do membro alvo
 *   {nome_mae}        — como_chamar / nome_mae (já no v1)
 *   {evento_recente}  — descrição curta do evento que ancora (1 frase)
 *   {estrategia_nome} — nome da estratégia sugerida em turno anterior
 *   {dominio_humano}  — versão "falável" do domínio (ex: "sono" → "o sono")
 *
 * Se uma variável não puder ser resolvida no contexto, o template é
 * descartado pela seleção e outro é escolhido.
 */

export interface CheckInTemplate {
  /** Identificador estável. */
  id: string;

  /** Qual tipo de check-in atende. */
  tipo: TipoCheckIn;

  /**
   * Texto da mensagem com variáveis `{...}`. Mantenha ≤ 2 frases, ≤ 25
   * palavras. Limite hard do Manual §16.
   */
  texto: string;

  /** Variáveis usadas no template — todas devem ser resolvíveis no contexto. */
  exige_contexto: ReadonlyArray<
    | "nome_membro"
    | "nome_mae"
    | "evento_recente"
    | "estrategia_nome"
    | "dominio_humano"
  >;

  /** Tom dominante (orienta seleção quando há vários candidatos). */
  tom: "casual" | "cuidadoso" | "alegre" | "sobrio";

  /** Domínio com o qual o template se alinha (se houver). */
  dominio_alinhado?: DominioKolo;

  /**
   * Condições que DESQUALIFICAM o template. Descritivo — vira input pro
   * selector. Ex: "mãe em estado emocional baixo" não combina com
   * template alegre.
   */
  evita_se?: string[];
}

// ============================================================
// CATÁLOGO INICIAL
//
// 3-5 templates por TipoCheckIn. Diversidade de tom pra adaptar ao estado
// inferido da mãe. Quantos forem necessários pra evitar repetição percebida
// em uma semana.
// ============================================================

export const CHECK_IN_TEMPLATES: ReadonlyArray<CheckInTemplate> = [
  // ============================================================
  // ancorado_evento — refere evento concreto recente
  // ============================================================
  {
    id: "ancorado_dia_dificil_1",
    tipo: "ancorado_evento",
    texto: "Vi que ontem foi difícil. Como tá hoje?",
    exige_contexto: [],
    tom: "cuidadoso",
  },
  {
    id: "ancorado_evento_especifico_1",
    tipo: "ancorado_evento",
    texto:
      "{evento_recente} ficou na minha cabeça aqui também. Como vocês tão hoje?",
    exige_contexto: ["evento_recente"],
    tom: "cuidadoso",
  },
  {
    id: "ancorado_conquista_1",
    tipo: "ancorado_evento",
    texto: "Ontem teve aquela coisa boa com {nome_membro}. Continuou?",
    exige_contexto: ["nome_membro"],
    tom: "alegre",
    evita_se: ["mãe em estado emocional baixo"],
  },
  {
    id: "ancorado_dominio_recente_1",
    tipo: "ancorado_evento",
    texto: "{dominio_humano} ainda tá apertado por aí?",
    exige_contexto: ["dominio_humano"],
    tom: "casual",
  },

  // ============================================================
  // follow_up_estrategia — checa se algo testou / como foi
  // ============================================================
  {
    id: "follow_up_estrategia_aberto_1",
    tipo: "follow_up_estrategia",
    texto:
      "Você testou {estrategia_nome}? Vale me contar como foi quando tiver um respiro.",
    exige_contexto: ["estrategia_nome"],
    tom: "sobrio",
  },
  {
    id: "follow_up_estrategia_aberto_2",
    tipo: "follow_up_estrategia",
    texto:
      "Sem cobrança — só me ocorri da {estrategia_nome}. Se já tentou, me conta.",
    exige_contexto: ["estrategia_nome"],
    tom: "cuidadoso",
  },
  {
    id: "follow_up_estrategia_minimo_1",
    tipo: "follow_up_estrategia",
    texto: "Aquela ideia que conversamos sobre {dominio_humano} — funcionou em algo?",
    exige_contexto: ["dominio_humano"],
    tom: "casual",
  },

  // ============================================================
  // observacao_leve — micro check-in sem peso
  // ============================================================
  {
    id: "observacao_leve_1",
    tipo: "observacao_leve",
    texto: "Oi. {nome_membro} bem?",
    exige_contexto: ["nome_membro"],
    tom: "casual",
  },
  {
    id: "observacao_leve_2",
    tipo: "observacao_leve",
    texto: "Como vocês tão hoje?",
    exige_contexto: [],
    tom: "casual",
  },
  {
    id: "observacao_leve_3",
    tipo: "observacao_leve",
    texto: "Passando rápido pra saber se hoje tá fluindo.",
    exige_contexto: [],
    tom: "sobrio",
  },
  {
    id: "observacao_leve_mae_1",
    tipo: "observacao_leve",
    texto: "E você, como tá hoje?",
    exige_contexto: [],
    tom: "cuidadoso",
    evita_se: ["mãe respondeu sobre si nos últimos 3 dias"],
  },

  // ============================================================
  // percepcao_evolutiva — mostra memória viva (§5.4)
  // ============================================================
  {
    id: "percepcao_evolutiva_1",
    tipo: "percepcao_evolutiva",
    texto:
      "Tô notando algo nas últimas semanas com {nome_membro} — em {dominio_humano}. Quer puxar essa conversa?",
    exige_contexto: ["nome_membro", "dominio_humano"],
    tom: "sobrio",
  },
  {
    id: "percepcao_evolutiva_2",
    tipo: "percepcao_evolutiva",
    texto:
      "Acho que algo mudou — tem uma coisa em {dominio_humano} que parece diferente das últimas semanas. Te ocorre o quê?",
    exige_contexto: ["dominio_humano"],
    tom: "sobrio",
  },
];

// ============================================================
// Mapeamento auxiliar — DominioKolo → forma falável
//
// Vocabulário fechado, traduz o domínio técnico em PT-BR natural.
// Usado na resolução de `{dominio_humano}`.
// ============================================================

export const DOMINIO_HUMANO: Record<DominioKolo, string> = {
  sono: "o sono",
  alimentacao: "a alimentação",
  comunicacao: "a comunicação",
  socializacao: "a parte social",
  sensorial: "a parte sensorial",
  regulacao_emocional: "a regulação",
  hiperfocos: "o hiperfoco",
  rotina: "a rotina",
  transicoes: "as transições",
  autonomia: "a autonomia",
  auto_cuidado_mae: "você",
  familia: "a casa",
  escola: "a escola",
  saude: "a saúde",
};

// ============================================================
// Contrato (stub)
// ============================================================

export interface SelecionarTemplateInput {
  tipo: TipoCheckIn;
  contexto_disponivel: Record<string, string | undefined>;
  /** Estado emocional inferido da mãe (afeta seleção de tom). */
  estado_mae?: string;
  /** Templates já usados em janela recente, pra evitar repetição. */
  ids_usados_recentemente?: string[];
}

/**
 * Seleciona um template apropriado: filtra os que exigem variáveis não
 * disponíveis, descarta os usados recentemente, prefere tom adequado ao
 * estado. Stub.
 */
export function selecionarTemplate(
  _input: SelecionarTemplateInput,
): CheckInTemplate | null {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/checkin-templates.selecionarTemplate — " +
      "stub aguardando lógica de seleção em fase futura.",
  );
}

/**
 * Resolve variáveis `{...}` no texto do template usando o contexto. Falha
 * (retorna null) se alguma variável exigida não puder ser resolvida.
 */
export function renderizarTemplate(
  _template: CheckInTemplate,
  _contexto: Record<string, string>,
): string | null {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/checkin-templates.renderizarTemplate — " +
      "stub aguardando implementação em fase futura.",
  );
}
