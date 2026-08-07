/**
 * OS RECURSOS CONCRETOS QUE O PLANO JÁ USOU.
 *
 * ⚠️ POR QUE EXISTE, com número (auditoria de 07/08/2026, 48 planos reais):
 * **50% dos planos repetiam o mesmo objeto em 2+ seções práticas**. Campeões:
 * caixa (12 planos), almofada (9), tampinha (8), pote (6).
 *
 * A causa não era o modelo ser preguiçoso. Cada seção prática é uma chamada
 * INDEPENDENTE (`respondAsOutputType`), recebendo o mesmo perfil e o mesmo
 * desafio e sem ver nenhuma das outras. Duas delas chegavam sozinhas no mesmo
 * pote de tampinhas. Ninguém tinha contado a uma o que a vizinha já dissera.
 *
 * Medi primeiro por sobreposição de vocabulário (Jaccard) e NÃO achei nada:
 * todos os pares davam 11-15%, que é só o piso de falar da mesma criança. A
 * repetição que a família enxerga é de ITEM, não de palavra — e é isso que se
 * detecta aqui.
 *
 * ═══ O MESMO LÉXICO MEDE E PREVINE ═══
 *
 * A lista abaixo é a que produziu o número dos 50%. Usá-la também para
 * prevenir mantém honesta a comparação antes × depois: se a repetição cair, a
 * queda é na mesma régua que a mediu.
 */

/**
 * Recursos que a Ayla circula nos planos. Radicais, não palavras inteiras —
 * "almofad" pega almofada e almofadinha; "tampinh" pega tampinha e tampinhas.
 */
const RECURSOS: ReadonlyArray<readonly [chave: string, rotulo: string]> = [
  ["almofad", "almofada"],
  ["tampinh", "tampinhas"],
  ["caixa", "caixa"],
  ["pote", "potes"],
  ["bolinh", "bolinha"],
  ["massinh", "massinha"],
  ["elastic", "elástico"],
  ["rabisc", "rabiscar"],
  ["cronometr", "cronômetro"],
  ["timer", "timer"],
  ["ampulhet", "ampulheta"],
  ["cartao", "cartão"],
  ["cartel", "cartela"],
  ["quadro", "quadro"],
  ["lista", "lista"],
  ["desenh", "desenhar"],
  ["carrinh", "carrinho"],
  ["empurrar a parede", "empurrar a parede"],
  ["colch", "colchonete"],
  ["velcro", "velcro"],
  ["adesiv", "adesivo"],
  ["fone", "fone"],
  ["musica", "música"],
  ["papel", "papel"],
  ["fita", "fita"],
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Quais recursos concretos aparecem neste texto.
 *
 * Devolve rótulos legíveis (não radicais): é isso que vai pro prompt da
 * próxima seção, e o modelo precisa reconhecer a palavra que ele mesmo usaria.
 */
export function recursosConcretos(texto: string | null | undefined): string[] {
  const t = norm(texto ?? "");
  if (!t.trim()) return [];
  const out: string[] = [];
  for (const [chave, rotulo] of RECURSOS) {
    if (t.includes(norm(chave)) && !out.includes(rotulo)) out.push(rotulo);
  }
  return out;
}

/**
 * O bloco que entra na chamada de cada seção seguinte.
 *
 * ⚠️ NÃO É PROIBIÇÃO ABSOLUTA, e a diferença importa. Se a estratégia central é
 * "objeto na mão para sustentar atenção", a almofada PODE voltar nas
 * atividades — o que não pode é voltar como se fosse uma ideia nova. Proibir
 * de todo empurraria o modelo a inventar um recurso pior só para não repetir,
 * que é trocar repetição por má sugestão.
 *
 * Vazio quando não há nada a evitar — não pode virar peso fixo em todo plano.
 */
export function blocoAntiRepeticao(params: {
  estrategiaCentral?: string | null;
  jaUsados: readonly string[];
  /** A função DESTA seção, pra ela saber o que a diferencia das outras. */
  papel?: string;
}): string {
  const linhas: string[] = [];
  const estrategia = (params.estrategiaCentral ?? "").trim();
  if (estrategia) {
    linhas.push(
      `<estrategia_central>\n${estrategia.slice(0, 1200)}\n</estrategia_central>`,
      "Esta é a espinha do plano. O que você escrever tem que SERVIR a ela — não abrir um caminho paralelo.",
    );
  }
  if (params.jaUsados.length > 0) {
    linhas.push(
      `JÁ USADOS EM OUTRAS SEÇÕES DESTE PLANO: ${params.jaUsados.join(", ")}.`,
      "Não reapresente nenhum deles como novidade. Se um for mesmo necessário aqui, cite de passagem e siga — o resto tem que ser diferente.",
    );
  }
  if (params.papel) {
    linhas.push(`A FUNÇÃO DESTA SEÇÃO, e só ela: ${params.papel}`);
  }
  return linhas.join("\n");
}

/** O que diferencia cada seção — seção nova = função nova. */
export const PAPEL_DA_SECAO: Record<string, string> = {
  diferente: "o caminho principal: o que a família passa a fazer de outro jeito.",
  brincadeiras: "experiências LÚDICAS — brincar de verdade, sem virar tarefa nem treino.",
  atividades: "prática ESTRUTURADA da habilidade-alvo, com começo e fim claros.",
  frases: "o que DIZER, na voz da família, em frases curtas e prontas pra usar.",
  crencas: "as INTERPRETAÇÕES em jogo — da pessoa e de quem cuida — e como recolocá-las.",
  rotina: "a ORDEM das coisas no dia, quando a organização for parte da solução.",
  historia_social: "uma HISTÓRIA em primeira pessoa que antecipa a situação.",
};
