/**
 * Guardrails de linguagem e comportamento da Ayla — Manual §10, §16, §17, §22.
 *
 * Esta camada NÃO faz a chamada LLM nem decide o que dizer. Ela define o que
 * a Ayla NÃO PODE dizer/fazer, como dado declarativo + tipo `Violacao`. O
 * detector real (mistura de regex + LLM-judge) virá em fase posterior;
 * por ora, é uma fundação que outros módulos importam.
 */

import type { AylaMode, Canal } from "./types";

/**
 * Regras de linguagem (§16) — tudo o que define como a Ayla "soa".
 * Estas são lidas no prompt do composer e checadas no validator pós-resposta.
 */
export const REGRAS_LINGUAGEM = {
  /** Estilos PROIBIDOS na voz da Ayla. */
  proibido: [
    "tom_robotico", // §16
    "excesso_tecnico", // §16
    "coaching", // §16, §17
    "mindset", // §17
    "espiritualidade", // §17
    "positividade_toxica", // §17
    "frases_motivacionais", // §16
    "excesso_emojis", // §16
    "exagero_emocional", // §5.1, §16
    "dramatizacao", // §5.1
    "romantizacao", // §5.1
    "infantilizacao", // §5.1
    "tom_clinico_frio",
  ] as const,

  /** Estilos OBRIGATÓRIOS na voz da Ayla. */
  obrigatorio: [
    "humano",
    "claro",
    "leve",
    "maduro",
    "acolhedor",
    "contextual",
    "respeita_silencio",
  ] as const,
} as const;

export type RegraProibida = (typeof REGRAS_LINGUAGEM.proibido)[number];
export type RegraObrigatoria = (typeof REGRAS_LINGUAGEM.obrigatorio)[number];

/**
 * Limites de forma por canal e modo. WhatsApp tem teto bem mais baixo
 * que o app — é conversa, não tela.
 *
 * Valores são TETOS — uma resposta menor é sempre melhor. O composer deve
 * usar estes valores como hard limit e não como meta.
 */
export const LIMITES_FORMA = {
  whatsapp: {
    /** Resposta proativa = 2 frases máx, pergunta única se houver. */
    proativa: {
      frases_max: 2,
      palavras_max: 40,
      perguntas_max: 1,
    },
    /** Resposta reativa pode ser um pouco mais longa que a proativa. */
    reativa: {
      frases_max: 4,
      palavras_max: 80,
      perguntas_max: 1,
    },
  },
  app: {
    proativa: {
      frases_max: 3,
      palavras_max: 60,
      perguntas_max: 1,
    },
    reativa: {
      frases_max: 6,
      palavras_max: 150,
      perguntas_max: 1,
    },
  },
} as const;

/**
 * Limites operacionais (§22) — o que a Ayla NÃO RESOLVE. Quando essas
 * intents são detectadas, ela responde com acolhimento + orientação de canal,
 * não tenta resolver.
 */
export const FORA_DO_ESCOPO = {
  topicos: [
    "pagamento",
    "assinatura",
    "cobranca",
    "suporte_tecnico",
    "login",
    "cancelamento",
    "reembolso",
  ] as const,

  /** Ação esperada quando topic detectado. */
  acao: "orientar_canal_correto_sem_quebra_emocional",
} as const;

/**
 * Crenças e reframes (§17) — internamente a Ayla pode trabalhar reorganização
 * de percepção, mas isso NUNCA aparece como coaching/mindset/espiritualidade.
 *
 * Esta lista é exemplos de TRADUÇÕES aceitáveis (reframe sutil) vs INACEITÁVEIS
 * (linguagem de coach). Usado como referência no prompt do composer.
 */
export const REFRAMES_TONS = {
  aceitavel: [
    "uma nova leitura possível dessa situação",
    "uma maneira de olhar diferente",
    "ampliar a percepção",
    "reorganizar o contexto",
  ],
  inaceitavel: [
    "mude sua mentalidade",
    "vibre alto",
    "atraia o que você quer",
    "transforme sua vida",
    "energia positiva",
    "manifestação",
  ],
} as const;

/**
 * Tipos de violação detectáveis. Algumas são detectáveis por regex,
 * outras precisam de LLM-judge.
 */
export type TipoViolacao =
  | "tom_proibido" // estilo de §16/§17 detectado
  | "muito_longo" // excede LIMITES_FORMA
  | "multiplas_perguntas" // > 1 pergunta em mesmo turno (§5.3, §16)
  | "afirma_diagnostico" // a Ayla nunca diagnostica
  | "estrategia_sem_fonte" // citou estratégia sem id da base Kolo
  | "estrategia_viola_perfil" // estratégia citada conflita com perfil sensorial
  | "mutacao_silenciosa" // alterou perfil sem passar por sugestao_perfil_vivos
  | "follow_up_sem_ancora" // follow-up de coisa antiga (>14d) sem nova evidência
  | "fora_escopo_sem_orientacao"; // §22 — assunto fora de escopo sem orientar canal

export interface Violacao {
  tipo: TipoViolacao;
  severidade: "baixa" | "media" | "alta";
  /** Trecho ofensivo (substring da resposta) ou descritor curto. */
  evidencia: string;
  /** Sugestão de correção (uma frase). */
  sugestao?: string;
}

/**
 * Resultado de uma validação de resposta.
 */
export interface ValidationResult {
  ok: boolean;
  violacoes: Violacao[];
  /**
   * Score normalizado 0..1 — útil pra dashboards.
   * 1.0 = sem violações. 0.0 = inutilizável.
   */
  score: number;
}

/**
 * Input pra validar uma resposta antes de enviá-la.
 */
export interface ValidateInput {
  texto: string;
  modo: AylaMode;
  canal: Canal;
  categoria: "proativa" | "reativa";
  /**
   * Ids de estratégias da base Kolo citadas pelo composer (se houver). O
   * validator confere se esses ids existem em `boas_praticas` ativas e se
   * não violam o perfil sensorial do membro.
   */
  ids_estrategias_citadas: string[];
  /**
   * Perfil sensorial do membro pra checar `estrategia_viola_perfil`. Forma
   * exata será definida quando o classifier estiver implementado — por ora
   * é jsonb opaco.
   */
  perfil_sensorial?: Record<string, unknown>;
}

/**
 * Contrato — implementação real virá em fase posterior.
 *
 * Validações leves (regex / contagem) podem rodar localmente.
 * Validações de tom (coaching, dramatização) usarão LLM-judge (Haiku).
 *
 * @throws Error `NOT_IMPLEMENTED` até implementação.
 */
export async function validateResponse(
  _input: ValidateInput,
): Promise<ValidationResult> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/guardrails.validateResponse — " +
      "stub aguardando detectores (regex local + LLM-judge Haiku) em fase futura.",
  );
}

/**
 * Helper sincronizado: dado um modo + canal, retorna o limite de forma
 * aplicável. Útil pro composer escolher tamanho-alvo antes de gerar.
 */
export function limiteFormaPara(
  canal: Canal,
  categoria: "proativa" | "reativa",
) {
  return LIMITES_FORMA[canal][categoria];
}
