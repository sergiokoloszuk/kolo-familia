/**
 * ONDE A ROTINA ESTÁ AGORA.
 *
 * A tela já sabia marcar etapa concluída, e só isso: cartão feito esmaecia, os
 * outros ficavam todos iguais. Para a criança, "o que já passou" aparecia e as
 * outras duas perguntas não — *o que acontece agora?* e *o que ainda falta?*
 * São elas que fazem a sequência ser previsível; sem elas o quadro é um
 * checklist bonito.
 *
 * Isto vive fora do componente de propósito: é a única regra da Fatia 1 que dá
 * pra errar em silêncio, e erro aqui aponta a criança pra etapa errada.
 */

export type PassoProgresso = { id: string; concluida: boolean };

export type Progresso = {
  total: number;
  feitas: number;
  faltam: number;
  /**
   * A etapa de AGORA: a **primeira** não concluída, na ordem da rotina.
   *
   * "Primeira" e não "a seguinte à última marcada": se a mãe marcou o 3º e
   * esqueceu o 2º, o agora é o 2º. A ordem da rotina é o contrato com a
   * criança — quem manda é a sequência, não a ordem dos toques.
   *
   * `null` quando não há nenhuma pendente (acabou, ou a rotina está vazia).
   */
  agoraId: string | null;
  /** Todas concluídas E existe ao menos uma. Rotina vazia NÃO está completa. */
  completa: boolean;
};

export function progressoDaRotina(passos: readonly PassoProgresso[]): Progresso {
  const total = passos.length;
  const feitas = passos.filter((p) => p.concluida).length;
  const agora = passos.find((p) => !p.concluida);
  return {
    total,
    feitas,
    faltam: total - feitas,
    agoraId: agora?.id ?? null,
    // Vazia não é completa. Sem esta guarda, uma rotina recém-criada abriria
    // dizendo "tudo feito", que é a mentira mais fácil de escrever aqui.
    completa: total > 0 && feitas === total,
  };
}

/**
 * A frase de estado, curta, para o topo da rotina.
 *
 * Curta de propósito: ela fica acima dos cartões e compete com eles. Quem
 * ensina é a seção "Como usar"; esta linha só situa.
 */
export function resumoDoProgresso(p: Progresso, textoAgora: string | null): string {
  if (p.total === 0) return "Nenhuma etapa ainda.";
  if (p.completa) return `Tudo feito — ${p.total} de ${p.total} 🎉`;
  const base = `${p.feitas} de ${p.total}`;
  return textoAgora ? `${base} · agora: ${textoAgora}` : base;
}
