import { logEvent } from "@/lib/log";

/**
 * O RASTRO DO TURNO DE ROTINA — 08/09/2026.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Em 08/09 a Karina pediu uma sequência visual
 * para a Manu e recebeu uma conversa perfeita sobre a sequência — etapas certas,
 * ordem certa, tema perguntado, tema aceito — e **nenhum artefato**. Nenhuma
 * linha em `rotinas`, nenhum link. `conduzirRotina` devolveu `null` e o turno
 * caiu na conversa comum.
 *
 * Existem exatamente dois pontos onde aquele `null` pode nascer, e eu não
 * consegui dizer qual dos dois foi. A decisão era registrada por
 * `console.log("[ayla:rotina] prontidão=…")` — stdout da Vercel, que some com a
 * retenção e que eu não alcanço. Sem isso, corrigir vira adivinhação; e neste
 * dia eu já tinha adivinhado errado três vezes, cada uma custando um teste real
 * na conta de uma família de verdade.
 *
 * ⚠️ O QUE ELE NÃO FAZ: não decide nada. Nenhuma linha aqui altera o
 * comportamento do fluxo. É a Peça 1 do Gate A — tornar observável antes de
 * corrigir —, e essa separação é deliberada: um commit que mede e um commit que
 * muda não podem ser o mesmo, senão não se sabe qual dos dois causou o quê.
 *
 * ⚠️ SEM TABELA NOVA. `logEvent({ persistir: true })` já escreve em
 * `eventos_app` independentemente da severidade — é o mesmo canal que o
 * reconciliador de órfãs usa. Migração é o ponto sem volta deste repositório
 * (§17); não se paga esse preço por telemetria.
 *
 * ⚠️ O QUE NÃO ENTRA. Nada do texto da família, nada do texto da Ayla, nenhum
 * nome de criança. O que se guarda é ESTRUTURA — ids, decisões, contagens,
 * tempos — porque a pergunta que este rastro responde é "por onde o turno
 * passou", não "o que a família disse". §11 e §16 do protocolo.
 */

/** Onde o turno terminou. `null_*` são as saídas silenciosas que nos cegaram. */
export type SaidaDoTurno =
  | "montou"
  | "propos"
  | "perguntou"
  | "tema_aplicado"
  | "tema_recusado"
  | "null_sem_contexto"
  | "null_sem_membro"
  | "null_nao_e_rotina"
  | "null_condutor_saiu"
  | "null_sem_mensagem"
  | "null_excecao";

export type FonteDoTema = "mensagem_atual" | "historico" | "ja_na_rotina" | "nenhuma";

export type RastroRotina = {
  turno: string;
  sha: string | null;
  familia: string;
  membro: string | null;
  /** Só o tamanho: o texto da família não entra no rastro. */
  chars_pedido: number;
  pedido_explicito: boolean | null;
  ditou_sequencia: boolean | null;
  pedido_novo: boolean | null;
  /** A rotina antiga que esperava tema — o capturador do incidente de 09:13. */
  pendente_id: string | null;
  proposta_id: string | null;
  proposta_etapas: number | null;
  prontidao_desfecho: string | null;
  prontidao_motivo: string | null;
  prontidao_tamanho: string | null;
  prontidao_visual: boolean | null;
  acao: string | null;
  saida: SaidaDoTurno | null;
  /** Por que devolveu null, em uma linha, quando devolveu. */
  motivo: string | null;
  rotina_ids: string[];
  rotina_reutilizada: boolean | null;
  etapas_gravadas: number | null;
  tema: string | null;
  tema_fonte: FonteDoTema | null;
  geracao_iniciada: boolean | null;
  cartoes_esperados: number | null;
  status_final: string | null;
  link_entregue: boolean | null;
  /** Quantas vezes o turno leu `perfil_vivo_membro` — a repetição medida. */
  leituras_perfil: number;
  chamadas_llm: number;
  ms: Record<string, number>;
};

export function novoRastro(familia: string, chars: number): RastroRotina {
  return {
    turno: `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    familia,
    membro: null,
    chars_pedido: chars,
    pedido_explicito: null,
    ditou_sequencia: null,
    pedido_novo: null,
    pendente_id: null,
    proposta_id: null,
    proposta_etapas: null,
    prontidao_desfecho: null,
    prontidao_motivo: null,
    prontidao_tamanho: null,
    prontidao_visual: null,
    acao: null,
    saida: null,
    motivo: null,
    rotina_ids: [],
    rotina_reutilizada: null,
    etapas_gravadas: null,
    tema: null,
    tema_fonte: null,
    geracao_iniciada: null,
    cartoes_esperados: null,
    status_final: null,
    link_entregue: null,
    leituras_perfil: 0,
    chamadas_llm: 0,
    ms: {},
  };
}

/**
 * Cronometra uma etapa e a soma ao rastro. O nome vira chave em `ms`.
 *
 * ⚠️ NÃO ENGOLE ERRO. Se a etapa estourar, o tempo é registrado do mesmo jeito
 * e a exceção sobe — um cronômetro que esconde falha é pior que nenhum.
 */
export async function etapa<T>(
  rastro: RastroRotina,
  nome: string,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    rastro.ms[nome] = (rastro.ms[nome] ?? 0) + (Date.now() - t0);
  }
}

/**
 * Fecha o rastro e persiste. Chamado em `finally` — é o que garante que as
 * saídas silenciosas apareçam, que são justamente as que interessam.
 *
 * ⚠️ BEST-EFFORT DE VERDADE. Telemetria não pode derrubar um turno: se a
 * escrita falhar, a família não pode perceber. Mas a falha vai para o stdout,
 * porque telemetria que some sem avisar é a doença que este arquivo trata.
 */
export async function registrarRastro(rastro: RastroRotina): Promise<void> {
  rastro.ms.total = Object.entries(rastro.ms)
    .filter(([k]) => k !== "total")
    .reduce((a, [, v]) => a + v, 0);
  try {
    await logEvent({
      kind: "rotina_turno",
      severity: rastro.saida?.startsWith("null_") ? "warn" : "info",
      family_account_id: rastro.familia,
      message: `rotina:${rastro.saida ?? "indefinido"}`,
      payload: rastro as unknown as Record<string, unknown>,
      persistir: true,
    });
  } catch (e) {
    console.error("[ayla:rotina-rastro] falha ao persistir:", e instanceof Error ? e.message : e);
  }
}
