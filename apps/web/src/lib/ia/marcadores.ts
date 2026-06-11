/**
 * Marcador que a Kolo emite na última linha de uma resposta quando decide
 * oferecer o plano. É removido do texto exibido (limparRespostaKolo) e a
 * interface usa a presença dele pra mostrar o botão "Montar plano" só nesse
 * momento. Módulo neutro (sem deps de servidor) pra ser usado também no
 * cliente.
 */
export const MARCADOR_PLANO = "[[PRONTO_PLANO]]";

/** A Kolo ofereceu o plano nesta resposta? (marcador presente) */
export function ofereceuPlano(texto: string | null | undefined): boolean {
  return Boolean(texto && texto.includes(MARCADOR_PLANO));
}
