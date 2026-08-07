/**
 * "QUERO O PDF" — a rota que faltava.
 *
 * ⚠️ O CASO, inteiro, em produção (Rosângela, 07/08/2026):
 *
 *   13:37  rotina "Sábado do parque" criada, cards_status = nenhum
 *   13:45  MÃE  "Quero o pdf"
 *   13:45  AYLA "O PDF já foi enviado junto com a rotina"   ← falso
 *   13:49  MÃE  "O que eu quero é o PDF dessa rotina"
 *   13:50  AYLA "Pra montar esse quadro eu preciso da sequência…"
 *   13:51  MÃE  "Eu já mandei… Só preciso do PDF"
 *   13:51  AYLA a MESMA frase, palavra por palavra
 *   13:53  AYLA "Aqui vai o PDF" → cria uma SEGUNDA rotina, duplicada
 *
 * A causa não era o CONTRATO_DE_VERDADE — ele estava certo. Era que
 * `pediuParaImprimir` existia, tinha teste, e NUNCA fora ligada como rota de
 * entrada: só era usada dentro do construtor, varrendo o histórico. Sem função
 * pra executar, o modelo fez o que um modelo faz — narrou o estado que parecia
 * certo.
 *
 * Prompt não conserta ausência de função. Rota conserta.
 *
 * ═══ POR QUE ANTES DE `pedeRotina` ═══
 *
 * "Eu já mandei e você montou a rotina. Só preciso do PDF" contém a palavra
 * ROTINA — e `pedeRotina` casa com ela. Registrada depois do gate de rotina,
 * esta rota nunca veria a mensagem: o construtor a captura primeiro, pede a
 * sequência de novo e duplica o artefato. Foi exatamente o que aconteceu.
 *
 * ═══ OS TRÊS ARTEFATOS, QUE NÃO SE MISTURAM ═══
 *
 *   ROTINA NA PLATAFORMA — interativa, com checklist, salva. Já existe.
 *   PDF SIMPLES          — a sequência em texto. `rotinaParaPdf`, IMEDIATO,
 *                          e não depende de `cards_status`.
 *   CARTÕES ILUSTRADOS   — recurso à parte, geração assíncrona. O PDF dos
 *                          cartões só existe depois que eles existem.
 */

/** "quero o pdf", "manda pra imprimir", "quero imprimir". */
const PEDE_PDF =
  /\b(pdf|imprimir|imprime|impress[ãa]o|papel)\b|\bcolar (na|em) (parede|geladeira)\b/i;

/** "quero os cartões", "faz os cards" — recurso DIFERENTE do PDF simples. */
const PEDE_CARTOES = /\b(cart[õo]es|cartao|cart[ãa]o|cards)\b/i;

/**
 * O pedido é de artefato imprimível?
 *
 * Deliberadamente NÃO exige a palavra "rotina": "quero o pdf" sozinho é o caso
 * real. Quem garante que existe rotina pra apontar é o chamador — sem rotina,
 * isto não vira ação nenhuma.
 */
export function pedeArtefatoImprimivel(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t || t.length > 300) return false;
  return PEDE_PDF.test(t) || PEDE_CARTOES.test(t);
}

export type AlvoImprimivel = "pdf_simples" | "cartoes";

/**
 * Qual dos dois ela quer.
 *
 * "quero o PDF dos cartões" pede as duas coisas — e o alvo é CARTÕES, porque é
 * o substantivo que manda; "pdf" ali é o formato. Já "quero o pdf" seco é o
 * simples, que é o que sai na hora.
 */
export function alvoDoPedido(texto: string): AlvoImprimivel {
  return PEDE_CARTOES.test(texto) ? "cartoes" : "pdf_simples";
}

/**
 * "NÃO CHEGOU" — só vale com âncora.
 *
 * Sozinha, a frase é das mais ambíguas do produto: pode ser o PDF, o link, uma
 * mensagem, ou a própria rotina. Foi assim que "Não está na rotina" virou
 * "faltam etapas" e a Ayla reescreveu o que estava certo.
 *
 * Então só vira reenvio quando houve entrega de artefato AGORA HÁ POUCO pra
 * apontar. Sem isso, devolve false e a mensagem segue como conversa — que é o
 * comportamento barato e correto.
 */
const NAO_CHEGOU =
  /\bn[ãa]o (chegou|recebi|veio|apareceu|abriu|abre)\b|\bn[ãa]o consigo abrir\b|\bmanda de novo\b|\benvia de novo\b|\breenvia\b/i;

export function pedeReenvio(
  texto: string | null | undefined,
  ancora: { artefatoRecente: boolean },
): boolean {
  const t = (texto ?? "").trim();
  if (!t || t.length > 300) return false;
  if (!NAO_CHEGOU.test(t)) return false;
  // A âncora é o ponto. Sem entrega recente, não se sabe o que reenviar.
  return ancora.artefatoRecente;
}

/**
 * As respostas. Uma por desfecho operacional REAL — nenhuma delas pode ser
 * escolhida antes de o sistema saber o que aconteceu.
 */
export const RESPOSTA_PDF = {
  /** Só depois de o provedor aceitar o documento. */
  enviado: "Pronto 💛 Te mandei aqui o PDF da rotina, é só imprimir.",
  /** Falhou. Não inventa estado, e não deixa a mãe sem caminho. */
  falhou:
    "Não consegui te mandar o PDF agora 🌿 A rotina segue salva na Kolo, e eu posso tentar de novo.",
  /**
   * Cartões disparados. ⚠️ NÃO prometemos envio automático: quando os cartões
   * terminam, o código só faz `update cards_status = 'pronto'` — não existe job
   * que avise a mãe nem que mande o PDF. Prometer isso seria repetir o defeito
   * que esta frente veio consertar.
   */
  cartoesGerando: (link: string) =>
    `Vou preparar os cartões dessa rotina 🌿 Eles levam alguns minutinhos e vão aparecer aqui:\n${link}\n\nQuando estiverem prontos, me avisa que eu te mando o PDF pra imprimir.`,
  /** Já estão sendo feitos — não dispara de novo nem promete duas vezes. */
  cartoesJaGerando: (link: string) =>
    `Os cartões dessa rotina já estão sendo preparados 🌿 Assim que aparecerem aqui, me avisa que eu te mando pra imprimir:\n${link}`,
  /** Nenhuma rotina pra apontar: não inventa artefato, e oferece o caminho. */
  semRotina:
    "Ainda não temos uma rotina montada pra eu transformar em PDF 🌿 Se você me contar a sequência do dia, eu organizo e já te mando.",
  /** Duas plausíveis: UMA pergunta curta, e nada de pedir a sequência de novo. */
  qualDelas: (nomes: readonly string[]) =>
    `Você quer o PDF de qual delas: ${nomes.join(" ou ")}?`,
} as const;

/**
 * A CONVERSA GANHA DO BANCO — a regressão de 07/08/2026, e ela foi minha.
 *
 * A Ayla acabou de escrever, na conversa, a sequência do passeio de amanhã.
 * A mãe pediu "uns cartões visuais para eu mostrar o que vai acontecer e em
 * que ordem". `pedeArtefatoImprimivel` casou em "cartões", a rota consultou as
 * rotinas SALVAS e perguntou: "Você quer o PDF de qual delas: Tarde e noite ou
 * Dia do dentista?".
 *
 * O alvo não estava no banco. Estava no turno anterior.
 *
 * Nenhuma frase mais calorosa consertaria isso — "Entendo perfeitamente 💛" na
 * frente da mesma pergunta continuaria péssimo. O que quebrou a sensação de
 * cuidado foi fazer a mãe repetir o que ela tinha acabado de dizer.
 *
 * ⚠️ ESTA É A MITIGAÇÃO, não a solução inteira. A solução é a rota RESOLVER o
 * referente recente e montar a partir dele. Aqui ela apenas SAI DA FRENTE
 * quando percebe que o alvo é recente — e deixa o construtor de rotina, que já
 * sabe montar a partir da conversa, fazer o trabalho. Menos ambicioso e
 * reversível; tira a família da linha de tiro hoje.
 */

/** Aponta pra algo que acabou de ser dito, não pra um arquivo salvo.
 *
 * `essa`/`esse`/`isso` soltos entram aqui e NÃO são perigosos: esta função só
 * é consultada depois de `pedeArtefatoImprimivel`, ou seja, a mensagem já fala
 * de PDF, cartões ou impressão. O demonstrativo já chega ancorado. */
const REFERENTE_RECENTE =
  /\b(disso|dessa|desse|dess[ae]s|nisso|essa|esse|isso|o que te contei|o que eu contei|que voc[êe] (montou|organizou|escreveu))\b|\bpra? (amanh[ãa]|hoje|s[áa]bado|domingo|segunda|ter[çc]a|quarta|quinta|sexta)\b|\bum novo\b|\buma nova\b/i;

/**
 * O pedido aponta pro que acabou de ser construído na conversa?
 *
 * Duas evidências, e basta UMA:
 *   · a mãe usa demonstrativo ou fala de um dia futuro ("cartões disso",
 *     "um novo pra amanhã", "o que te contei");
 *   · a última fala da Ayla trouxe uma SEQUÊNCIA numerada — o objeto que a
 *     mãe está apontando.
 *
 * Conservador de propósito: quando devolve `true`, a rota determinística
 * apenas SAI, e o pedido segue pro construtor. O pior caso é o comportamento
 * de antes desta rota existir; o melhor é a família não repetir nada.
 */
export function apontaProRecente(
  texto: string,
  ultimaFalaDaAyla: string | null | undefined,
): boolean {
  if (REFERENTE_RECENTE.test(texto)) return true;
  const anterior = (ultimaFalaDaAyla ?? "").trim();
  if (!anterior) return false;
  // Sequência numerada com 3+ passos: "1. sair com a amiga\n2. mercado…"
  const passos = anterior.match(/^\s*\d[.)]\s+\S/gm) ?? [];
  return passos.length >= 3;
}
