import type { BiaTipoConhecimento } from "./tipos";
import type { ResultadoBia } from "./pontuacao";

/**
 * MONTAGEM DO BLOCO DA BIA — cotas, orçamento e instruções. PURO.
 *
 * A BIA entra como CONTEXTO COMPLEMENTAR e nada mais. Ela não decide se a Ayla
 * pergunta, conversa ou entrega — isso é do `prontidao-plano.ts`, que roda antes
 * e continua intocado. Não substitui as Boas Práticas, não muda o tom, não muda
 * a identidade: a identidade é do Core (`lib/conducao/diretrizes.ts`).
 *
 * Este módulo é puro para que as cotas e o corte por orçamento possam ser
 * testados sem banco — é onde mora o risco de estourar o contexto.
 */

// ============================================================
// Cotas — diversidade antes de volume
// ============================================================

type Cota = {
  rotulo: string;
  tipos: readonly BiaTipoConhecimento[];
  max: number;
};

/**
 * Cotas conservadoras da primeira integração.
 *
 * A cota de SEGURANÇA é um acréscimo meu à lista pedida, e é deliberado: o
 * retriever promove conteúdo de encaminhamento na frente de tudo quando há
 * sinal de risco no contexto (+60). Sem uma vaga para ele, um relato de
 * regressão recuperaria o alerta certo e o bloco o descartaria por não ter cota
 * — uma regressão de segurança. Ela ocupa uma das 5 vagas totais, então não
 * aumenta o orçamento.
 */
export const COTAS: readonly Cota[] = [
  { rotulo: "seguranca", tipos: ["sinal_de_alerta", "encaminhamento"], max: 1 },
  { rotulo: "interpretacao", tipos: ["interpretacao"], max: 1 },
  { rotulo: "pergunta", tipos: ["pergunta_investigativa"], max: 1 },
  { rotulo: "regras", tipos: ["regra_operacional"], max: 2 },
  { rotulo: "pratico", tipos: ["estrategia", "conceito"], max: 2 },
];

/** Teto absoluto, mesmo que as cotas permitissem mais. */
export const MAX_CHUNKS = 5;

/** Teto de caracteres do TEXTO recuperado (sem contar as instruções). */
export const MAX_CHARS_TEXTO = 2000;

/** Teto por chunk. Um chunk gigante não pode comer o orçamento sozinho. */
export const MAX_CHARS_POR_CHUNK = 600;

/**
 * Aplica as cotas sobre resultados JÁ ORDENADOS por score.
 *
 * Tipos sem cota (princípio de ouro, explicação para a família, fundamento…)
 * ficam de fora de propósito: são os mais próximos do que o Core já diz, e o
 * risco de a Ayla "recuperar a própria identidade" mora exatamente aí.
 */
export function aplicarCotas(resultados: ResultadoBia[]): ResultadoBia[] {
  const usado = new Map<string, number>();
  const saida: ResultadoBia[] = [];

  for (const r of resultados) {
    if (saida.length >= MAX_CHUNKS) break;
    const cota = COTAS.find((c) => c.tipos.includes(r.chunk.tipo_conhecimento));
    if (!cota) continue;
    const n = usado.get(cota.rotulo) ?? 0;
    if (n >= cota.max) continue;
    usado.set(cota.rotulo, n + 1);
    saida.push(r);
  }
  return saida;
}

/** Corta um texto no limite, sem partir palavra no meio. */
function encurtar(texto: string, limite: number): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trim()}…`;
}

/**
 * Aplica o orçamento de caracteres. Reduz pela ordem de pontuação: descarta do
 * FIM (menor score), preservando o que as cotas já garantiram lá em cima.
 */
export function aplicarOrcamento(resultados: ResultadoBia[]): ResultadoBia[] {
  const saida: ResultadoBia[] = [];
  let total = 0;
  for (const r of resultados) {
    const texto = encurtar(r.chunk.texto_original, MAX_CHARS_POR_CHUNK);
    if (total + texto.length > MAX_CHARS_TEXTO && saida.length > 0) break;
    total += texto.length;
    saida.push(r);
  }
  return saida;
}

// ============================================================
// Instruções
// ============================================================

/**
 * As regras de uso do bloco. Vão JUNTO do conteúdo, e não no system, porque o
 * conteúdo é volátil (muda a cada turno) e o system é cacheado — misturar
 * quebraria o cache do prompt inteiro.
 *
 * Cada linha aqui existe por um motivo concreto de produto, não por precaução
 * genérica.
 */
const INSTRUCOES = `Isto é CONHECIMENTO DE APOIO para você PENSAR — não é a resposta, não é roteiro e não é obrigatório usar.
- Trate interpretações como HIPÓTESES, nunca como diagnóstico ou causa afirmada.
- NÃO copie o texto literalmente. Integre com as suas palavras, no seu tom.
- NUNCA mencione esta fonte, nem "a biblioteca", nem que consultou algo.
- Use só o que for pertinente ao relato de agora. IGNORE o resto — vir aqui não significa caber.
- Se houver uma pergunta investigativa aqui, ela NÃO é uma ordem para perguntar. Não faça perguntas a mais só porque existe uma.
- O movimento deste turno já foi decidido antes (conversar, perguntar ou entregar). Respeite-o.
- Em qualquer conflito, as regras de segurança, o piso e os limites do Core PREVALECEM sobre tudo isto.`;

const INSTRUCAO_CONFLITO = `- Há tensão entre este material e uma orientação prática deste turno. Siga a alternativa MAIS CAUTELOSA (a que menos expõe, menos força e menos afirma).`;

// ============================================================
// Montagem
// ============================================================

export type BlocoBia = {
  /** O texto pronto para o prompt. Vazio quando não há nada a dizer. */
  texto: string;
  /** Os chunks que sobreviveram às cotas e ao orçamento. */
  usados: ResultadoBia[];
  /** Tamanho do bloco inteiro (instruções incluídas). */
  chars: number;
};

const VAZIO: BlocoBia = { texto: "", usados: [], chars: 0 };

/**
 * Resultados do retriever → bloco pronto.
 *
 * Devolve bloco VAZIO quando não há resultado: bloco vazio no prompt é ruído
 * que custa token e ainda sugere ao modelo que havia algo a considerar.
 */
export function montarBlocoBia(
  resultados: ResultadoBia[],
  opcoes: { temConflito?: boolean } = {},
): BlocoBia {
  const usados = aplicarOrcamento(aplicarCotas(resultados));
  if (usados.length === 0) return VAZIO;

  const itens = usados
    .map((r, i) => `${i + 1}. ${encurtar(r.chunk.texto_original, MAX_CHARS_POR_CHUNK)}`)
    .join("\n");

  const instrucoes = opcoes.temConflito ? `${INSTRUCOES}\n${INSTRUCAO_CONFLITO}` : INSTRUCOES;
  const texto = `<conhecimento_de_apoio>\n${instrucoes}\n\n${itens}\n</conhecimento_de_apoio>`;

  return { texto, usados, chars: texto.length };
}

/** Estimativa de tokens. ~4 chars/token em português — serve para orçamento. */
export function tokensAprox(chars: number): number {
  return Math.ceil(chars / 4);
}
