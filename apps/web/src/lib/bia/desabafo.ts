import { termos } from "./pontuacao";

/**
 * DESABAFO PURO — quando a BIA tem de ficar quieta. PURO, sem I/O.
 *
 * O problema que isto resolve foi medido na bancada: "hoje eu não aguento mais,
 * tô exausta" recuperava quatro regras operacionais e injetava ~674 tokens de
 * conhecimento técnico num turno que pedia acolhimento. Não é só desperdício de
 * contexto — é um empurrão para a Ayla responder com conteúdo quando a mãe
 * pediu colo.
 *
 * Acolhimento é do Core (`lib/conducao/diretrizes.ts`), e continua sendo. A BIA
 * só some.
 *
 * ============================================================
 * O CRITÉRIO
 * ============================================================
 *
 * Não é uma lista de frases. São três portas, nesta ordem — basta uma abrir para
 * a BIA continuar normalmente:
 *
 *   1. SINAL DE RISCO no relato → nunca silencia. Segurança e encaminhamento
 *      passam sempre, mesmo em desabafo. (`contextoTemSinalDeRisco`)
 *   2. DOMÍNIO identificável (sono, alimentação, crise, escola, comunicação…)
 *      → há problema concreto, a BIA serve.
 *   3. CONTEÚDO CONCRETO no texto → algum termo que não seja estado interno do
 *      adulto, tempo vago ou verbo de intenção.
 *
 * A terceira porta é o miolo, e é definida por AUSÊNCIA, não por lista de
 * desabafos: o relato é desabafo puro quando TODOS os termos que sobram depois
 * das stopwords pertencem a três campos — como a mãe se sente, quando, e o que
 * ela quer. Nada sobre a criança, nada sobre uma situação. Se sobrar um único
 * termo fora desses campos ("ele grita", "a escola ligou", "no mercado"), há o
 * que recuperar e a BIA roda.
 *
 * O viés é deliberadamente PERMISSIVO: um termo concreto basta para liberar. É
 * melhor a BIA entrar num turno que talvez não precisasse dela — o bloco já
 * manda ignorar o que não for pertinente — do que ficar muda diante de um
 * problema real embrulhado em desabafo.
 *
 * Os radicais abaixo são sinais linguísticos por prefixo, não frases: "exaust"
 * cobre exausta/exaustão/exaustivo. A lista pode ficar incompleta sem quebrar
 * nada — termo desconhecido conta como concreto, e o pior caso é a BIA rodar.
 */

/** Como a mãe se sente. Estado interno do adulto, não fato sobre a criança. */
const ESTADO_ADULTO = [
  "aguent", "exaust", "esgotad", "cansa", "cansei", "limite", "forca", "forcas",
  "desist", "chorei", "chorand", "culpa", "culpad", "trist", "deprimi", "angusti",
  "desesper", "sofr", "sofrend", "pesad", "dificil", "dificeis", "sobrecarreg",
  "frustrad", "ansios", "sozinh", "solidao", "fracass", "incapaz", "impotent",
  "vazio", "irritad", "nervos", "estress", "burnout", "desabaf", "saturad",
  "perdid", "confus", "assustad", "insegur", "infeliz", "acabada", "morta",
];

/** Quando. Marcadores temporais vagos não são conteúdo. */
const TEMPO_VAGO = [
  "hoje", "ontem", "agora", "sempre", "nunca", "semana", "semanas", "mes",
  "meses", "ano", "anos", "ultimamente", "dias", "tempo", "momento", "fase",
  "hora", "horas", "vezes", "quase", "toda", "todos", "todas",
];

/** O que ela quer. Verbo de intenção/meta-conversa não é fato relatado. */
const INTENCAO = [
  "sinto", "sentindo", "sentir", "senti", "preciso", "precisava", "queria",
  "quero", "gostaria", "acho", "achei", "sei", "consigo", "consegui", "aguentar",
  "desabafar", "conversar", "ajuda", "ajudar", "socorro", "sabe", "falar",
  "dizer", "contar", "obrigada", "obrigado", "vou", "vai", "ser", "estar",
];

/**
 * Como ela se nomeia. "mãe", "vida", "gente" descrevem quem fala, não um fato
 * sobre a criança — "me sinto uma mãe fracassada" não dá nada a recuperar.
 */
const AUTORREFERENCIA = ["mae", "maes", "materna", "vida", "gente", "pessoa"];

const VAGOS = [...ESTADO_ADULTO, ...TEMPO_VAGO, ...INTENCAO, ...AUTORREFERENCIA];

/** Um termo é vago se começa por algum dos radicais conhecidos. */
function ehVago(termo: string): boolean {
  return VAGOS.some((r) => termo.startsWith(r));
}

export type EntradaDesabafo = {
  /** O relato bruto — texto da conversa, dificuldade e objetivo juntos. */
  texto: string;
  /** Domínio já inferido/informado. Presente = problema concreto. */
  dominio?: string | null;
  /** Já calculado por `contextoTemSinalDeRisco`. */
  temRisco?: boolean;
};

/**
 * `true` quando o relato é só acolhimento — e a BIA deve devolver bloco vazio.
 *
 * Nota sobre segurança: sofrimento grave do adulto (ideação, "não quero mais
 * viver") cai aqui como desabafo, e é o comportamento certo. Esse tema é do
 * Core e do piso de segurança, não de conhecimento técnico sobre a criança —
 * conhecimento de apoio ali seria exatamente a resposta errada.
 */
export function ehDesabafoPuro(entrada: EntradaDesabafo): boolean {
  if (entrada.temRisco) return false;
  if ((entrada.dominio ?? "").trim()) return false;

  const t = termos(entrada.texto ?? "");
  // Sem termo nenhum não é desabafo, é saudação: o retriever já devolve vazio
  // sozinho (sem núcleo e sem termo, não há consulta a disparar).
  if (t.size === 0) return false;

  for (const termo of t) {
    if (!ehVago(termo)) return false;
  }
  return true;
}
