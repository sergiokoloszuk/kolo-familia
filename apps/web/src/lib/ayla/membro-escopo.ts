/**
 * ISOLAMENTO ENTRE IRMÃOS — a regra, num lugar só.
 *
 * ⚠️ POR QUE EXISTE (07/08/2026, conversa real): a mãe contou que o MARIO presta
 * mais atenção com algo nas mãos; depois escreveu "A Manu começa a lição mas 5
 * min depois já quer fazer outra coisa"; e a Ayla respondeu sobre a Manu dizendo
 * "como ela já mostrou que se concentra melhor quando as mãos estão ocupadas".
 *
 * A causa não era o modelo. Era uma consulta por `family_account_id` onde o dado
 * pertence a UMA criança — e o mesmo padrão aparecia em quatro lugares:
 * conversa recente, desafio que monta o Plano, histórico do parser e títulos das
 * Estratégias. Os dois do meio são os graves: produzem ARTEFATO e PERFIL, que
 * ficam.
 *
 * ═══ A REGRA, e por que ela não é "filtre por membro" ═══
 *
 * Filtrar por igualdade descartaria todo o acervo anterior a esta correção — o
 * inbound nunca gravou `membro_atipico_id`, então TODA mensagem antiga da mãe
 * tem `null`. Uma família perderia a própria conversa da última hora.
 *
 * Então a regra é pela NEGATIVA: descarta-se o que se SABE ser de outra criança.
 *
 *   membro === foco   → é dele. Entra.
 *   membro === null   → não dá pra saber. Entra, mas NUNCA como fato do foco.
 *   membro === outro  → é do irmão. NÃO ENTRA onde vira fato ou artefato.
 *
 * Isso é conservador no sentido certo: o pior caso é uma frase sem dono junto
 * da conversa (que já era o comportamento de sempre), e nunca a característica
 * de um filho virando fato sobre o outro.
 *
 * ═══ QUANDO A REGRA NEM PRECISA RODAR ═══
 *
 * Família com UM membro só não tem irmão pra confundir. `ehDeOutroMembro`
 * devolve false quando não há foco, e o chamador pode pular a filtragem — sem
 * risco de regressão para a maioria das famílias.
 */

export type ComMembro = { membro_atipico_id?: string | null };

/**
 * A linha é comprovadamente de OUTRA criança?
 *
 * `false` quando não há foco definido ou quando a linha não tem dono: nesses
 * casos não se SABE que é de outro, e a regra só descarta o que se sabe.
 */
export function ehDeOutroMembro(linha: ComMembro, focoId: string | null | undefined): boolean {
  const id = linha.membro_atipico_id ?? null;
  if (!focoId || !id) return false;
  return id !== focoId;
}

/**
 * Tira da lista o que é comprovadamente de outro irmão.
 *
 * Use onde o conteúdo vira FATO ou ARTEFATO — o desafio que monta o Plano, o
 * texto que o parser transforma em evento do Kolo Vivo. Em conversa exibida ao
 * modelo, prefira `ehDeOutroMembro` para ETIQUETAR em vez de sumir: a mãe falou
 * daquilo, e esconder a fala dela confunde mais do que marcar de quem era.
 */
export function semOutrosMembros<T extends ComMembro>(
  linhas: readonly T[],
  focoId: string | null | undefined,
): T[] {
  if (!focoId) return [...linhas];
  return linhas.filter((l) => !ehDeOutroMembro(l, focoId));
}
