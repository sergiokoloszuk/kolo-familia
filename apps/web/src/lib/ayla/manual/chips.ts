/**
 * Chips contextuais — Manual §11 (continuidade contextual) + visão
 * de produto da Karina (18/05/2026).
 *
 * Chips são sugestões CONVERSACIONAIS oferecidas pela Ayla pra a mãe puxar
 * tópicos relacionados ao que está vivo no contexto. Não são botões de
 * formulário — são prompts curtos que, se clicados, viram a mensagem
 * inicial de uma nova mini-conversa.
 *
 * Princípio condutor:
 *   "A Ayla não deve apenas responder. Ela deve conduzir a conversa."
 *
 * Esta camada define VOCABULÁRIO + TIPOS + CATÁLOGO INICIAL. A seleção
 * contextual real (qual chip mostrar agora) é stub.
 */

import type { AylaIntent, DominioKolo } from "./types";
import type { TipoEvento } from "./memory";

/**
 * Um chip = um prompt conversacional pré-formado, atrelado a um domínio
 * e a condições contextuais de ativação.
 */
export interface ChipContextual {
  /** Identificador estável — usado em logs e A/B. */
  id: string;

  /** Texto curto que aparece no chip (≤ 32 chars). */
  label: string;

  /** Domínio principal — define a "área" do chip. */
  dominio: DominioKolo;

  /**
   * Prompt completo que vai ao composer quando a mãe clica o chip.
   * Pode usar variáveis `{nome_membro}` que o composer resolve.
   */
  prompt_sugerido: string;

  /**
   * Condições de ativação. O selector mostra o chip se TODAS as condições
   * declaradas estiverem satisfeitas. Vazio = sempre disponível pro domínio.
   */
  ativadores: {
    /** Mostra quando o classifier ativou estes domínios. */
    dominios?: DominioKolo[];
    /** Mostra quando o classifier detectou estes intents. */
    intents?: AylaIntent[];
    /** Mostra após este tipo de evento ter ocorrido recentemente. */
    pos_evento?: TipoEvento[];
    /** Mostra apenas em certa fase da conversa. */
    fase_conversa?: "inicio" | "meio" | "fim";
  };
}

// ============================================================
// CATÁLOGO INICIAL
//
// Cobertura: domínios prioritários (Karina). Tamanho intencionalmente
// pequeno — preferimos poucos chips boa qualidade que muitos genéricos.
// Adicionar chip novo deve ser revisão de produto, não código solto.
// ============================================================

export const CHIPS: ReadonlyArray<ChipContextual> = [
  // ============================================================
  // Socialização (§5.2)
  // ============================================================
  {
    id: "socializacao_brincadeiras_dupla",
    label: "Brincadeiras em dupla",
    dominio: "socializacao",
    prompt_sugerido:
      "Quero ideias de brincadeiras pra {nome_membro} em dupla — algo que sustente o interesse sem sobrecarregar a interação.",
    ativadores: { dominios: ["socializacao"] },
  },
  {
    id: "socializacao_preparar_encontros",
    label: "Como preparar encontros",
    dominio: "socializacao",
    prompt_sugerido:
      "Como preparar {nome_membro} antes de um encontro com outras crianças — antecipação, scripts, ajustes.",
    ativadores: { dominios: ["socializacao"] },
  },
  {
    id: "socializacao_lidar_rejeicao",
    label: "Como lidar com rejeição",
    dominio: "socializacao",
    prompt_sugerido:
      "{nome_membro} viveu uma rejeição (não foi convidado, alguém saiu da brincadeira). Como acolher e organizar isso.",
    ativadores: {
      dominios: ["socializacao"],
      intents: ["desabafo", "crise"],
    },
  },

  // ============================================================
  // Regulação emocional (§5.1, §18)
  // ============================================================
  {
    id: "regulacao_prevenir_crises",
    label: "Como prevenir crises",
    dominio: "regulacao_emocional",
    prompt_sugerido:
      "Quero entender melhor o que pode estar disparando as crises de {nome_membro} pra prevenir antes.",
    ativadores: {
      dominios: ["regulacao_emocional"],
      pos_evento: ["crise_relatada", "meltdown_relatado", "shutdown_relatado"],
    },
  },
  {
    id: "regulacao_sinais_sobrecarga",
    label: "Sinais antes da sobrecarga",
    dominio: "regulacao_emocional",
    prompt_sugerido:
      "Quais são os sinais de pré-sobrecarga em {nome_membro} pra eu agir antes do colapso.",
    ativadores: { dominios: ["regulacao_emocional"] },
  },
  {
    id: "regulacao_o_que_fazer_na_hora",
    label: "O que fazer na hora",
    dominio: "regulacao_emocional",
    prompt_sugerido:
      "Estou no meio de uma crise de {nome_membro} agora. Me ajuda a regular primeiro.",
    ativadores: {
      dominios: ["regulacao_emocional"],
      intents: ["crise"],
    },
  },

  // ============================================================
  // Sono
  // ============================================================
  {
    id: "sono_rotina_noturna",
    label: "Rotina noturna",
    dominio: "sono",
    prompt_sugerido:
      "Quero pensar a rotina noturna de {nome_membro} de novo — o que precede o sono está difícil.",
    ativadores: { dominios: ["sono"] },
  },
  {
    id: "sono_despertares",
    label: "Despertares noturnos",
    dominio: "sono",
    prompt_sugerido:
      "{nome_membro} acorda no meio da noite. Como mapear o que pode estar trazendo isso.",
    ativadores: { dominios: ["sono"] },
  },
  {
    id: "sono_resistencia_dormir",
    label: "Resistência pra dormir",
    dominio: "sono",
    prompt_sugerido:
      "Hora de dormir virou guerra. Como reduzir o atrito gradualmente.",
    ativadores: { dominios: ["sono"], intents: ["desabafo", "pergunta_pratica"] },
  },

  // ============================================================
  // Alimentação
  // ============================================================
  {
    id: "alimentacao_seletividade",
    label: "Seletividade alimentar",
    dominio: "alimentacao",
    prompt_sugerido:
      "Lista de alimentos de {nome_membro} está muito restrita. Como ampliar sem força.",
    ativadores: { dominios: ["alimentacao"] },
  },
  {
    id: "alimentacao_texturas",
    label: "Texturas difíceis",
    dominio: "alimentacao",
    prompt_sugerido:
      "{nome_membro} recusa por textura, não por sabor. Como trabalhar isso.",
    ativadores: { dominios: ["alimentacao", "sensorial"] },
  },
  {
    id: "alimentacao_hora_refeicao",
    label: "Hora da refeição",
    dominio: "alimentacao",
    prompt_sugerido:
      "A refeição em si está virando crise. Como reduzir a pressão da hora.",
    ativadores: { dominios: ["alimentacao"], intents: ["desabafo"] },
  },

  // ============================================================
  // Comunicação
  // ============================================================
  {
    id: "comunicacao_apoios_visuais",
    label: "Apoios visuais",
    dominio: "comunicacao",
    prompt_sugerido:
      "Quero usar apoios visuais com {nome_membro} pra antecipação. Por onde começar.",
    ativadores: { dominios: ["comunicacao"] },
  },
  {
    id: "comunicacao_explicar_situacao",
    label: "Como explicar uma situação",
    dominio: "comunicacao",
    prompt_sugerido:
      "Preciso explicar uma situação difícil pra {nome_membro} (mudança, viagem, perda). Como.",
    ativadores: { dominios: ["comunicacao"] },
  },
  {
    id: "comunicacao_perguntas_repetitivas",
    label: "Perguntas repetitivas",
    dominio: "comunicacao",
    prompt_sugerido:
      "{nome_membro} repete a mesma pergunta o tempo todo. Como ler isso.",
    ativadores: { dominios: ["comunicacao"] },
  },

  // ============================================================
  // Hiperfocos
  // ============================================================
  {
    id: "hiperfoco_aproveitar",
    label: "Usar o hiperfoco",
    dominio: "hiperfocos",
    prompt_sugerido:
      "Como aproveitar o hiperfoco de {nome_membro} como ponte pra outras coisas.",
    ativadores: {
      dominios: ["hiperfocos"],
      pos_evento: ["hiperfoco_evidenciado"],
    },
  },
  {
    id: "hiperfoco_transicao",
    label: "Sair do hiperfoco",
    dominio: "hiperfocos",
    prompt_sugerido:
      "Como ajudar {nome_membro} a transicionar pra fora do hiperfoco sem crise.",
    ativadores: { dominios: ["hiperfocos", "transicoes"] },
  },

  // ============================================================
  // Transições (§19)
  // ============================================================
  {
    id: "transicoes_aviso_previo",
    label: "Aviso prévio",
    dominio: "transicoes",
    prompt_sugerido:
      "Como estruturar avisos prévios em transições do dia de {nome_membro}.",
    ativadores: { dominios: ["transicoes"] },
  },
  {
    id: "transicoes_mudanca_grande",
    label: "Mudança grande",
    dominio: "transicoes",
    prompt_sugerido:
      "Estamos prestes a uma mudança grande (escola, mudança de casa, viagem). Como preparar {nome_membro}.",
    ativadores: { dominios: ["transicoes"] },
  },

  // ============================================================
  // Auto-cuidado da mãe (§5.1, §10)
  // ============================================================
  {
    id: "auto_cuidado_exaustao",
    label: "Tô esgotada",
    dominio: "auto_cuidado_mae",
    prompt_sugerido:
      "Hoje a carga tá alta demais. Não precisa me dar tarefa, só me ajuda a respirar.",
    ativadores: {
      dominios: ["auto_cuidado_mae"],
      intents: ["desabafo", "crise"],
    },
  },
  {
    id: "auto_cuidado_culpa",
    label: "Tô me sentindo culpada",
    dominio: "auto_cuidado_mae",
    prompt_sugerido:
      "Tô carregando culpa de coisa que eu não controlei. Me ajuda a separar o que é meu do que é da situação.",
    ativadores: {
      dominios: ["auto_cuidado_mae"],
      intents: ["desabafo"],
    },
  },
];

// ============================================================
// Contrato (stub)
// ============================================================

/**
 * Input pra seleção de chips: contexto da conversa atual.
 */
export interface ChipsContextoInput {
  dominios_ativos: DominioKolo[];
  intent_atual: AylaIntent | null;
  eventos_recentes_tipos: TipoEvento[];
  fase_conversa: "inicio" | "meio" | "fim";
  /** Quantos chips mostrar no máximo. Default 3. */
  max?: number;
  /** Ids de chips já oferecidos na conversa atual — evita repetição. */
  ids_ja_oferecidos?: string[];
}

/**
 * Seleciona até `max` chips relevantes pro contexto. Implementação real
 * filtra `CHIPS` pelos ativadores e ranqueia por relevância. Stub agora.
 */
export function chipsPara(_contexto: ChipsContextoInput): ChipContextual[] {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/chips.chipsPara — " +
      "stub aguardando lógica de seleção contextual em fase futura.",
  );
}
