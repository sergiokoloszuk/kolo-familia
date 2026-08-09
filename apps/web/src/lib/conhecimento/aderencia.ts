/**
 * BASE 3 · ADERÊNCIA AO RELATO — a ordem dentro do conjunto elegível.
 *
 * O problema medido (08–09/08/2026): a seleção era `skill → faixa → peso →
 * top-3`, e o peso é o `default` da coluna em 367 de 370 boas práticas. Com o
 * ranqueamento inerte, quem decide os três é a ordem física da tabela — e o
 * subtema não participa.
 *
 * O caso que dói: *"minha filha bate na irmã quando é contrariada"* devolvia
 * "o cérebro tem andares" e "momentos de quietude estruturados", enquanto
 * *"Explosões de raiva — bate, grita, joga coisas: identifique gatilhos"*
 * existia no acervo, era elegível e ficava de fora.
 *
 * ⚠️ ISTO NÃO MUDA O UNIVERSO DE CANDIDATOS. Skill, tags, status e faixa
 * etária continuam decidindo QUEM entra. Aqui só se decide a ORDEM — assim o
 * efeito da mudança pode ser medido isolado.
 *
 * ⚠️ ZERO CHAMADA DE MODELO. É função pura sobre texto que já está em memória.
 *
 * ── POR QUE NÃO É CAÇA-PALAVRA ─────────────────────────────────────────────
 *
 * Um ranking ingênuo faria *"ele bate a porta"* recuperar conteúdo sobre bater
 * em pessoas — mesma palavra, problema oposto. Três defesas, nesta ordem:
 *
 *   1. **um termo sozinho não pontua.** É preciso convergência: dois termos de
 *      conteúdo distintos, ou um termo forte acompanhado de outro sinal.
 *   2. **par de termos vale mais que a soma dos dois.** "bate" + "irmã" no
 *      mesmo texto é evidência; "bate" solto não é.
 *   3. **piso de confiança.** Abaixo dele o ranking se abstém e devolve a
 *      ordem que já viria — errar por omissão aqui é barato, errar por
 *      empurrar conteúdo errado não é.
 */

/** O que o ranking lê de cada boa prática. Só campos que já existem. */
export type ItemRankeavel = {
  id: string;
  titulo?: string | null;
  versao_conversa?: string | null;
  quando_usar?: string | null;
  passos_praticos?: unknown;
  tags?: unknown;
};

export type Aderencia = {
  id: string;
  pontos: number;
  /** Quais termos do relato foram encontrados — é o que explica o ranking. */
  termos: string[];
};

/**
 * Palavras que aparecem em qualquer relato e não distinguem nada. Sem esta
 * lista, "ele", "que" e "não" casariam com o acervo inteiro.
 */
const VAZIAS = new Set([
  "para", "porque", "quando", "como", "mais", "muito", "todo", "toda", "todos",
  "todas", "isso", "esse", "essa", "este", "esta", "aqui", "ainda", "depois",
  "antes", "sempre", "nunca", "coisa", "coisas", "gente", "pessoa", "vezes",
  "tempo", "hora", "dia", "dias", "meu", "minha", "seu", "sua", "dele", "dela",
  "ele", "ela", "eles", "elas", "nao", "sim", "com", "sem", "por", "que",
  "the", "and", "filho", "filha", "crianca", "menino", "menina", "anos",
  "consegue", "fica", "faz", "fazer", "tem", "ter", "estar", "esta", "muita",
  "acontece", "acaba", "outra", "outro", "algum", "alguma", "sobre", "pouco",
]);

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Reduz variações que a mãe escreve e o acervo não: plural, gênero e algumas
 * flexões verbais frequentes. Rústico de propósito — um stemmer de verdade
 * traria dependência nova para resolver um problema que três regras resolvem.
 */
function raiz(t: string): string {
  let r = t;
  if (r.length > 5) r = r.replace(/(ndo|ram|rem|va|ndo)$/, "");
  if (r.length > 4) r = r.replace(/(s|es)$/, "");
  if (r.length > 4) r = r.replace(/(a|o)$/, "");
  return r;
}

/** Termos de conteúdo do relato, sem repetição e já reduzidos à raiz. */
export function termosDoRelato(relato: string): string[] {
  const brutos = normalizar(relato)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !VAZIAS.has(t));
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const t of brutos) {
    const r = raiz(t);
    if (r.length < 3 || vistos.has(r)) continue;
    vistos.add(r);
    out.push(r);
  }
  return out;
}

/** Peso de cada campo. Título e "quando usar" dizem do que a BP trata. */
const PESO_CAMPO = { titulo: 5, quando: 4, tags: 3, corpo: 2 } as const;

function campos(item: ItemRankeavel) {
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).join(" ") : "");
  return [
    [normalizar(item.titulo ?? ""), PESO_CAMPO.titulo],
    [normalizar(item.quando_usar ?? ""), PESO_CAMPO.quando],
    [normalizar(lista(item.tags)), PESO_CAMPO.tags],
    [normalizar(`${item.versao_conversa ?? ""} ${lista(item.passos_praticos)}`), PESO_CAMPO.corpo],
  ] as const;
}

/**
 * Abaixo disto o ranking não interfere.
 *
 * Calibrado contra os casos NEGATIVOS de 09/08/2026, não escolhido no papel.
 * Com piso 8, "ele bate a porta quando sai do quarto" subia um conteúdo sobre
 * MEDO — porque "porta" e "quarto" convergiam num texto que fala de outra
 * coisa. Dois termos fracos convergindo é ruído; o piso precisa exigir mais do
 * que a soma mínima. Em 10, o falso positivo cai e os casos que melhoraram de
 * verdade (12 e 25 pontos) continuam passando.
 */
export const PISO_ADERENCIA = 10;

export function pontuarItem(item: ItemRankeavel, termos: readonly string[]): Aderencia {
  if (termos.length === 0) return { id: item.id, pontos: 0, termos: [] };
  let pontos = 0;
  const achados = new Set<string>();

  for (const [texto, peso] of campos(item)) {
    if (!texto) continue;
    const noCampo: string[] = [];
    for (const t of termos) {
      if (texto.includes(t)) {
        noCampo.push(t);
        achados.add(t);
      }
    }
    pontos += noCampo.length * peso;
    // CONVERGÊNCIA: dois termos distintos no MESMO campo é o que separa
    // "bate na irmã" de "bate a porta". O bônus é deliberadamente grande.
    if (noCampo.length >= 2) pontos += peso * (noCampo.length - 1) * 2;
  }

  // UM TERMO SOZINHO NÃO SUSTENTA ESCOLHA — e zera, não é aparado.
  //
  // A versão anterior fazia `Math.min(pontos, PISO - 1)`, o que amarrava esta
  // regra ao valor do piso: com piso 0 a pontuação virava −1 e a sabotagem do
  // piso passava despercebida. Duas regras independentes não podem depender
  // uma da outra — foi o teste de sabotagem que expôs isso, não a leitura.
  //
  // Zerar também é mais honesto: uma palavra repetida em quatro campos somaria
  // 14 pontos e passaria o piso sem que houvesse convergência nenhuma.
  if (achados.size < 2) return { id: item.id, pontos: 0, termos: [...achados] };

  return { id: item.id, pontos, termos: [...achados] };
}

export type ResultadoRanking<T> = {
  /** Na ordem final. */
  itens: T[];
  /** Por id, para o rastro: quanto pontuou e por quais termos. */
  aderencias: Map<string, Aderencia>;
  /** O ranking chegou a interferir, ou a ordem é a de antes? */
  interferiu: boolean;
};

/**
 * Reordena o conjunto ELEGÍVEL pela aderência ao relato.
 *
 * Estável: quem empata mantém a ordem que já tinha. Sem relato, ou com
 * aderência abaixo do piso em todo mundo, devolve exatamente a lista original
 * — a abstenção é o comportamento correto quando não há sinal.
 */
export function ordenarPorAderencia<T extends ItemRankeavel>(
  itens: readonly T[],
  relato: string | null | undefined,
): ResultadoRanking<T> {
  const aderencias = new Map<string, Aderencia>();
  const termos = relato ? termosDoRelato(relato) : [];
  if (termos.length === 0 || itens.length === 0) {
    return { itens: [...itens], aderencias, interferiu: false };
  }

  const comPeso = itens.map((item, i) => {
    const a = pontuarItem(item, termos);
    aderencias.set(item.id, a);
    return { item, a, i };
  });

  const algumAcima = comPeso.some((x) => x.a.pontos >= PISO_ADERENCIA);
  if (!algumAcima) return { itens: [...itens], aderencias, interferiu: false };

  const ordenado = [...comPeso].sort((x, y) => {
    const px = x.a.pontos >= PISO_ADERENCIA ? x.a.pontos : 0;
    const py = y.a.pontos >= PISO_ADERENCIA ? y.a.pontos : 0;
    return py - px || x.i - y.i;
  });

  return {
    itens: ordenado.map((x) => x.item),
    aderencias,
    interferiu: ordenado.some((x, i) => x.i !== i),
  };
}
