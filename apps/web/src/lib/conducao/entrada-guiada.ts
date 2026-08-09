import { TEMAS, type Tema } from "./temas";

/**
 * A ENTRADA GUIADA — quando a família chega e não sabe o que contar.
 *
 * O problema, observado em produção: famílias novas escrevem "oi", "preciso de
 * ajuda", uma palavra. A entrada anterior já recuperava os desafios do
 * onboarding, mas os oferecia em PROSA — *"o que mais tem pesado é a
 * comunicação e o sono. Por qual você quer começar?"* — e isso ainda exige que
 * a mãe formule a resposta. Responder um número é muito mais barato do que
 * escrever uma frase quando se está exausta.
 *
 * O menu faz três coisas ao mesmo tempo, e é por isso que ele não é só uma
 * lista: mostra que a Ayla já sabe algo daquela criança (os do onboarding vêm
 * primeiro), reduz o esforço da resposta, e **mostra à mãe assuntos em que ela
 * não sabia que a Kolo ajuda**.
 *
 * ⚠️ NÃO É PORTÃO. Quem chega com uma situação concreta ("ele não quer fazer
 * lição") é atendida na hora — ver `ehEntradaVaga`. O menu é rampa para quem
 * não tem por onde começar, nunca um formulário antes da ajuda.
 *
 * ⚠️ NÃO CRIA CATÁLOGO NOVO. Os temas são os de `temas.ts`, o mesmo vocabulário
 * que o onboarding grava e o classificador devolve.
 */

/** Quantos desafios do onboarding entram no topo. Três é o que o cadastro pede. */
const MAX_ONBOARDING = 3;

/**
 * A ORDEM DOS COMPLEMENTARES — e por que existe um corte.
 *
 * `TEMAS` tem quinze entradas. Uma lista de quinze números numa mensagem de
 * WhatsApp é exatamente o oposto de reduzir esforço: vira parede de texto e a
 * mãe desiste antes de ler. Então mostramos os do onboarding + poucos outros.
 *
 * A ordem abaixo é dos assuntos mais amplos, os que cobrem a maior parte do que
 * as famílias trazem — não é ranking de importância, é probabilidade de servir
 * a quem ainda não disse nada. Quem não se vê na lista tem a última opção.
 */
const ORDEM_COMPLEMENTARES: readonly string[] = [
  "emocional",
  "rotina",
  "sono",
  "nutricional",
  "sensorial",
  "comunicacao",
  "foco",
  "socializacao",
  "autonomia",
  "escola",
  "aprendizado",
];

/** Teto de opções de tema, fora a "outra". Nove linhas já é bastante. */
const MAX_COMPLEMENTARES = 5;

/** A saída de quem não se vê em nenhum tema. Nunca some do menu. */
export const CHAVE_OUTRA = "outra";

export type OpcaoMenu = {
  /** O número que a mãe responde. 1-based, na ordem exibida. */
  n: number;
  /** Chave canônica de `temas.ts`, ou `outra`. */
  chave: string;
  rotulo: string;
  /** Veio do que a família marcou no cadastro? Só estes podem ser citados como dela. */
  doOnboarding: boolean;
};

export type MenuTemas = {
  opcoes: OpcaoMenu[];
  /** Quantos vieram do onboarding. Zero = não dizer "você me contou". */
  doOnboarding: number;
};

const porChave = new Map(TEMAS.map((t) => [t.chave, t] as const));

/**
 * MONTA O MENU. Puro: mesmos desafios, mesmo menu, mesma numeração.
 *
 * Regras que o teste guarda:
 *  - os do onboarding vêm PRIMEIRO, na ordem em que a família os marcou;
 *  - nenhum tema aparece duas vezes — se "sono" veio do cadastro, ele não
 *    reaparece embaixo;
 *  - chave desconhecida (lixo no banco, tema renomeado) é descartada em vez de
 *    virar uma linha sem rótulo;
 *  - "outra situação" é sempre a última.
 */
export function montarMenuTemas(desafiosOnboarding: readonly string[] = []): MenuTemas {
  const vistos = new Set<string>();
  const opcoes: OpcaoMenu[] = [];

  const push = (t: Tema, doOnboarding: boolean) => {
    if (vistos.has(t.chave)) return;
    vistos.add(t.chave);
    opcoes.push({ n: opcoes.length + 1, chave: t.chave, rotulo: t.rotulo, doOnboarding });
  };

  for (const chave of desafiosOnboarding) {
    if (opcoes.length >= MAX_ONBOARDING) break;
    const t = porChave.get(chave);
    // Chave que não existe no vocabulário NÃO vira opção: melhor um menu com
    // dois itens verdadeiros do que três com um rótulo inventado.
    if (t) push(t, true);
  }
  const doOnboarding = opcoes.length;

  for (const chave of ORDEM_COMPLEMENTARES) {
    if (opcoes.length - doOnboarding >= MAX_COMPLEMENTARES) break;
    const t = porChave.get(chave);
    if (t) push(t, false);
  }

  opcoes.push({
    n: opcoes.length + 1,
    chave: CHAVE_OUTRA,
    rotulo: "Outra situação",
    doOnboarding: false,
  });

  return { opcoes, doOnboarding };
}

/**
 * O TEXTO DO MENU.
 *
 * "Você me contou quando entrou" só aparece quando ALGO veio mesmo do
 * onboarding. Dizer isso sobre uma lista genérica seria inventar memória — e
 * memória inventada é pior que memória ausente, porque a mãe confia nela.
 */
export function textoDoMenu(p: {
  menu: MenuTemas;
  nomeMae?: string | null;
  nomeCrianca?: string | null;
}): string {
  const { menu } = p;
  const saudacao = p.nomeMae?.trim() ? `Oi, ${p.nomeMae.trim()}! 💛` : "Oi! 💛";
  const comCrianca = p.nomeCrianca?.trim() ? ` com ${p.nomeCrianca.trim()}` : "";
  const linhas: string[] = [saudacao, "", `Por onde você quer que eu te ajude${comCrianca}?`];

  const daFamilia = menu.opcoes.filter((o) => o.doOnboarding);
  const outros = menu.opcoes.filter((o) => !o.doOnboarding);

  if (daFamilia.length > 0) {
    linhas.push(
      "",
      daFamilia.length > 1
        ? "Quando você entrou, me contou que alguns pontos importantes são:"
        : "Quando você entrou, me contou que um ponto importante é:",
      ...daFamilia.map((o) => `${o.n}. ${o.rotulo}`),
      "",
      "Também posso ajudar com:",
    );
  } else {
    linhas.push("", "Posso te ajudar com:");
  }

  linhas.push(...outros.map((o) => `${o.n}. ${o.rotulo}`));
  linhas.push(
    "",
    "Pode responder só com o número. Se for mais fácil, manda um *áudio* me contando o que está acontecendo. 🌿",
  );
  return linhas.join("\n");
}

/**
 * LÊ O MENU DE VOLTA, do texto que foi REALMENTE enviado.
 *
 * É assim que "2" continua significando o que a mãe viu, e não o que o código
 * montaria hoje. Recalcular o menu na hora da resposta parece equivalente e não
 * é: basta o cadastro dela mudar entre uma mensagem e outra para a numeração
 * andar e a escolha virar outro tema, sem ninguém perceber.
 *
 * A mensagem já está persistida em `ayla_messages` — não há estado novo aqui.
 */
export function lerMenuDoTexto(texto: string | null | undefined): OpcaoMenu[] {
  const out: OpcaoMenu[] = [];
  const vistos = new Set<number>();
  for (const linha of (texto ?? "").split("\n")) {
    const m = linha.trim().match(/^(\d{1,2})\.\s+(.+?)\s*$/);
    if (!m) continue;
    const n = Number(m[1]);
    const rotulo = m[2].trim();
    if (!n || vistos.has(n)) continue;
    const t = TEMAS.find((x) => x.rotulo.toLowerCase() === rotulo.toLowerCase());
    vistos.add(n);
    out.push({
      n,
      chave: t?.chave ?? CHAVE_OUTRA,
      rotulo,
      doOnboarding: false,
    });
  }
  return out;
}

export type EscolhaMenu = {
  /** Chaves escolhidas, na ordem em que a mãe as disse. */
  chaves: string[];
  /** Ela escolheu "outra situação"? */
  outra: boolean;
  /** Os números que ela mandou, para o log. */
  numeros: number[];
};

/**
 * INTERPRETA A RESPOSTA.
 *
 * Conservador de propósito: só reconhece resposta que é essencialmente
 * NÚMERO(S). "2" e "1 e 3" entram; "2 anos", "quero a 2 mas na verdade o
 * problema é outro" NÃO — quem escreveu uma frase está conversando, e a frase
 * vale mais que o número dentro dela. Reconhecer demais aqui é transformar
 * conversa em formulário.
 */
export function interpretarEscolha(
  texto: string | null | undefined,
  opcoes: readonly OpcaoMenu[],
): EscolhaMenu | null {
  const t = (texto ?? "").trim();
  if (!t || opcoes.length === 0) return null;
  // Só dígitos, separadores e a conjunção. Qualquer outra palavra reprova —
  // é o que mantém "ele tem 2 anos" fora daqui. O separador é opcional porque
  // "1 3" chega tanto quanto "1 e 3".
  if (!/^\d{1,2}(?:\s*(?:[,;/+-]|\be\b|\bou\b)?\s*\d{1,2})*[.!\s]*$/i.test(t)) return null;

  const numeros = [...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
  const chaves: string[] = [];
  let outra = false;
  const usados = new Set<number>();
  for (const n of numeros) {
    if (usados.has(n)) continue;
    const op = opcoes.find((o) => o.n === n);
    // Número fora do menu não vira escolha nem erro: a conversa segue normal.
    if (!op) continue;
    usados.add(n);
    if (op.chave === CHAVE_OUTRA) outra = true;
    else chaves.push(op.chave);
  }
  if (chaves.length === 0 && !outra) return null;
  return { chaves, outra, numeros: [...usados] };
}

/**
 * A MENSAGEM É VAGA A PONTO DE MERECER O MENU?
 *
 * Estreito de propósito, e o teste protege o contraste: **situação concreta
 * tem prioridade sobre o menu, sempre.** O erro caro aqui não é deixar de
 * mostrar o menu — é mostrá-lo a quem já disse o que está acontecendo, porque
 * aí a Ayla responde um formulário a quem pediu ajuda.
 *
 * Por isso a regra é por LISTA FECHADA de aberturas vazias, e não por
 * heurística de tamanho: "ele morde" tem dez caracteres e é uma situação.
 */
const ABERTURA_VAZIA =
  /^(oi+|ol[áa]+|hey|opa|bom dia|boa tarde|boa noite|tudo bem\??|ola|oii+)?[\s,!.💛🌿🙏😊]*(tudo bem\??)?[\s,!.]*$/i;

const PEDIDO_SEM_ASSUNTO =
  /^(oi+|ol[áa]|bom dia|boa tarde|boa noite)?[\s,!.]*((eu )?(preciso|queria|quero|gostaria) de ajuda|me ajuda|pode me ajudar|preciso de uma ajuda|socorro|preciso conversar|to precisando de ajuda|estou precisando de ajuda)[\s,!.?💛🌿]*$/i;

export function ehEntradaVaga(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim().replace(/\s+/g, " ");
  if (!t) return true;
  // Mensagem longa nunca é vaga: ela contou alguma coisa.
  if (t.length > 90) return false;
  return ABERTURA_VAZIA.test(t) || PEDIDO_SEM_ASSUNTO.test(t);
}
