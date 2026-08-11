import { pedeUmPlano } from "@/lib/ia/pedido-plano";

/**
 * O OBJETIVO VIGENTE DA CONVERSA — o que esta família decidiu trabalhar AGORA.
 *
 * ⚠️ POR QUE ISTO EXISTE. Até 11/08/2026 o Plano da web nascia da concatenação
 * de TODAS as falas da mãe (`papel === "user"`, 1.800 caracteres, sem
 * hierarquia). Três consequências, todas medidas na auditoria de PEND-027:
 *
 *   - o REFINAMENTO se perdia. "Quero melhorar a comunicação" vira, ao longo da
 *     conversa, "ela fala bem mas trava para entrar na roda" — e essa frase é da
 *     Ayla. Descartada, o plano voltava ao tema genérico.
 *   - o ACEITE virava objetivo. "sim" e "pode ser" entravam no meio do texto
 *     com o mesmo peso de tudo.
 *   - a MUDANÇA DE DIREÇÃO não vencia. Objetivo antigo e novo competiam sem
 *     que nada dissesse qual valia.
 *
 * ⚠️ E POR QUE NÃO É "incluir também as falas da Ayla". Concatenar os dois lados
 * contamina o objetivo com hipótese não confirmada, sugestão descartada,
 * pergunta e possibilidade que a mãe não escolheu. O problema nunca foi de
 * QUANTIDADE de texto — é de HIERARQUIA. A solução é a mesma que o WhatsApp já
 * usa desde 03/08: **um objetivo em destaque, o resto explicitamente
 * subordinado a ele**.
 *
 * ⚠️ E POR QUE NÃO UMA CHAMADA DE MODELO. Seria uma segunda fonte de verdade
 * para uma pergunta que os dados já respondem, e uma chance a mais de inventar
 * objetivo. Aqui é determinístico: dá para ler o código e saber o que sai.
 */

/**
 * ACEITE CURTO NÃO É OBJETIVO.
 *
 * "sim" não carrega conteúdo: usá-lo como alvo do Plano produz um plano sobre
 * nada. Quando a última fala é uma destas, o objetivo está no turno ANTERIOR —
 * é a mesma leitura que `classificarIntencao` já faz para não recomeçar a
 * conversa a cada resposta curta.
 *
 * A lista é FECHADA de propósito, e não um teste de tamanho: "ele morde" tem
 * dez caracteres e é uma situação concreta. O erro caro seria descartar uma
 * fala curta que diz algo.
 */
const ACEITES = new Set([
  "sim", "quero", "queria", "pode", "pode ser", "podeser", "vamos", "vamo",
  "faz", "manda", "isso", "isso mesmo", "essa", "esse", "aceito", "claro",
  "ok", "okay", "blz", "beleza", "certo", "combinado", "perfeito", "top",
  "bora", "uhum", "aham", "sim por favor", "por favor", "obrigada", "obrigado",
  "valeu", "legal", "otimo", "ótimo", "boa", "gostei", "adorei", "quero sim",
  "pode sim", "vamos sim", "a primeira", "a segunda", "a terceira", "o primeiro",
  "o segundo", "1", "2", "3", "4", "5",
]);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[!.?,;:]/g, "").replace(/\s+/g, " ").trim();

/**
 * Esta fala carrega objetivo, ou é só uma confirmação?
 *
 * Também derruba o PEDIDO DE PLANO puro ("me monta um plano"): pedir o artefato
 * não diz sobre o quê ele é. Mas um pedido COM assunto ("me monta um plano pra
 * ela dormir sozinha") é substantivo — daí o teste ser sobre o que sobra depois
 * de tirar o pedido, e não sobre a presença da palavra "plano".
 */
export function ehFalaSubstantiva(texto: string | null | undefined): boolean {
  const t = norm(texto ?? "");
  if (!t) return false;
  if (ACEITES.has(t)) return false;
  // Pedido de plano sem assunto: "pode me montar um plano?" → não é objetivo.
  if (pedeUmPlano(texto ?? "")) {
    const semPedido = t
      .replace(/\b(plano|roteiro|passo a passo)\b/g, " ")
      .replace(/\b(quero|queria|preciso|gostaria|pode|poderia|consegue|tem como|me|voce|voce|faz|fazer|monta|montar|cria|criar|prepara|preparar|manda|mandar|traz|trazer|um|uma|o|a|de|pra|para|por favor)\b/g, " ")
      .replace(/\s+/g, " ").trim();
    return semPedido.length >= 12;
  }
  return t.length >= 6;
}

/**
 * A FALA DECLARA UMA DECISÃO — vontade, escolha, prioridade ou mudança?
 *
 * ⚠️ A DISTINÇÃO QUE FALTAVA, e que custou o plano da Manu (PEND-035). A mãe
 * disse, nesta ordem: "quero ler e ela não fica sentada" → "quando anda, já
 * começa correr". A regra antiga ("a última fala substantiva vence") elegeu a
 * SEGUNDA, e o plano saiu com o título "Controlar a velocidade ao andar" — sete
 * seções boas sobre a coisa errada. Julgado em bancada: **útil 1/5**.
 *
 * O erro não foi de recência nem de tamanho. Foi de TIPO:
 *
 *   OBJETIVO  = o que a família quer alcançar     → pode substituir
 *   BARREIRA  = o que dificulta chegar lá         → NUNCA substitui
 *
 * Uma mãe descreve barreiras o tempo todo — é assim que a investigação anda, e
 * cada barreira nova é mais recente que o objetivo. Com "a mais recente vence",
 * o alvo migra para o último obstáculo mencionado, sempre.
 *
 * ⚠️ ISTO NÃO É "PALAVRA-CHAVE PARA ACHAR O OBJETIVO". O teste não procura o
 * assunto — procura o ATO DE FALA. "quero ler com ela", "vamos começar pelo
 * mercado" e "o que mais me preocupa é a escola" declaram vontade, escolha e
 * prioridade; "ela não fica sentada" descreve. A lista é de marcadores de
 * decisão, não de temas, e por isso não envelhece quando o assunto muda.
 *
 * ⚠️ E POR QUE NÃO UMA CHAMADA DE MODELO — a mesma razão do resto do arquivo:
 * seria uma segunda fonte de verdade para o alvo do Plano, e uma chance a mais
 * de inventar objetivo. Aqui dá para ler o código e saber o que sai.
 */
const DECISAO =
  /\b(quero|queria|quer[ií]amos|gostaria|preciso|precisava|precisamos|meu objetivo|nosso objetivo|minha meta|to querendo|tô querendo|estou querendo|pretendo|me ajuda a|como (fa[çc]o|posso|fa[çc]er|fazer) (pra|para)|tem como (ajudar|fazer)|seria bom se|o ideal seria)\b/i;
const ESCOLHA =
  /\b(vamos (come[çc]ar|fazer|trabalhar|tentar|focar|cuidar)|bora (come[çc]ar|trabalhar)|prefiro|melhor come[çc]ar|primeiro (quero|eu quero|vamos)|deixa (a|o) .{0,30} (pra|para) depois|por enquanto (quero|vamos)|foco (agora|primeiro))\b/i;
const PRIORIDADE =
  /\b(o que mais (me )?(preocupa|incomoda|pega|atrapalha)|(o|a) (principal|maior) (problema|dificuldade|preocupa[çc][ãa]o|quest[ãa]o)|mais importante (agora|pra mim|é)|prioridade|o que mais quero|o que pega mais)\b/i;

/**
 * Esta fala pode CRIAR OU SUBSTITUIR o objetivo-raiz?
 *
 * Só se declarar decisão — e ainda tiver conteúdo. "quero sim" declara vontade
 * e é aceite: cai fora por `ehFalaSubstantiva`, que já separa confirmação de
 * conteúdo.
 */
export function declaraObjetivo(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!ehFalaSubstantiva(t)) return false;
  return DECISAO.test(t) || ESCOLHA.test(t) || PRIORIDADE.test(t);
}

/**
 * DISPENSA E NEGAÇÃO — o espelho do aceite, e igualmente vazio de objetivo.
 *
 * "Depois a gente vê isso" e "não, isso não acontece" têm conteúdo suficiente
 * para passar por `ehFalaSubstantiva` (mais de seis caracteres, fora da lista
 * de aceites) e nenhum objetivo dentro. Sem esta leitura, uma delas pode acabar
 * eleita como o alvo do Plano — e um plano nasce de uma recusa.
 *
 * ⚠️ O TESTE É SOBRE O QUE VEM DEPOIS DA NEGAÇÃO, e não sobre a negação. Duas
 * armadilhas custaram uma rodada aqui:
 *
 *   · `\b` não fecha depois de "vê" — acento não é caractere de palavra em
 *     JavaScript, então um padrão terminado em `v[êe]\b` não casa com "depois a
 *     gente vê isso";
 *   · um `^não` genérico engolia **"Não durmo desde que ele nasceu"**, que é um
 *     relato inteiro e um dos melhores objetivos que uma mãe pode escrever.
 *
 * Daí a leitura ser sobre texto NORMALIZADO e exigir o complemento: "não isso",
 * "não, isso não" é dispensa; "não durmo", "não come", "não fica sentada" é
 * relato — e relato vira barreira, não lixo.
 */
const DISPENSA = [
  /^nao,? (isso|e isso|era isso)\b/,
  /^nao,? isso nao\b/,
  /^(depois|amanha) (a gente|eu|nos) (ve|vemos|vejo|olha|olhamos)\b/,
  /^deixa (isso )?(pra|para) (depois|outro dia|amanha)\b/,
  /^(agora|hoje|por enquanto|melhor) nao\b/,
  /^(esquece|deixa pra la|deixa quieto|tanto faz)\b/,
];

export function ehDispensa(texto: string | null | undefined): boolean {
  const t = norm(texto ?? "");
  if (!t) return false;
  return DISPENSA.some((r) => r.test(t));
}

export type TurnoConversa = {
  de: "familia" | "ayla";
  texto: string;
  /** A Ayla ofereceu o Plano NESTE turno? (marcador presente) */
  ofereceuPlano?: boolean;
};

/**
 * O FOCO ATUAL — o aspecto do objetivo-raiz escolhido para trabalhar AGORA.
 *
 * ⚠️ SÓ EXISTE POR CONFIRMAÇÃO, e `null` é o estado normal. Foi a tentativa de
 * derivá-lo por recência ("a última fala descritiva é o foco") que reprovou no
 * portão de 11/08: ela é a mesma heurística temporal que produziu a PEND-035,
 * com outro nome. Uma descrição posterior pode ser refinamento OU tangente, e
 * distinguir os dois exigiria adivinhar proximidade de tema — que é exatamente
 * o classificador frágil que esta frente decidiu não construir.
 *
 * ⚠️ NÃO CONFUNDIR COM `prontidao.tema` (WhatsApp). Aquele é um recorte que o
 * MODELO escolheu, sem a família confirmar — é FOCO SUGERIDO. Só entra aqui o
 * que a família especificou ou confirmou.
 *
 * Na Fatia 1 nada preenche este campo: a Ayla ainda não propõe recorte, e
 * inventar foco para não deixar a estrutura vazia seria criar o problema que a
 * estrutura existe para impedir.
 */
export type FocoAtual = {
  texto: string;
  origem: "familia_especificou" | "ayla_propos_e_familia_confirmou";
};

export type ObjetivoDaConversa = {
  /** RAIZ — o que a família quer alcançar, nas palavras de quem o disse. */
  objetivo: string;
  /** De onde ele veio — para o log e para o teste, não para o prompt. */
  origem: "familia" | "oferta_da_ayla" | "fallback";
  /** O recorte confirmado. `null` é válido, esperado e o padrão. */
  focoAtual: FocoAtual | null;
  /**
   * O QUE A FAMÍLIA DESCREVEU — barreiras, pistas, evidências e negações.
   *
   * Elas continuavam chegando ao Plano antes desta fatia, misturadas no
   * `contexto`; o que muda é que agora chegam ROTULADAS. A diferença é de
   * governança, não de informação: sem rótulo, a barreira competia com o
   * objetivo em pé de igualdade, e uma delas vencia por ser a última.
   */
  barreiras: string[];
  /** A conversa que sobrou, já em ordem cronológica. */
  contexto: TurnoConversa[];
};

/**
 * A HIERARQUIA — **a DECISÃO mais recente vence**, e não a FALA mais recente.
 *
 * Percorrida de trás para frente, uma vez só:
 *
 * 1. **aceite curto + oferta da Ayla logo antes** → vale o que a família
 *    confirmou ao dizer "sim". É este passo que preserva o refinamento
 *    construído na conversa sem dar hipótese solta da Ayla como objetivo: só
 *    vale a oferta que a família aceitou em seguida.
 * 2. **fala que DECLARA decisão** → é ela. Aqui moram o refinamento por
 *    prioridade e a mudança de objetivo.
 * 3. **nenhuma decisão na conversa inteira** → a PRIMEIRA fala substantiva da
 *    família. Quem abre uma conversa está dizendo a que veio, mesmo sem usar
 *    "quero" — e numa conversa que só descreve, a abertura é o alvo e todo o
 *    resto é investigação dele.
 * 4. fallback → a última fala da família (melhor um objetivo fraco e rastreável
 *    do que um inventado).
 *
 * ⚠️ BARREIRA NÃO É DECISÃO. Toda descrição da família ("ela não fica sentada",
 * "quando anda começa a correr") vai para `barreiras` — continua chegando ao
 * Plano, agora explicando o objetivo em vez de substituí-lo.
 *
 * ⚠️ HIPÓTESE REJEITADA TAMBÉM NÃO É DECISÃO. "não, isso não acontece" descreve
 * e nega; pela regra antiga virava objetivo (tem mais de 6 caracteres e não
 * está na lista de aceites) e o Plano nascia de uma negação.
 *
 * ⚠️ E DISPENSA NÃO É ACEITE. "depois a gente vê isso" não confirma oferta
 * nenhuma — o passo 1 exige que a fala seja um ACEITE, e a busca para trás
 * continua até achar uma decisão de verdade.
 */
export function objetivoDaConversa(turnos: readonly TurnoConversa[]): ObjetivoDaConversa | null {
  if (turnos.length === 0) return null;

  const ultimoIdxFamilia = (() => {
    for (let i = turnos.length - 1; i >= 0; i--) if (turnos[i].de === "familia") return i;
    return -1;
  })();
  if (ultimoIdxFamilia === -1) return null;

  /** Tudo o que a família descreveu, menos a linha eleita, em ordem. */
  const barreirasExceto = (idx: number) =>
    turnos
      .filter(
        (t, j) =>
          j !== idx &&
          t.de === "familia" &&
          ehFalaSubstantiva(t.texto) &&
          !ehDispensa(t.texto),
      )
      .map((t) => t.texto.trim());

  const monta = (
    objetivo: string,
    origem: ObjetivoDaConversa["origem"],
    idx: number,
  ): ObjetivoDaConversa => ({
    objetivo: objetivo.trim(),
    origem,
    // FATIA 1: nada preenche o foco. Ver `FocoAtual` — ele nasce de
    // confirmação, e a Ayla ainda não propõe recorte.
    focoAtual: null,
    barreiras: barreirasExceto(idx),
    contexto: turnos.filter((_, j) => j !== idx),
  });

  for (let i = turnos.length - 1; i >= 0; i--) {
    const t = turnos[i];
    if (t.de !== "familia") continue;

    // 1 · aceite curto: vale a oferta que a família acabou de confirmar
    if (!ehFalaSubstantiva(t.texto)) {
      if (ACEITES.has(norm(t.texto))) {
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
          const anterior = turnos[j];
          if (anterior.de === "ayla" && anterior.ofereceuPlano) {
            return monta(anterior.texto, "oferta_da_ayla", j);
          }
          if (anterior.de === "familia" && declaraObjetivo(anterior.texto)) {
            return monta(anterior.texto, "familia", j);
          }
        }
      }
      // Não era aceite (dispensa, "não", ruído): segue procurando decisão.
      continue;
    }

    // 2 · uma decisão da família — vontade, escolha, prioridade ou mudança
    if (declaraObjetivo(t.texto)) return monta(t.texto, "familia", i);
    // Descrição: é barreira. Segue.
  }

  // 3 · ninguém decidiu nada: a abertura é o que a família veio pedir —
  //     pulando dispensa e negação, que são recusa, não pedido.
  for (let i = 0; i < turnos.length; i++) {
    const t = turnos[i];
    if (t.de !== "familia" || !ehFalaSubstantiva(t.texto)) continue;
    if (ehDispensa(t.texto)) continue;
    return monta(t.texto, "familia", i);
  }

  // 4 · fallback
  return monta(turnos[ultimoIdxFamilia].texto, "fallback", ultimoIdxFamilia);
}

/** Teto do texto que vai ao gerador. O objetivo NUNCA entra nesta conta. */
const TETO_CONTEXTO = 1800;
/**
 * Quanto do teto as barreiras podem tomar — **do mesmo teto**, e não além.
 *
 * ⚠️ Elas não são material NOVO: são a destilação das falas descritivas da
 * família, que também aparecem no contexto. Dar orçamento próprio a elas faria
 * o mesmo conteúdo ser pago duas vezes e cresceria o prompt sem informação
 * nova. Elas entram primeiro porque vêm rotuladas; o contexto fica com o resto.
 */
const TETO_BARREIRAS = 700;

/**
 * O ENQUADRAMENTO — a semântica que o WhatsApp já provou desde 03/08.
 *
 * Um objetivo em destaque e o resto explicitamente subordinado. É isto que os
 * dois canais compartilham; a SELEÇÃO das mensagens continua sendo de cada um
 * (a web tem `conversa_id`, o WhatsApp tem janela de 45 min e isolamento por
 * irmão — regras diferentes para realidades diferentes).
 *
 * ⚠️ O CORTE COMEÇA PELO CONTEXTO MAIS ANTIGO, e nunca toca o objetivo. Antes,
 * um `slice(0, 1800)` sobre o texto inteiro podia decapitar justamente a última
 * decisão da família numa conversa longa — o objetivo ficava de fora do próprio
 * plano que ele deveria dirigir.
 */
export function enquadrarObjetivo(o: ObjetivoDaConversa, nomeQuemFala = "Mãe"): string {
  // AS BARREIRAS PRIMEIRO — elas são a destilação rotulada, e o que sobrar do
  // teto fica com a transcrição da conversa.
  const barreiras: string[] = [];
  let sobraBarreiras = Math.min(TETO_BARREIRAS, TETO_CONTEXTO);
  for (let i = o.barreiras.length - 1; i >= 0; i--) {
    const b = `- ${o.barreiras[i].slice(0, 300)}`;
    if (b.length > sobraBarreiras) break;
    sobraBarreiras -= b.length;
    barreiras.unshift(b);
  }

  const linhas: string[] = [];
  let orcamento = TETO_CONTEXTO - barreiras.reduce((a, b) => a + b.length, 0);
  // De trás para frente: o contexto RECENTE é o que explica o objetivo.
  for (let i = o.contexto.length - 1; i >= 0; i--) {
    const t = o.contexto[i];
    const txt = t.texto.trim();
    if (!txt) continue;
    const linha = `${t.de === "familia" ? nomeQuemFala : "Ayla"}: ${txt.slice(0, 500)}`;
    if (linha.length > orcamento) break;
    orcamento -= linha.length;
    linhas.unshift(linha);
  }

  const partes = [`O OBJETIVO DESTE PLANO é este, e só ele:\n"${o.objetivo}"`];

  // O FOCO, quando existir — e ele só existe por confirmação da família.
  if (o.focoAtual) {
    partes.push(
      `DENTRO desse objetivo, a família escolheu começar por AQUI:\n"${o.focoAtual.texto}"\nTrabalhe este recorte primeiro. Ele não substitui o objetivo — é o primeiro avanço dentro dele.`,
    );
  }

  // AS BARREIRAS, ROTULADAS — e é o rótulo que muda o jogo.
  //
  // ⚠️ Elas já chegavam antes, dissolvidas no meio da conversa. O que faltava
  // era DIZER O QUE ELAS SÃO: sem isso, a última dificuldade relatada competia
  // com o objetivo em pé de igualdade — e ganhava, por ser a mais recente. Foi
  // assim que "quando anda, já começa a correr" virou o título de um plano
  // cujo objetivo era ler uma história (PEND-035).
  if (barreiras.length) {
    partes.push(
      `O QUE JÁ SE SABE SOBRE A DIFICULDADE — o que a família descreveu ao investigar:\n${barreiras.join("\n")}\n` +
        `Isto é MATERIAL PARA A ESTRATÉGIA, não o alvo. Uma barreira explica por que o objetivo ainda não aconteceu; ela NÃO é o objetivo, e um plano para eliminar a barreira não é um plano para alcançar o que a família quer. Se algo aqui já foi tentado e não funcionou, não proponha de novo.`,
    );
  }

  if (linhas.length === 0) return partes.join("\n\n");

  return `${partes.join("\n\n")}\n\nA conversa abaixo é CONTEXTO — serve para você entender a criança, o que já foi tentado e o que a família respondeu. Ela NÃO é o objetivo: não amplie o plano para outros temas que aparecem aqui, não retome assunto que a família deixou para trás, e não trate hipótese que ela não confirmou como se fosse fato.\n\n${linhas.join("\n")}`;
}
