/**
 * O ARNÊS DA PROVA REAL — o turno de verdade, com o MODELO de verdade.
 *
 * ⚠️ POR QUE ELE EXISTE, e o que ele prova a mais que `conversa-e2e.test.ts`.
 * Aquele arquivo roda `processInbound` inteiro com um modelo FALSO: prova o que
 * CHEGOU ao modelo, e nada sobre o que um modelo escreveria com aquilo. A
 * missão do Core Profissional é exatamente sobre a segunda coisa — a qualidade
 * do raciocínio —, e ela não se prova sem gastar uma chamada paga.
 *
 * O QUE FICA REAL AQUI:
 *   - `processInbound` — o orquestrador inteiro, os portões, a resolução de
 *     criança, a recuperação de repertório, a montagem do prompt;
 *   - `gerarConversacional` — o PRODUTOR, contra a API paga, com o system que
 *     o produto monta de verdade;
 *   - `recuperarBoasPraticas` — a consulta e o FILTRO DE IDADE, contra um
 *     acervo semeado (ver `semearAcervo`).
 *
 * O QUE FICA DETERMINÍSTICO, DE PROPÓSITO, e isto não é preguiça:
 *   - o parser e o classificador de intenção. Eles decidem QUAL criança e QUAL
 *     skill — ou seja, decidem o INSUMO. Se variassem entre a rodada ANTES e a
 *     rodada DEPOIS, a comparação mediria o classificador, não o Core. Aqui
 *     eles são fixados para que a ÚNICA variável entre as duas rodadas seja o
 *     texto do núcleo.
 *
 * ⚠️ ISTO NÃO É UM TESTE DA SUÍTE. Nada aqui roda em `npm test`: o arquivo não
 * casa com `src/**\/*.test.ts`. Quem roda é `prova-core.mjs`, com a chave na
 * mão e por decisão de quem está medindo. Uma chamada paga não pode entrar num
 * `npm test` que alguém roda cem vezes por dia.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * A CHAVE VEM DO `.env.local`, e o Vitest NÃO a carrega sozinho.
 *
 * `vitest.config.ts` não tem `setupFiles` nem plugin de env — então
 * `process.env.ANTHROPIC_API_KEY` chega VAZIO num teste, e o provider morre com
 * "não configurada". Perdi uma rodada com isso: parecia falha do provider e era
 * ausência de carregamento.
 *
 * Parser mínimo de propósito: `KEY=valor`, ignora comentário e linha vazia, não
 * expande nada. Não sobrescreve o que já existe no ambiente — quem exporta na
 * shell manda.
 */
export function carregarEnvLocal(raiz: string): void {
  let bruto: string;
  try {
    bruto = readFileSync(path.join(raiz, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const linha of bruto.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const chave = m[1];
    if (process.env[chave]) continue;
    let valor = m[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
  }
}

/** O que uma chamada ao produtor consumiu — a linha do relatório. */
export type CapturaConversa = {
  system: string;
  user: string;
  texto: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  ms: number;
};

/** Palavras e caracteres do jeito que a régua da missão pede. */
export function medirTexto(t: string) {
  const limpo = t.trim();
  return {
    palavras: limpo ? limpo.split(/\s+/).length : 0,
    caracteres: limpo.length,
    perguntas: (limpo.match(/\?/g) ?? []).length,
  };
}

/** Os IDs das BPs que o bloco `<repertorio_kolo>` levou ao modelo. */
export function bpsNoPrompt(
  user: string,
  acervo: readonly { id: string; titulo: string }[],
): string[] {
  const m = /<repertorio_kolo>([\s\S]*?)<\/repertorio_kolo>/.exec(user);
  if (!m) return [];
  return acervo.filter((b) => m[1].includes(b.titulo)).map((b) => b.id);
}

/**
 * O ACERVO SEMEADO — e a armadilha P0 que ele existe para provar.
 *
 * `47014d89` é a BP de 0-1 ano. Ela está aqui de propósito, marcada como
 * `ativo` e com a skill `sensorial`, para que a única coisa entre ela e o
 * Daniel de 6 anos seja `idadeElegivel`. Se um dia alguém afrouxar aquele
 * filtro "para melhorar a cobertura", esta linha faz a prova morder.
 *
 * ⚠️ O `.or()` do banco em memória NÃO FILTRA (está escrito lá). Então TODAS as
 * linhas semeadas chegam ao pós-filtro — que é exatamente onde queremos a
 * pressão. Um acervo que já chegasse filtrado provaria o duplo, não o produto.
 */
export const ACERVO_PROVA = [
  {
    id: "47014d89",
    titulo: "Boca como exploração no primeiro ano",
    versao_curta: "Levar objetos à boca é como o bebê conhece o mundo.",
    versao_conversa:
      "No primeiro ano, levar tudo à boca é exploração esperada — é assim que o bebê aprende textura, temperatura e forma.",
    quando_usar: "Bebê de 0 a 12 meses levando objetos à boca.",
    erros_comuns: ["Tratar como problema de comportamento", "Repreender o bebê"],
    passos_praticos: [
      "Ofereça mordedores limpos",
      "Deixe o bebê explorar objetos grandes e seguros",
    ],
    skills_relacionadas: ["sensorial"],
    tags: ["oral", "exploracao"],
    peso_relevancia: 400,
    faixa_etaria_min: 0,
    faixa_etaria_max: 1,
    status: "ativo",
  },
  {
    id: "aa11bb22",
    titulo: "Substituição segura para busca oral",
    versao_curta: "Trocar o objeto de risco por uma alternativa segura e parecida.",
    versao_conversa:
      "Quando a criança busca a boca com frequência, tirar sem oferecer nada no lugar costuma durar pouco: a necessidade continua. Trocar por algo com a mesma sensação, mas seguro, sustenta melhor.",
    quando_usar:
      "Criança acima de 2 anos levando à boca objetos que não são comida, sobretudo quando há risco.",
    erros_comuns: ["Só proibir", "Chamar de manha"],
    passos_praticos: [
      "Deixe ao alcance uma alternativa mastigável própria para isso",
      "Guarde fora do alcance o que oferece risco",
      "Repare em que momentos do dia aparece mais",
    ],
    skills_relacionadas: ["sensorial"],
    tags: ["oral", "seguranca"],
    peso_relevancia: 380,
    faixa_etaria_min: 2,
    faixa_etaria_max: 12,
    status: "ativo",
  },
  {
    id: "cc33dd44",
    titulo: "Ler o momento do dia antes de mudar a estratégia",
    versao_curta: "O mesmo comportamento muda de sentido conforme a hora e o contexto.",
    versao_conversa:
      "Antes de mudar a estratégia, vale saber quando o comportamento aparece mais: depois da escola, em espera, sozinho, com barulho. O mesmo gesto pode ter funções diferentes.",
    quando_usar: "Comportamento repetitivo cuja função ainda não está clara.",
    erros_comuns: ["Concluir a causa cedo demais"],
    passos_praticos: ["Anote por três dias em que momentos aparece"],
    skills_relacionadas: ["sensorial", "emocional"],
    tags: ["observacao"],
    peso_relevancia: 370,
    faixa_etaria_min: null,
    faixa_etaria_max: null,
    status: "ativo",
  },
] as const;

/** O catálogo de skills que o classificador valida contra. */
export const SKILLS_PROVA = [
  { name: "sensorial", routing_keywords: ["boca", "textura", "barulho"], ativo: true },
  { name: "emocional", routing_keywords: ["ansioso", "choro"], ativo: true },
  { name: "comunicacao", routing_keywords: ["fala", "pedir"], ativo: true },
  { name: "sono", routing_keywords: ["dormir", "noite"], ativo: true },
  { name: "nutricional", routing_keywords: ["comer", "comida"], ativo: true },
  { name: "foco", routing_keywords: ["atenção", "lição"], ativo: true },
  { name: "autonomia", routing_keywords: ["sozinho", "vestir"], ativo: true },
  { name: "escolar", routing_keywords: ["escola", "professora"], ativo: true },
] as const;
