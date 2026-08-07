/**
 * O QUE A FAMÍLIA CONTA DEPOIS — e o que fazer com isso.
 *
 * A rotina virava artefato e acabava ali. A mãe dizia "guardar o controle ele
 * já faz sozinho" e a Ayla respondia bonito, sem mexer no quadro: a criança
 * seguia com um cartão de uma etapa que já dominou, que é exatamente o oposto
 * do objetivo (autonomia, não eternizar o recurso).
 *
 * ═══ POR QUE ISTO É PEQUENO ═══
 *
 * Nada aqui gera rotina. A máquina de editar já existe (`editarRotina`), e ela
 * já faz a parte difícil: casa as tarefas novas com as atuais e PRESERVA a arte
 * dos cartões já gerados. Este módulo só lê o que a família disse e escolhe a
 * instrução certa pra aquela edição. Sem tabela nova, sem motor novo.
 *
 * ═══ A REGRA QUE EVITA O ESTRAGO ═══
 *
 * "Não funcionou" é uma das frases mais ambíguas do produto: pode ser sobre a
 * rotina, sobre um plano, sobre um remédio, sobre a escola. Tirar cartão por
 * palavra-chave solta é pior que não tirar — a família perde o quadro que
 * montou.
 *
 * Então nada aqui dispara sozinho. `classificarFeedbackRotina` devolve o que
 * leu; quem chama só age quando existe uma rotina DAQUELE membro pra amarrar o
 * feedback. Sem âncora, o texto vira conversa normal.
 */

/** O que a família reportou. Mesmo vocabulário de `planos` (0037/0075). */
export type ResultadoRotina = "funcionou" | "parcial" | "nao_funcionou" | "nao_testou";

export type FeedbackRotina = {
  resultado: ResultadoRotina;
  /**
   * O que fazer com o quadro:
   * - `simplificar`: ela já faz etapas sozinha → menos cartões.
   * - `aposentar`: não precisa mais do recurso → reduzir ao mínimo ou encerrar.
   * - `ajustar_trecho`: falhou num ponto → mexer SÓ nele.
   * - `investigar`: falhou e não dá pra saber onde → UMA pergunta.
   * - `nenhum`: funcionou inteiro; só registra e comemora.
   */
  acao: "simplificar" | "aposentar" | "ajustar_trecho" | "investigar" | "nenhum";
};

/** `\p{Diacritic}` e não um range de marcas combinantes: o range se escreve com
 *  caracteres invisíveis, que somem numa conversão de encoding e ninguém vê. */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** "já faz sozinho", "essas duas ele já consegue", "ficou fácil". */
const JA_CONSEGUE =
  /\bja (consegue|faz|sabe|vai)\b|\bsozinh[oa]\b|\bficou facil\b|\bficou tranquilo\b|\bnao precisa mais\b|\bdomina\b/;
/** "não precisa mais do quadro" — aposentar o recurso inteiro. */
const APOSENTAR =
  /\bnao precisa mais (d[oa]s?|de)? ?(car[dt]|quadro|rotina|sequenc|painel)|\btirar? (o )?(quadro|car[dt]|painel)|\bnao usamos mais\b/;
const NAO_FUNCIONOU =
  /\bnao (funcionou|adiantou|ajudou|deu certo|rolou|serviu)\b|\bignorou\b|\bcontinuou (brigando|a mesma coisa)\b|\bnao mudou nada\b|\bpiorou\b/;
const FUNCIONOU =
  /\b(funcionou|ajudou|deu certo|foi melhor|melhorou|deu super certo|foi otimo)\b/;
/** "funcionou até o banho, mas depois…" — o parcial tem uma dobradiça. */
const PARCIAL = /\bate\b|\bmas (depois|na hora|quando)\b|\bem parte\b|\bmais ou menos\b|\bum pouco\b/;

/**
 * O texto fala do quadro que já existe? Só isso autoriza mexer nele.
 *
 * Deliberadamente estreito: exige a coisa nomeada (rotina, cartões, sequência,
 * quadro, combinado) OU uma etapa reconhecível — quem chama passa as etapas da
 * rotina daquele membro. "Não funcionou" sozinho não basta, e não deve bastar.
 */
export function falaDoQuadro(texto: string, etapas: readonly string[] = []): boolean {
  const t = norm(texto);
  if (/\b(rotina|cart[oõ]es|cartao|quadro|sequencia|painel|combinado|varal)\b/.test(norm(texto)))
    return true;
  return etapas.some((e) => {
    const n = norm(e).trim();
    return n.length >= 4 && t.includes(n);
  });
}

/**
 * Lê o que a família contou. Devolve `null` quando não há leitura confiável —
 * na dúvida, não mexer no quadro é sempre a opção mais barata.
 */
export function classificarFeedbackRotina(texto: string): FeedbackRotina | null {
  const t = norm(texto ?? "");
  if (!t.trim()) return null;

  // A ordem importa. "Não precisa mais do quadro" também casa com JA_CONSEGUE,
  // e a leitura certa é a mais específica: aposentar o recurso.
  if (APOSENTAR.test(t)) return { resultado: "funcionou", acao: "aposentar" };

  // Negativa antes da positiva: "não funcionou" contém "funcionou".
  if (NAO_FUNCIONOU.test(t)) {
    // "não funcionou na hora de jantar" já diz onde; "não funcionou" não diz
    // nada, e aí a única saída honesta é perguntar.
    const temOnde = PARCIAL.test(t) || /\b(na|no|quando|hora d[eoa])\b/.test(t);
    return { resultado: "nao_funcionou", acao: temOnde ? "ajustar_trecho" : "investigar" };
  }

  if (JA_CONSEGUE.test(t)) return { resultado: "funcionou", acao: "simplificar" };

  if (FUNCIONOU.test(t)) {
    // "funcionou ATÉ o banho, mas depois não quis jantar" — preservar o que
    // deu certo e mexer só no que veio depois.
    return PARCIAL.test(t)
      ? { resultado: "parcial", acao: "ajustar_trecho" }
      : { resultado: "funcionou", acao: "nenhum" };
  }
  return null;
}

/**
 * A instrução que acompanha a edição. Uma por ação, e cada uma diz o que NÃO
 * fazer — porque os erros aqui são de excesso: refazer o quadro inteiro,
 * acrescentar cartão pra "compensar", apagar o que estava funcionando.
 */
export function instrucaoDeAjuste(f: FeedbackRotina): string {
  switch (f.acao) {
    case "simplificar":
      return `ELA CONTOU QUE JÁ CONSEGUE PARTE DA SEQUÊNCIA. Isso é avanço — reconheça em uma linha, sem discurso. Depois TIRE do quadro as etapas que ela nomeou como dominadas, ou junte duas numa só quando fizer sentido ("camiseta, calça, meia" vira "vestir-se"). MANTENHA tudo o que ela não citou, na mesma ordem. NÃO acrescente etapa nova, NÃO refaça o quadro, NÃO troque as palavras das que ficam. Menos cartão aqui é o objetivo do recurso, não perda.`;
    case "aposentar":
      return `ELA DISSE QUE NÃO PRECISA MAIS DO RECURSO. Não insista nem tente salvar o quadro. Reduza ao mínimo que ainda ajuda — muitas vezes uma ou duas etapas — ou diga com naturalidade que dá pra deixar de lado e retomar se um dia embolar. O recurso existe pra chegar aqui.`;
    case "ajustar_trecho":
      return `PARTE FUNCIONOU. NÃO DESTRUA O QUE DEU CERTO PRA CONSERTAR O QUE FALHOU: as etapas que ela disse que funcionaram ficam EXATAMENTE como estão — mesmo texto, mesma ordem. Mexa só no trecho que ela apontou, e mexa pouco: quebrar aquela etapa em duas, mudar o que vem logo depois, ou tornar mais concreto o que estava vago. NÃO acrescente cartão em outro lugar do quadro pra "reforçar".`;
    case "investigar":
      return `ELA DISSE QUE NÃO FUNCIONOU, MAS NÃO ONDE. Não mexa no quadro neste turno e não repita a mesma orientação com outras palavras. Faça UMA pergunta discriminativa, com as opções vindas das etapas que existem — ela responde com um número. Exemplo do formato: "A dificuldade ficou mais: 1. em parar o que estava fazendo; 2. em seguir daí pro banho; 3. ou ele acompanhou a sequência e mesmo assim recusou?". acao="perguntar".`;
    case "nenhum":
      return `FUNCIONOU. Comemore curto e NÃO mexa no quadro — não é hora de acrescentar etapa nem de propor a próxima coisa. Se couber, uma frase sobre o que fez diferença, pra ela repetir de propósito.`;
  }
}
