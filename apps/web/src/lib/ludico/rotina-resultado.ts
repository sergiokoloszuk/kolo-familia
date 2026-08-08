/**
 * "ESSA ROTINA AJUDOU?" — a resposta da família, na própria página.
 *
 * NÃO cria vocabulário novo. A migração 0075 já deu à rotina as mesmas quatro
 * colunas de resultado que o plano tem desde a 0037, e o argumento escrito lá
 * vale igual aqui: um segundo vocabulário para a mesma pergunta é a forma mais
 * cara de descobrir depois que os dois discordam.
 *
 * Por isso esta camada é só TRADUÇÃO: os quatro botões da tela viram os quatro
 * valores que o banco já aceita. Nenhuma coluna nova, nenhuma migração.
 *
 * Efeito colateral bem-vindo: o follow-up da Ayla procura rotina com
 * `resultado is null and seguimento_enviado_em is null`. Quem responde no app
 * sai dessa fila sozinho — a mãe não recebe a mesma pergunta pelo WhatsApp
 * depois de já ter respondido na tela. Não foi preciso escrever nada para isso.
 */

/** O que o banco aceita (check da 0075). Não inventar valor fora disto. */
export type ResultadoRotina = "funcionou" | "parcial" | "nao_testou" | "nao_funcionou";

export type RespostaFeedback = "ajudou" | "ajudou_em_parte" | "nao_usamos" | "quero_ajustar";

export const RESPOSTAS_FEEDBACK: ReadonlyArray<{
  chave: RespostaFeedback;
  rotulo: string;
  resultado: ResultadoRotina;
}> = [
  { chave: "ajudou", rotulo: "Ajudou", resultado: "funcionou" },
  { chave: "ajudou_em_parte", rotulo: "Ajudou em parte", resultado: "parcial" },
  { chave: "nao_usamos", rotulo: "Ainda não usamos", resultado: "nao_testou" },
  // "Quero ajustar" é a forma acionável de "não funcionou pra gente": quem quer
  // mudar a sequência está dizendo que ela, como está, não serviu. A tela leva
  // essa resposta direto para a edição — é o que a mãe pediu ao clicar.
  { chave: "quero_ajustar", rotulo: "Quero ajustar", resultado: "nao_funcionou" },
];

export function resultadoDe(r: RespostaFeedback): ResultadoRotina {
  const achado = RESPOSTAS_FEEDBACK.find((x) => x.chave === r);
  if (!achado) throw new Error(`resposta de feedback desconhecida: ${r}`);
  return achado.resultado;
}

export function ehRespostaFeedback(v: unknown): v is RespostaFeedback {
  return RESPOSTAS_FEEDBACK.some((x) => x.chave === v);
}

type ClienteMinimo = {
  from: (t: string) => {
    update: (v: Record<string, unknown>) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => {
          select: (cols: string) => PromiseLike<{
            data: Array<{ id: string }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

export type GravacaoResultado = { ok: true } | { ok: false; error: string };

/**
 * GRAVA E CONFERE. Escrita crítica confere o próprio resultado (§7).
 *
 * O `.eq("family_account_id")` isola as famílias, mas sozinho ele produz o
 * modo de falha proibido: rotina de outra família simplesmente casa com ZERO
 * linhas, o `error` vem nulo, e o fluxo devolveria sucesso por uma escrita que
 * não aconteceu. É o padrão que já custou caro neste repositório.
 *
 * Então o `.select()` é obrigatório aqui, e zero linha é ERRO — não sucesso
 * silencioso, e não exceção: a tela precisa poder dizer à mãe que não gravou.
 */
export async function gravarResultadoDaRotina(
  supabase: ClienteMinimo,
  p: { rotinaId: string; familyId: string; resposta: RespostaFeedback; agora?: Date },
): Promise<GravacaoResultado> {
  const quando = (p.agora ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from("rotinas")
    .update({
      resultado: resultadoDe(p.resposta),
      resultado_em: quando,
      // `resultado_nota` fica INTOCADA de propósito: ela guarda as palavras da
      // família pelo WhatsApp, e a tela não tem texto livre. Apagar seria
      // destruir o que ela escreveu para gravar um clique.
    })
    .eq("id", p.rotinaId)
    .eq("family_account_id", p.familyId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Rotina não encontrada." };
  }
  return { ok: true };
}
