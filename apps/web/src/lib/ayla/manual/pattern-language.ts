/**
 * Linguagem observacional pra descrição de padrões hipotéticos.
 *
 * Princípio condutor (Karina, 18/05/2026):
 *
 *   "as hipóteses NÃO devem parecer diagnóstico.
 *    Quero linguagem observacional.
 *
 *    Exemplo correto:
 *      'ambientes mais barulhentos parecem aumentar irritação no fim do dia'
 *
 *    Evitar:
 *      - interpretações clínicas
 *      - excesso de assertividade
 *      - linguagem patologizante"
 *
 * Este módulo é vocabulário + templates + verificador. Quando o motor de
 * avaliação de padrões gera descrição, passa por aqui pra garantir tom.
 */

import type { DominioKolo } from "./types";

// ============================================================
// Vocabulário aprovado / proibido
// ============================================================

/**
 * Verbos e expressões aprovados — sinalizam observação, não certeza.
 * Use estes ao construir descrições.
 */
export const VERBOS_APROVADOS = [
  "parece",
  "aparenta",
  "tende a",
  "costuma",
  "geralmente",
  "frequentemente",
  "às vezes",
  "às vezes parece",
  "tem aparecido",
  "tem se repetido",
  "aparece junto com",
  "vem antes de",
  "vem depois de",
  "diminui após",
  "aumenta após",
] as const;

/**
 * Verbos e expressões PROIBIDAS — afirmação clínica/patologizante/assertiva
 * demais. Se aparecerem, a descrição é rejeitada e o motor refaz.
 */
export const VERBOS_PROIBIDOS = [
  // Certeza absoluta
  "é",
  "tem",                  // "tem TDAH", "tem SPM"...
  "sofre de",
  "apresenta",
  "manifesta",

  // Linguagem clínica
  "transtorno",
  "comorbidade",
  "patologia",
  "patológic",
  "sindrome",
  "síndrome",
  "diagnóstico",
  "diagnostic",
  "déficit",
  "deficit",
  "disfunção",
  "deficiencia",
  "deficiência",
  "anormal",

  // Causalidade implícita
  "causa",
  "provoca",
  "resulta de",
  "decorre de",
  "deve-se a",
  "por causa",

  // Coaching/motivação
  "supera",
  "vence",
  "conquista",          // "vai conquistar X" — não no nosso vocabulário
  "transforma",
] as const;

// ============================================================
// Templates de descrição por heurística
//
// As heurísticas (em `avaliar-padroes.ts`) escolhem um template e
// preenchem variáveis. NUNCA inventar template fora desta lista.
// ============================================================

export type TipoHeuristica =
  | "recorrencia_temporal"        // evento X repete em janela K
  | "co_ocorrencia_dominios"      // domínio A e B aparecem juntos
  | "padrao_horario"              // eventos concentram em hora do dia
  | "sucessao_eventos"            // evento A precede evento B
  | "estrategia_efeito_positivo"  // após estrategia, eventos negativos caem
  | "estrategia_efeito_negativo"  // após estrategia, eventos negativos sobem
  | "frequencia_crescente"        // tipo X em domínio Y cresceu no tempo
  | "frequencia_decrescente";     // tipo X em domínio Y caiu no tempo

export interface TemplateObservacional {
  heuristica: TipoHeuristica;
  /**
   * Texto com `{variaveis}`. Sempre começa com verbo aprovado.
   * NÃO inclui ponto final — adicionado em renderização.
   */
  texto: string;
  /** Variáveis exigidas pra renderizar. */
  exige: ReadonlyArray<string>;
}

export const TEMPLATES: ReadonlyArray<TemplateObservacional> = [
  // recorrencia_temporal
  {
    heuristica: "recorrencia_temporal",
    texto:
      "{tipo_evento_humano} em {dominio_humano} tem aparecido com mais frequência nas últimas {janela_humana}",
    exige: ["tipo_evento_humano", "dominio_humano", "janela_humana"],
  },
  {
    heuristica: "recorrencia_temporal",
    texto:
      "{tipo_evento_humano} vem se repetindo em {dominio_humano} — {contagem} ocorrências em {janela_humana}",
    exige: ["tipo_evento_humano", "dominio_humano", "contagem", "janela_humana"],
  },

  // co_ocorrencia_dominios
  {
    heuristica: "co_ocorrencia_dominios",
    texto:
      "eventos em {dominio_a_humano} aparecem junto com eventos em {dominio_b_humano} em parte significativa das ocorrências",
    exige: ["dominio_a_humano", "dominio_b_humano"],
  },
  {
    heuristica: "co_ocorrencia_dominios",
    texto:
      "tem havido sobreposição entre {dominio_a_humano} e {dominio_b_humano} nos registros recentes",
    exige: ["dominio_a_humano", "dominio_b_humano"],
  },

  // padrao_horario
  {
    heuristica: "padrao_horario",
    texto:
      "eventos em {dominio_humano} tendem a se concentrar {periodo_dia_humano}",
    exige: ["dominio_humano", "periodo_dia_humano"],
  },

  // sucessao_eventos
  {
    heuristica: "sucessao_eventos",
    texto:
      "{tipo_a_humano} costuma vir antes de {tipo_b_humano} num intervalo curto",
    exige: ["tipo_a_humano", "tipo_b_humano"],
  },

  // estrategia_efeito_positivo
  {
    heuristica: "estrategia_efeito_positivo",
    texto:
      "depois de {estrategia_nome_humano}, eventos difíceis em {dominio_humano} parecem ter diminuído",
    exige: ["estrategia_nome_humano", "dominio_humano"],
  },

  // estrategia_efeito_negativo
  {
    heuristica: "estrategia_efeito_negativo",
    texto:
      "depois de {estrategia_nome_humano}, eventos difíceis em {dominio_humano} parecem ter aumentado",
    exige: ["estrategia_nome_humano", "dominio_humano"],
  },

  // frequencia_crescente
  {
    heuristica: "frequencia_crescente",
    texto:
      "registros de {tipo_evento_humano} em {dominio_humano} têm crescido nos últimos meses",
    exige: ["tipo_evento_humano", "dominio_humano"],
  },

  // frequencia_decrescente
  {
    heuristica: "frequencia_decrescente",
    texto:
      "registros de {tipo_evento_humano} em {dominio_humano} têm diminuído nos últimos meses",
    exige: ["tipo_evento_humano", "dominio_humano"],
  },
];

// ============================================================
// Traduções domínio/janela/tipo → forma falável
// ============================================================

export const DOMINIO_LABEL: Record<DominioKolo, string> = {
  sono: "sono",
  alimentacao: "alimentação",
  comunicacao: "comunicação",
  socializacao: "socialização",
  sensorial: "perfil sensorial",
  regulacao_emocional: "regulação",
  hiperfocos: "hiperfocos",
  rotina: "rotina",
  transicoes: "transições",
  autonomia: "autonomia",
  auto_cuidado_mae: "auto-cuidado da mãe",
  familia: "família",
  escola: "escola",
  saude: "saúde",
};

/** Traduz um tipo de evento pra forma humana neutra (sem dramatizar). */
export const TIPO_EVENTO_LABEL: Record<string, string> = {
  crise_relatada: "momentos difíceis",
  meltdown_relatado: "crises externalizadas",
  shutdown_relatado: "momentos de desligamento",
  conquista_relatada: "conquistas",
  melhora_relatada: "melhoras",
  regressao_observada: "perdas de capacidade",
  sensibilidade_evidenciada: "sensibilidades",
  hiperfoco_evidenciado: "interesses intensos",
  preferencia_revelada: "preferências",
  mudanca_observada: "mudanças",
  mudanca_fase: "transições estruturais",
  estrategia_testada: "estratégias aplicadas",
  conversa_turno: "conversas",
  check_in_resposta: "respostas de check-in",
  follow_up_resposta: "respostas de follow-up",
  registro_explicito: "registros",
};

export const JANELA_LABEL: Record<string, string> = {
  "7d": "7 dias",
  "14d": "2 semanas",
  "30d": "30 dias",
  "90d": "3 meses",
  "6m": "6 meses",
  "12m": "1 ano",
  todo_periodo: "todo o histórico",
};

export const PERIODO_DIA_LABEL = {
  manha: "pela manhã",
  tarde: "à tarde",
  fim_tarde: "no fim da tarde",
  noite: "à noite",
  madrugada: "de madrugada",
} as const;

// ============================================================
// Verificador de tom — recusa descrições com vocabulário proibido
// ============================================================

export interface VerificacaoTom {
  ok: boolean;
  violacoes: Array<{ palavra: string; motivo: string }>;
}

export function verificarTom(descricao: string): VerificacaoTom {
  const lower = descricao.toLowerCase();
  const violacoes: Array<{ palavra: string; motivo: string }> = [];

  for (const proibido of VERBOS_PROIBIDOS) {
    // Match de palavra (com boundary). Pra "é", evita match em "está", "café"...
    const padraoBoundary = new RegExp(
      `(^|[\\s,;:.!?])${proibido}([\\s,;:.!?]|$)`,
      "i",
    );
    if (padraoBoundary.test(lower)) {
      violacoes.push({
        palavra: proibido,
        motivo: "vocabulário clínico/assertivo banido",
      });
    }
  }

  return { ok: violacoes.length === 0, violacoes };
}

// ============================================================
// Renderização — preenche template com variáveis
// ============================================================

export function renderizarTemplate(
  template: TemplateObservacional,
  variaveis: Record<string, string | number>,
): string | null {
  // Confere que todas as variáveis exigidas estão presentes
  for (const v of template.exige) {
    if (variaveis[v] === undefined || variaveis[v] === null) {
      return null;
    }
  }

  let texto = template.texto;
  for (const [chave, valor] of Object.entries(variaveis)) {
    texto = texto.replaceAll(`{${chave}}`, String(valor));
  }
  // Capitaliza primeira letra, adiciona ponto final
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  if (!texto.endsWith(".")) texto += ".";

  return texto;
}

/**
 * Gera descrição final + valida o tom. Falha se não passar verificação.
 * Caller deve tratar `null` como "essa heurística não rende uma descrição
 * apresentável — pular este padrão".
 */
export function descricaoSegura(
  template: TemplateObservacional,
  variaveis: Record<string, string | number>,
): string | null {
  const renderizado = renderizarTemplate(template, variaveis);
  if (!renderizado) return null;
  const verif = verificarTom(renderizado);
  if (!verif.ok) return null;
  return renderizado;
}
