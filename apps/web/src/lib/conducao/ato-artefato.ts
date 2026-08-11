/**
 * O QUE A FAMÍLIA QUER COM O ARTEFATO — criar, editar, receber de volta,
 * conversar sobre, recusar, ou nada disso com clareza.
 *
 * ⚠️ POR QUE ISTO EXISTE (11/08/2026). O produto tinha um `boolean` onde
 * precisava de seis atos. `pedeRotina` e `pedeUmPlano` perguntam "a palavra do
 * artefato aparece E existe um verbo por perto?" — e um verbo não separa PEDIR
 * de FALAR SOBRE. Dois casos reais de produção, medidos:
 *
 *   · "Você já tinha informação suficiente para montar um plano? Dentro de
 *     perfil, você salvou o que sobre ele?" → o sistema entendeu PEDIDO e abriu
 *     o fluxo do artefato. A mãe estava AUDITANDO o plano que acabara de
 *     receber. O turno terminou com a Ayla perguntando de qual filho ela
 *     falava, 41 segundos depois de gerar um plano para ele.
 *   · "Quando é preciso mudar a rotina de repente ela sente" → `precis` casou,
 *     e uma descrição do que acontece com a criança virou pedido de artefato.
 *
 * Medido no corpus de 15 frases: **5 erros**, todos na mesma direção — o
 * sistema criando quando a família não pediu. Dois deles são RECUSA explícita
 * ("não quero plano agora"), onde ele entendeu o oposto do que foi dito.
 *
 * ⚠️ NÃO É UMA LISTA MAIOR DE VERBOS. Alargar a lista foi o que produziu o
 * defeito: cada verbo novo aumenta a chance de casar com uma frase que só
 * MENCIONA o artefato. O que separa os atos não é qual palavra aparece — é
 * sobre O QUÊ e em QUE TEMPO a frase fala:
 *
 *   negou a intenção          → recusar          (e nada mais importa)
 *   fala de um que JÁ EXISTE  → conversar_sobre / editar / reenviar
 *   pergunta sobre o passado  → conversar_sobre
 *   verbo de criar, sem nada  → criar
 *   nada disso                → ambiguo
 *
 * Estes sinais valem para QUALQUER artefato — por isso o módulo é da condução,
 * e não da Rotina nem do Plano. Quem chama diz qual artefato é; a leitura do
 * ato é a mesma.
 */

/** Só `criar` e `editar` podem abrir fluxo de geração/alteração. */
export type AtoSobreArtefato =
  | "criar"
  | "editar"
  | "reenviar"
  | "conversar_sobre"
  | "recusar"
  | "ambiguo";

/** Acentos fora, pontuação fora — a família escreve "n quero" e "pq vc". */
const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * NEGOU A INTENÇÃO — e isto vem primeiro, antes de qualquer outra leitura.
 *
 * "não quero plano agora, só quero entender por que isso acontece" tem a
 * palavra, tem "quero", e é o oposto de um pedido. Medido: o classificador
 * antigo devolvia `true` para esta frase e para "n quero outro plano".
 *
 * Exige a negação COLADA na intenção — "não quero", "nao vou querer" — para
 * não capturar "não sei se um plano ajudaria", que é dúvida, não recusa.
 */
const RECUSA =
  /\b(nao|n) (quero|queria|precisa|preciso|vou querer|to querendo|e|eh)\b|\b(agora|hoje|por enquanto) nao\b|\bsem (plano|rotina|cartoes|cartao)\b|\bdeixa (pra depois|pra la|quieto)\b/;

/**
 * A FRASE PRESSUPÕE UM ARTEFATO QUE JÁ EXISTE.
 *
 * "esse plano", "a rotina que você fez", "quando fez", "aquele" — quem fala
 * assim não está pedindo um novo. É o sinal que separa "faz um plano" de "por
 * que você colocou isso no plano?", sem depender de qual verbo apareceu.
 */
const JA_EXISTE =
  /\b(esse|essa|este|esta|aquele|aquela) (plano|rotina|quadro|cartoes|pdf)\b|\b(plano|rotina|quadro) (que|q) (voce|vc|tu) (fez|montou|criou|mandou|enviou)\b|\b(quando|depois que) (voce|vc) (fez|montou|criou)\b|\bde novo\b|\bnovamente\b/;

/**
 * O PEDIDO É DIRIGIDO À KOLO?
 *
 * ⚠️ ESTE É O SINAL QUE FALTAVA, e a primeira versão deste arquivo errou sem
 * ele: "quando muda a rotina ela fica mal" tem o verbo `muda` e virava EDITAR.
 * O verbo estava lá; o pedido não. A frase narra o que acontece com a criança.
 *
 * Um mesmo verbo muda de natureza conforme QUEM AGE:
 *
 *   "quero mudar a rotina de terça"      → a mãe pede, a Kolo faz    → editar
 *   "a professora mudou a rotina da sala" → alguém fez, é notícia     → nada
 *   "quando muda a rotina ela fica mal"   → acontece, e ela sofre     → nada
 *
 * Nenhuma lista de verbos separa os três. O que separa é o ENQUADRAMENTO:
 * ou existe uma moldura de pedido ("quero", "pode", "dá pra", "me"), ou a
 * mensagem começa pelo verbo — que em português é o imperativo dirigido a
 * quem lê. Fora disso, o verbo está descrevendo a vida, não pedindo nada.
 */
const MOLDURA_DE_PEDIDO =
  /\b(quero|queria|quer[ií]amos|gostaria|preciso|precisava|pode|podia|poderia|consegue|da pra|d[áa] pra|tem como|vamos|bora|me (faz|faca|monta|monte|cria|crie|manda|mande|envia|envie|mostra|mostre|traz|traga|ajuda|ajude|prepara|prepare|passa|passe|ajusta|ajuste|muda|mude))\b/;

/**
 * A ORAÇÃO É TEMPORAL/CONDICIONAL — narra quando algo acontece.
 *
 * "quando muda a rotina ela fica mal", "toda vez que muda". A mãe está
 * contando o que acontece com a filha; o verbo pertence ao mundo dela, não a
 * um pedido. Um subordinador na abertura nunca introduz imperativo.
 */
const NARRATIVA = /^(quando|qdo|se|toda vez|sempre que|todas as vezes|as vezes|depois que|assim que)\b/;

/**
 * A mensagem COMEÇA pelo verbo — o imperativo dirigido a quem lê.
 *
 * ⚠️ PRIMEIRA PALAVRA, e não "entre as duas primeiras": com duas, "qdo muda
 * rotina ela fica mal" passava por imperativo por causa do `qdo` na frente.
 * O erro apareceu no próprio corpus, antes de qualquer commit.
 */
const COMECA_COM_VERBO = (t: string, verbo: RegExp) => verbo.test(t.split(" ")[0] ?? "");

const pedidoDirigido = (t: string, verbo: RegExp) => {
  if (NARRATIVA.test(t)) return false;
  return MOLDURA_DE_PEDIDO.test(t) || COMECA_COM_VERBO(t, verbo);
};

/** PERGUNTA SOBRE O PASSADO — auditoria do que já aconteceu, não pedido. */
const SOBRE_O_PASSADO =
  /\b(ja tinha|ja sabia|ja conhecia|voce sabia|vc sabia|por que|porque|pq) \b|\b(o que|oq|que) (voce|vc) (salvou|guardou|sabe|considerou|usou|colocou)\b/;

/** VERBO DE CRIAR — o pedido de um artefato novo. */
const CRIAR =
  /\b(faz|faca|fazer|monta|monte|montar|cria|crie|criar|prepara|prepare|preparar|elabora|elabore|elaborar|gera|gere|gerar|quero um|queria um|quero uma|queria uma|me faz|me monta|me cria)\b/;

/** VERBO DE ALTERAR o que já existe. */
const EDITAR =
  /\b(ajusta|ajuste|ajustar|muda|mude|mudar|troca|troque|trocar|corrige|corrija|corrigir|arruma|arrume|arrumar|tira|tire|tirar|remove|remover|acrescenta|acrescentar|adiciona|adicionar|inclui|incluir|refaz|refazer|atualiza|atualizar)\b/;

/** VERBO DE ENTREGA — quer receber de volta o que já existe. */
const ENTREGAR =
  /\b(manda|mande|mandar|envia|envie|enviar|traz|traga|trazer|mostra|mostre|mostrar|passa|passe|passar|reenvia|reenviar|me ve|reenvie)\b/;

/**
 * O ATO DA FAMÍLIA SOBRE UM ARTEFATO.
 *
 * `mencionaArtefato` é responsabilidade de quem chama: cada artefato tem o seu
 * vocabulário ("rotina", "quadro", "cartões" · "plano", "roteiro"), e essa
 * parte continua onde já estava. O que este módulo decide é o ATO.
 *
 * ⚠️ A ORDEM DAS LEITURAS É A REGRA. Recusa vence tudo — a família dizendo que
 * não quer é a informação mais forte do turno. Depois vem a existência do
 * artefato, porque ela desqualifica "criar" mesmo com verbo de criação. Por
 * último os verbos, que sozinhos nunca decidiram nada de bom.
 */
export function atoSobreArtefato(texto: string | null | undefined): AtoSobreArtefato {
  const t = norm(texto);
  if (!t) return "ambiguo";

  // 1 · RECUSA — vence tudo, inclusive um verbo de criar na mesma frase.
  if (RECUSA.test(t)) return "recusar";

  const jaExiste = JA_EXISTE.test(t);

  // 2 · PERGUNTA SOBRE O PASSADO — auditoria, nunca pedido.
  //     "Você já tinha informação suficiente para montar um plano?" tem
  //     "montar" e é uma pergunta sobre o que aconteceu. Foi o caso do Mário.
  if (SOBRE_O_PASSADO.test(t)) return "conversar_sobre";

  // 3 · O ARTEFATO JÁ EXISTE: só cabe alterar, receber de volta ou falar dele.
  //     E alterar/receber ainda exigem que a mãe esteja PEDINDO — falar de um
  //     plano que existe é o caso mais comum de todos.
  if (jaExiste) {
    if (EDITAR.test(t) && pedidoDirigido(t, EDITAR)) return "editar";
    if (ENTREGAR.test(t) && pedidoDirigido(t, ENTREGAR)) return "reenviar";
    return "conversar_sobre";
  }

  // 4 · NÃO EXISTE (ou não se sabe): o verbo só decide COM a moldura de pedido.
  //     Sem ela, o verbo está narrando a vida da criança.
  if (CRIAR.test(t) && pedidoDirigido(t, CRIAR)) return "criar";
  // "ajusta a rotina" sem referência a uma existente ainda é alteração — o
  // fluxo de edição sabe lidar com "não achei nenhuma".
  if (EDITAR.test(t) && pedidoDirigido(t, EDITAR)) return "editar";
  if (ENTREGAR.test(t) && pedidoDirigido(t, ENTREGAR)) return "reenviar";

  // 5 · A palavra apareceu e mais nada. Não se cria por menção.
  return "ambiguo";
}

/** Este ato pode ABRIR geração ou alteração de artefato? Só dois podem. */
export function abreFluxoDeArtefato(ato: AtoSobreArtefato): boolean {
  return ato === "criar" || ato === "editar";
}
