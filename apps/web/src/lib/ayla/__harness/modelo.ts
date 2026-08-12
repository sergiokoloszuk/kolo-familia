/**
 * O MODELO DE MENTIRA — e o pouco de inteligência que ele precisa ter.
 *
 * ⚠️ A LIÇÃO QUE PAGOU POR ESTE ARQUIVO (11/08/2026). A primeira versão do
 * duplo implementava só `client.messages.stream()`. Metade da Ayla usa
 * `client.messages.create()` — intenção, prontidão da rotina, prontidão do
 * plano, segurança, eventos. Resultado: `client.messages.create is not a
 * function` em três pontos, a prontidão devolvia "erro na avaliação", a
 * montagem da rotina morria, e o turno caía na conversa comum.
 *
 * E eu quase registrei isso como defeito de produto. O portão da Rotina TINHA
 * aberto — a prontidão só é chamada lá dentro. O que estava quebrado era o
 * meu duplo.
 *
 * Por isso este arquivo NÃO devolve "{}" para tudo: ele responde o mínimo
 * plausível por tipo de chamada, reconhecido pelo contrato que vai no `system`.
 * Cada resposta é uma DECISÃO DE CENÁRIO, escrita aqui e visível — nunca um
 * acaso.
 */

export type Registro = { quem: string; system: string; user: string; tudo: string };

/** Como o cenário manda o modelo se comportar num ponto específico. */
export type Roteiro = {
  /** A criança que o parser deve identificar. */
  alvo?: string | null;
  /** Desfecho forçado da prontidão da rotina: "suficiente" gera o quadro. */
  prontidaoRotina?: "suficiente" | "falta" | "orientacao" | "nao_e_rotina";
  /** A sequência que o gerador da rotina deve devolver. */
  rotinaGerada?: unknown;
  /**
   * As skills que o classificador de intenção deve rotear neste turno.
   *
   * ⚠️ SEM ISTO NÃO SE PROVA A LENTE. O duplo devolvia "{}" para a chamada de
   * intenção, e `parseSkills` traduz isso em `[]` — então repertório e lente
   * ficavam vazios POR CONSTRUÇÃO, e um teste de presença mediria o duplo.
   * Quem quiser rotear tem que dizer, por escrito, qual skill roteou.
   *
   * Os nomes precisam existir em `specialist_prompt_templates` no cenário:
   * `parseSkills` valida contra o catálogo e descarta o que não conhece.
   */
  skills?: readonly string[];
};

const texto = (s: unknown): string => {
  if (typeof s === "string") return s;
  try {
    return JSON.stringify(s);
  } catch {
    return String(s);
  }
};

/**
 * Decide a resposta pelo CONTRATO que o chamador mandou no `system`.
 *
 * ⚠️ Reconhecer por trecho de prompt é frágil de propósito: quando um contrato
 * mudar, o duplo para de reconhecer e o cenário QUEBRA em vez de passar verde
 * respondendo bobagem. Falha barulhenta é o comportamento desejado aqui.
 */
export function responder(system: string, user: string, r: Roteiro): string {
  const s = `${system}\n${user}`;

  // PARSER — identifica a criança e os sinais do turno.
  if (/membro_atipico_id/.test(s)) {
    return JSON.stringify({
      membro_atipico_id: r.alvo ?? null,
      confianca_identificacao: r.alvo ? 95 : 0,
      conquista: null,
      desafio: null,
      emocao_mae: null,
      possivel_gatilho: null,
      observacao_livre: null,
      quem_estava: null,
      estado_adulto: null,
      reacao_adulto: null,
      confianca_camada_adulto: 0,
      sugestao_kolo_vivo: false,
      confianca: 90,
    });
  }

  // CLASSIFICADOR DE INTENÇÃO — devolve UMA LINHA, `intencao|tema|aceite|skills`.
  // Só responde quando o cenário pediu skills; sem isso continua caindo no "{}"
  // de antes, e nada do comportamento já medido muda.
  if (r.skills?.length && /intencao\|tema/.test(s)) {
    return `outro|-|-|${r.skills.join(", ")}`;
  }

  // PRONTIDÃO DA ROTINA — o portão que decide montar, orientar ou sair.
  if (/desfecho/.test(s) && /rotina/i.test(s)) {
    return JSON.stringify({
      desfecho: r.prontidaoRotina ?? "orientacao",
      tamanho: "rotina",
      visual: false,
      motivo: "cenário",
    });
  }

  // GERADOR DA ROTINA — a sequência em si.
  if (r.rotinaGerada && /(tarefas|sequencia|sequência)/i.test(s)) {
    return JSON.stringify(r.rotinaGerada);
  }

  return "{}";
}

/** O cliente Anthropic falso, com `create` E `stream` — os dois existem. */
export function clienteFalso(roteiro: Roteiro, registros: Registro[]) {
  const responderE = (args: { system?: unknown; messages?: unknown }, quem: string) => {
    const system = texto(args.system);
    const user = texto(args.messages);
    registros.push({ quem, system, user, tudo: `${system}\n${user}` });
    return {
      content: [{ type: "text" as const, text: responder(system, user, roteiro) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };
  };

  return {
    messages: {
      create: async (args: { system?: unknown; messages?: unknown }) => responderE(args, "create"),
      stream: (args: { system?: unknown; messages?: unknown }) => ({
        finalMessage: async () => responderE(args, "stream"),
      }),
    },
  };
}
