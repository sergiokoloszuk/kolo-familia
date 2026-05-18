/**
 * Classifier contextual da Ayla — Manual §7.
 *
 * Camada de classificação leve (Haiku 4.5 em fase futura) que detecta os
 * sinais sobre os quais o resto da arquitetura decide tom, profundidade e
 * modo operacional.
 *
 * Esta fase entrega:
 *   - schema do output
 *   - contrato `classifyMessage()` (stub que lança NOT_IMPLEMENTED)
 *
 * Por que classifier dedicado (e não inferir tudo no composer):
 *   - barato (~$0.0001/mensagem com Haiku) e rápido
 *   - auditável: cada turno tem `classifier_output` registrado
 *   - permite políticas downstream (silêncio, frequência) com input estruturado
 *   - separa "ler a mensagem" de "compor resposta"
 */

import type {
  AylaIntent,
  AylaMode,
  Confianca,
  DominioKolo,
  EstadoEmocional,
  Intensidade,
  MembroAtipicoId,
  NecessidadePrincipal,
  Urgencia,
} from "./types";

/**
 * Output estruturado do classifier. Toda Ayla v2 downstream consome este
 * shape — não passe a mensagem raw pra orquestrador, passe este objeto.
 */
export interface ClassifierOutput {
  /** Intent dominante (§7) — vocabulário fechado. */
  intent: AylaIntent;

  /** Estado emocional percebido (§5, §7). NÃO afirmar à mãe — só guia interno. */
  estado_emocional_percebido: EstadoEmocional;

  /** Intensidade do que foi expressado. */
  intensidade: Intensidade;

  /** Urgência da situação — pode mudar política de envio. */
  urgencia: Urgencia;

  /**
   * Domínios ativados pela mensagem (§7). Subconjunto do vocabulário fechado
   * em `./types.ts`. Tipicamente 1-3 itens; mais que isso vira ruído.
   */
  dominios_ativados: DominioKolo[];

  /** Necessidade dominante (§6) — define hierarquia do modo. */
  necessidade_principal: NecessidadePrincipal;

  /**
   * Modo sugerido pelo classifier (§5). O composer pode aceitar ou ajustar.
   * Quando empata, escolhe o de prioridade hierárquica mais alta (§6).
   */
  modo_sugerido: AylaMode;

  /**
   * Membro alvo. Em famílias com múltiplas crianças atípicas, pode estar
   * ausente quando a mensagem é ambígua — nesse caso o orquestrador clarifica.
   * Em v1 (uma criança por conversa) este campo geralmente já vem fixado pela
   * `conversas.membro_atipico_id`.
   */
  membro_alvo: MembroAtipicoId | null;

  /**
   * Confiança geral do classifier (0..1). Abaixo de 0.5, o orquestrador
   * deve preferir clarificar antes de responder substantivamente.
   */
  confianca: Confianca;

  /**
   * Texto curto explicando o raciocínio (1-2 frases). Auditoria + debugging.
   * NÃO mostrar à mãe.
   */
  raciocinio: string;

  /**
   * Sinais detectados que justificam estado/intensidade. Lista curta,
   * descritiva. Usada por `./guardrails.ts` pra validar coerência.
   */
  sinais_detectados: string[];
}

/**
 * Input pro classifier.
 */
export interface ClassifyInput {
  /** Mensagem original da mãe. */
  texto: string;

  /** Canal — afeta interpretação (mensagem curta no WhatsApp é normal). */
  canal: "whatsapp" | "app";

  /**
   * Contexto mínimo da família/membro pra ajudar interpretação. NÃO inclua
   * tudo — só o necessário (idade, primeira característica do perfil).
   */
  contexto: {
    membro_alvo_id: MembroAtipicoId | null;
    membro_alvo_nome: string | null;
    idade_membro: number | null;
    /** "Cansaço alto últimos 3 dias" / "Conquista recente" — uma frase só. */
    estado_recente_resumo: string | null;
  };

  /**
   * Últimos 1-2 turnos da conversa atual (texto bruto), pra ajudar a
   * detectar follow-up. Limite curto pra não inflar o prompt.
   */
  turnos_anteriores: Array<{
    direcao: "inbound" | "outbound";
    texto: string;
  }>;
}

/**
 * Contrato — implementação real chamará Claude Haiku 4.5 com structured output.
 *
 * Modelo recomendado: `claude-haiku-4-5-20251001`
 * Temperature: 0 (determinístico)
 * Max tokens: ~300
 *
 * Custos esperados: ~$0.0001-0.0003 por chamada.
 *
 * @throws Error com `NOT_IMPLEMENTED` até a fase de implementação do classifier.
 */
export async function classifyMessage(
  _input: ClassifyInput,
): Promise<ClassifierOutput> {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/classifier.classifyMessage — " +
      "stub aguardando integração com Claude Haiku 4.5 em fase futura.",
  );
}

/**
 * Helper sincronizado: decide o modo a partir do classifier output respeitando
 * a hierarquia §6.
 *
 * Implementação não trivial — fica como stub e exemplo: na implementação real,
 * pode ser que o composer queira mesclar dois modos (ex: acolher e depois
 * orientar no mesmo turno).
 */
export function escolherModoFinal(
  _output: ClassifierOutput,
): AylaMode {
  throw new Error(
    "NOT_IMPLEMENTED: lib/ayla/manual/classifier.escolherModoFinal — " +
      "regras de seleção de modo final virão na fase do composer.",
  );
}
