import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O DONO ÚNICO DA PERGUNTA "HÁ ROTINA PENDENTE?" — 08/09/2026, Gate A.
 *
 * ⚠️ O QUE ESTE ARQUIVO DESFAZ. A mesma pergunta tinha CINCO donos, com QUATRO
 * janelas e DOIS escopos, e nenhum sabia dos outros:
 *
 *   D1 `propostaPendente`      rotina-guiada    48 h    família
 *   D2 `rotinaConversaPendente` rotina-guiada   48 h    família
 *   D3 `rotinaAguardandoTema`  rotina-guiada     6 h    família + membro
 *   D4 `lerArtefatoPendente`   estado-do-turno   —      família (SEM membro)
 *   D6 reconciliador           rotina-reconcil.  7 d    rotina
 *
 * Uma rotina de dez horas atrás era pendente para três deles e não existia para
 * o quarto. E D4, que alimenta o cérebro conversacional, não filtrava por
 * criança nem por tempo: MEDI uma rotina presa em `aguardando` há 18 dias sendo
 * apresentada como pendência de agora, em toda conversa daquela família, sobre
 * qualquer filho.
 *
 * ⚠️ E POR QUE NÃO UMA JANELA SÓ. Fui olhar por que cada número nasceu, e a
 * arqueologia desautoriza unificar:
 *
 *   · **48 h não é semântica, é limite de consulta.** O comentário de D1 é
 *     explícito: "pendente = a ÚLTIMA mensagem de rotina desta família é uma
 *     proposta… assim que qualquer outra sai, a proposta deixa de ser a última
 *     e para de valer sozinha". A regra é ORDEM, não tempo.
 *   · **6 h é decisão de produto medida.** Nasceu do caso "Carrinho" (08/08):
 *     uma rotina esquecida em `aguardando` capturou uma palavra solta de outra
 *     conversa. É o tempo em que uma palavra ainda pode ser resposta de tema.
 *   · **7 dias é a duração do Trial.** "Uma rotina pedida no começo e resgatada
 *     no fim ainda pertence à mesma experiência." É até onde vale resgatar.
 *   · **Nenhuma janela em D4 não foi decisão** — foi omissão. O autor documentou
 *     que a função "só lê"; ninguém perguntou por quanto tempo aquilo continua
 *     verdadeiro.
 *
 * Então o que se unifica não é o número: é o **dono da política**. Cada
 * finalidade tem a validade que a evidência justifica, e existe um lugar só
 * onde isso está escrito.
 *
 * ⚠️ NÃO É UM SEXTO DONO. Os consumidores passam a chamar daqui; nada aqui
 * duplica o que eles já sabem fazer.
 */

/** Para que se está perguntando — é a finalidade que decide a validade. */
export type FinalidadeDaPendencia =
  /** A próxima palavra da mãe pode ser a resposta do tema? (D3) */
  | "capturar_tema"
  /** O modelo deve saber que isto está em aberto? (D4) */
  | "mostrar_ao_modelo"
  /** Ainda vale resgatar automaticamente? (D5/D6) */
  | "reconciliar";

/**
 * A POLÍTICA, NUM LUGAR SÓ. Cada valor carrega a evidência que o justifica —
 * mudar um destes números é mudar uma decisão de produto, não um ajuste.
 */
export const VALIDADE_MS: Record<FinalidadeDaPendencia, number> = {
  /**
   * 6 h — medido no caso "Carrinho" (08/08/2026): passado esse tempo, uma
   * palavra solta da mãe quase nunca é resposta de tema, e capturá-la escreve
   * no artefato errado. É a janela mais curta porque é a única que ESCREVE.
   */
  capturar_tema: 6 * 60 * 60 * 1000,
  /**
   * 7 dias — o mesmo teto do reconciliador, e a escolha é principiada: passado
   * esse ponto o SISTEMA já desistiu de resolver a pendência sozinho.
   * Continuar apresentando ao modelo algo que ninguém vai resolver é apresentar
   * uma mentira — foi o caso da rotina de 18 dias.
   */
  mostrar_ao_modelo: 7 * 24 * 60 * 60 * 1000,
  /** 7 dias — a duração do Trial; ver `TETO_RECONCILIACAO_MS`. */
  reconciliar: 7 * 24 * 60 * 60 * 1000,
};

/** O que falta para a rotina sair do limbo. As duas espécies de órfã. */
export type FaltaNaPendencia = "tema" | "geracao";

/**
 * ⚠️ TRÊS ESTADOS, NÃO DOIS — e a diferença custou um teste que estava certo.
 *
 * "não há pendência" e "não consegui saber" são coisas diferentes, e o bloco de
 * estado do turno já as distinguia (`nenhum` × `nao_rastreado`). Ao unificar os
 * cinco donos eu colapsei as duas em `null` — e isso faria a Ayla afirmar que
 * nada está pendente quando na verdade a consulta caiu. Afirmar o que não se
 * sabe é exatamente o que o Prompt Mestre §19 proíbe.
 *
 * O caminho que ESCREVE (`capturar_tema`) trata os dois como "não capture",
 * porque ali o conservador é não agir. O caminho que MOSTRA precisa saber a
 * diferença, para dizer ao modelo que não sabe.
 */
export type ResultadoPendencia =
  | { estado: "sim"; valor: PendenciaDeRotina }
  | { estado: "nenhum" }
  | { estado: "nao_rastreado" };

export type PendenciaDeRotina = {
  id: string;
  nome: string;
  membroId: string | null;
  falta: FaltaNaPendencia;
  atualizadaEm: string | null;
  idadeHoras: number;
};

type LinhaRotina = {
  id: string;
  nome: string | null;
  tema: string | null;
  membro_atipico_id: string | null;
  updated_at: string | null;
  created_at: string | null;
};

/** Idade em horas a partir de `updated_at`, caindo para `created_at`. */
function idadeEmHoras(r: LinhaRotina, agora: Date): number {
  const t = Date.parse(r.updated_at ?? r.created_at ?? "");
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (agora.getTime() - t) / 3_600_000;
}

/**
 * A ROTINA PENDENTE QUE VALE PARA ESTA FINALIDADE — ou `null`.
 *
 * ⚠️ `membroId` É OBRIGATÓRIO nas finalidades conversacionais, e essa
 * obrigatoriedade é a invariante: **uma pendência da Manu jamais governa uma
 * conversa sobre o Mario.** Só `reconciliar` varre sem membro, porque ali o
 * dono é o artefato, não a conversa.
 *
 * ⚠️ SÓ `aguardando`. `gerando` não é pendência conversacional — é trabalho em
 * curso, e perguntar tema de novo em cima dele produziria segunda geração.
 * `pronto` não é pendência nenhuma. `erro` tem tratamento próprio, e
 * deliberadamente não entra aqui: transformar falha em "pendência" faria a Ayla
 * pedir tema para uma rotina que quebrou.
 */
export async function pendenciaDeRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId?: string | null;
    finalidade: FinalidadeDaPendencia;
    agora?: Date;
  },
): Promise<ResultadoPendencia> {
  const agora = params.agora ?? new Date();
  try {
    let q = supabase
      .from("rotinas")
      .select("id, nome, tema, membro_atipico_id, updated_at, created_at")
      .eq("family_account_id", params.familyId)
      .eq("cards_status", "aguardando");

    // A invariante, aplicada na consulta e não na leitura: o que não é da
    // criança em foco nem chega a ser considerado.
    if (params.finalidade !== "reconciliar") {
      // Sem criança em foco não há como respeitar o isolamento — e não saber de
      // quem é a pendência não é o mesmo que não haver pendência.
      if (!params.membroId) return { estado: "nao_rastreado" };
      q = q.eq("membro_atipico_id", params.membroId);
    }

    const { data, error } = await q.order("updated_at", { ascending: false }).limit(1);
    if (error) return { estado: "nao_rastreado" };
    const r = (data ?? [])[0] as LinhaRotina | undefined;
    if (!r) return { estado: "nenhum" };

    const idadeHoras = idadeEmHoras(r, agora);
    const limiteHoras = VALIDADE_MS[params.finalidade] / 3_600_000;
    // ⚠️ VENCIDA NÃO É APAGADA — só deixa de governar. O artefato continua no
    // banco, visível na web, recuperável. Expirar é sobre AUTORIDADE sobre a
    // conversa, nunca sobre existência do dado.
    if (idadeHoras > limiteHoras) return { estado: "nenhum" };

    return {
      estado: "sim",
      valor: {
        id: r.id,
        nome: (r.nome ?? "").trim() || "a rotina",
        membroId: r.membro_atipico_id,
        falta: (r.tema ?? "").trim() ? "geracao" : "tema",
        atualizadaEm: r.updated_at ?? r.created_at,
        idadeHoras,
      },
    };
  } catch {
    return { estado: "nao_rastreado" };
  }
}
