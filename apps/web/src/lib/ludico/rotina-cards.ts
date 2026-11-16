import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarRoteiroRotina, ilustrarCards } from "@/lib/ludico/gerar";

type RuntimeCards = {
  gerarRoteiro: typeof gerarRoteiroRotina;
  ilustrar: typeof ilustrarCards;
};

const runtimePadrao: RuntimeCards = {
  gerarRoteiro: gerarRoteiroRotina,
  ilustrar: ilustrarCards,
};

export const TIMEOUT_GERACAO_CARDS_MS = 6 * 60 * 1000;

/**
 * Rede de segurança da leitura. Evita polling infinito quando `after()` é
 * interrompido e transforma falso `pronto` histórico em erro recuperável.
 */
export function statusSeguroDosCards(params: {
  status: string;
  updatedAt: string;
  imagens: Array<string | null>;
  agoraMs?: number;
}): string {
  if (params.status === "gerando") {
    const atualizadoEm = new Date(params.updatedAt).getTime();
    const idadeMs = (params.agoraMs ?? Date.now()) - atualizadoEm;
    if (Number.isFinite(idadeMs) && idadeMs > TIMEOUT_GERACAO_CARDS_MS) return "erro";
  }
  if (
    params.status === "pronto" &&
    (!params.imagens.length || params.imagens.some((imagem) => !imagem))
  ) {
    return "erro";
  }
  return params.status;
}

export type GerarCardsRotinaParams = {
  rotinaId: string;
  familyAccountId: string;
  tema: string;
  atividades: string[];
  idade: number | null;
  nomeRotina: string;
  usarAvatar: boolean;
  tarefaIds: string[];
  referenciaUrl?: string;
  arteExistente?: Array<string | null>;
  preservarArte?: boolean;
};

/**
 * Único portão que pode transformar uma geração de cartões em `pronto`.
 *
 * O ilustrador devolve `null` quando esgota os retries. Por isso, sucesso da
 * chamada não é sucesso da rotina: todos os cartões precisam existir, todas as
 * escritas precisam ser aceitas e uma releitura precisa comprovar o resultado.
 */
export async function gerarEConfirmarCardsRotina(
  supabase: SupabaseClient,
  params: GerarCardsRotinaParams,
  runtime: RuntimeCards = runtimePadrao,
): Promise<void> {
  if (!params.tarefaIds.length || params.tarefaIds.length !== params.atividades.length) {
    throw new Error("tarefas da rotina inconsistentes");
  }

  const roteiro = await runtime.gerarRoteiro(
    {
      tema: params.tema,
      atividades: params.atividades,
      idade: params.idade,
      nomeRotina: params.nomeRotina,
      usarAvatar: params.usarAvatar,
    },
    { supabase, family_account_id: params.familyAccountId },
  );
  const { mascoteUrl, imagens } = await runtime.ilustrar(supabase, {
    familyAccountId: params.familyAccountId,
    tema: params.tema,
    mascoteDescricao: roteiro.mascote,
    cards: roteiro.cards,
    referenciaUrl: params.referenciaUrl,
    arteExistente: params.arteExistente,
  });

  if (
    roteiro.cards.length !== params.tarefaIds.length ||
    imagens.length !== params.tarefaIds.length ||
    imagens.some((url) => !url)
  ) {
    throw new Error(
      `cartões incompletos: ${imagens.filter(Boolean).length}/${params.tarefaIds.length}`,
    );
  }

  const escritas = await Promise.all(
    params.tarefaIds.map(async (id, i) => {
      if (params.preservarArte && params.arteExistente?.[i]) return { error: null };
      const card = roteiro.cards[i];
      if (!card) return { error: new Error("roteiro sem cartão correspondente") };
      return supabase
        .from("rotina_tarefas")
        .update({
          nome_tematico: card.nome_tematico,
          cena: card.cena,
          imagem_url: imagens[i],
        })
        .eq("id", id)
        .eq("rotina_id", params.rotinaId);
    }),
  );
  if (escritas.some((resultado) => resultado.error)) {
    throw new Error("falha ao salvar imagem de cartão");
  }

  const { data: gravadas, error: leituraErro } = await supabase
    .from("rotina_tarefas")
    .select("id, imagem_url")
    .eq("rotina_id", params.rotinaId);
  const idsEsperados = new Set(params.tarefaIds);
  if (
    leituraErro ||
    gravadas?.length !== params.tarefaIds.length ||
    gravadas.some(
      (tarefa) => !idsEsperados.has(tarefa.id as string) || !tarefa.imagem_url,
    )
  ) {
    throw new Error("cartões salvos incompletos");
  }

  const { data: concluida, error: conclusaoErro } = await supabase
    .from("rotinas")
    .update({
      historia: roteiro.historia,
      mascote_url: mascoteUrl,
      cards_status: "pronto",
    })
    .eq("id", params.rotinaId)
    .eq("family_account_id", params.familyAccountId)
    .eq("cards_status", "gerando")
    .select("id")
    .maybeSingle();
  if (conclusaoErro || !concluida) {
    throw new Error("falha ao confirmar cartões da rotina");
  }
}

export async function marcarGeracaoCardsComoErro(
  supabase: SupabaseClient,
  params: {
    rotinaId: string;
    familyAccountId: string;
    origem: string;
    erro: unknown;
  },
): Promise<void> {
  console.error(
    `[${params.origem}] geração de cartões falhou:`,
    params.erro instanceof Error ? params.erro.message : params.erro,
  );
  const { data, error } = await supabase
    .from("rotinas")
    .update({ cards_status: "erro" })
    .eq("id", params.rotinaId)
    .eq("family_account_id", params.familyAccountId)
    .eq("cards_status", "gerando")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(
      `[${params.origem}] não conseguiu registrar erro da geração:`,
      error.message,
    );
  } else if (!data) {
    console.info(`[${params.origem}] estado mudou antes do registro de erro`);
  }
}
