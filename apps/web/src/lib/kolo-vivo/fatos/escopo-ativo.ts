import type { SupabaseClient } from "@supabase/supabase-js";
import type { Escopo } from "./tipos";

/**
 * ESCOPO ATIVO — o único lugar que decide sob qual escopo um fato nasce.
 *
 * O problema que isto resolve: a Neuro Copa. Se a família conta que a criança
 * adorou o jogo DURANTE uma campanha temática, isso não é conhecimento
 * permanente sobre ela — é uma observação presa àquele período. Sem escopo, o
 * futebol vira interesse permanente e a Ayla ainda o sugere em 2028.
 *
 * ⚠️ LIMITE HONESTO DESTA FASE. Não existe, hoje, no repositório, nenhuma
 * representação de "esta pessoa participa do programa X entre as datas A e B".
 * A tabela `campanhas` é disparo de mensagens (informacional / promocional /
 * avaliação / operacional) com destinatários — não participação em programa.
 * Usá-la como fonte de escopo marcaria fatos de uma família só porque ela
 * recebeu um comunicado, o que é pior que não ter escopo.
 *
 * Então esta função existe, é chamada por TODOS os fluxos reais, e hoje devolve
 * sempre `sempre`. O que ela entrega já agora é o CANAL: quando a Fase 8 criar
 * a fonte de participação, o escopo passa a fluir sem tocar em nenhum dos
 * quatro caminhos de escrita — só nesta função.
 *
 * O que NÃO fazer aqui, e está proibido pelo prompt mestre: inferir campanha
 * por palavras do texto. "Ele adorou o jogo" não prova participação em nada.
 */

export type ResolvedorEscopo = (
  supabase: SupabaseClient,
  familyId: string,
) => Promise<Escopo>;

/** Sem escopo: o fato vale sempre até que algo diga o contrário. */
export const ESCOPO_PADRAO: Escopo = { tipo: "sempre" };

/**
 * O resolvedor de produção.
 *
 * Devolve `sempre` enquanto não houver fonte de participação (Fase 8). Nunca
 * lança: escopo é enriquecimento, e falhar aqui não pode impedir o fato de ser
 * gravado — um fato sem escopo é recuperável; um fato perdido, não.
 */
export const resolverEscopoAtivo: ResolvedorEscopo = async (_supabase, _familyId) => {
  return ESCOPO_PADRAO;
};

/**
 * Ponto de injeção — usado pelos testes de integração para provar que o escopo
 * ATRAVESSA os fluxos reais até o fact store.
 *
 * Isso importa: a auditoria da Fase 2 mostrou que o contrato suportava escopo e
 * nenhum chamador o passava, e os testes do serviço não pegavam isso porque
 * chamavam o serviço direto. Com o resolvedor injetável, o teste exercita o
 * caminho de verdade — `aplicarPropostaNoPerfil` → adaptador → serviço.
 */
let resolvedorAtual: ResolvedorEscopo = resolverEscopoAtivo;

export function definirResolvedorEscopo(r: ResolvedorEscopo): void {
  resolvedorAtual = r;
}

export function restaurarResolvedorEscopo(): void {
  resolvedorAtual = resolverEscopoAtivo;
}

/** O que os fluxos de escrita chamam. */
export async function escopoAtivoDaFamilia(
  supabase: SupabaseClient,
  familyId: string,
): Promise<Escopo> {
  try {
    return await resolvedorAtual(supabase, familyId);
  } catch {
    return ESCOPO_PADRAO;
  }
}
