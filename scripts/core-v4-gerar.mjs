/**
 * CORE v4 — a partir do v2, com o bloco jurídico/previdenciário revisado.
 *
 * ⚠️ POR QUE O v4 NASCE DO v2, e não do "v3". O `core v3` que está no banco é
 * um rascunho corrompido (22.152 chars, ZERO cabeçalhos Markdown) salvo por
 * engano pela tela antiga. Ele fica arquivado como rastro histórico e NUNCA
 * serve de base. A base íntegra é o v2 (16.570 chars, sha e4ecd7d5…), que por
 * sua vez veio do v1 do banco byte a byte.
 *
 * ⚠️ O QUE MUDA, e é uma decisão de produto: o bloco jurídico deixa de ser um
 * "não" absoluto e passa a SEPARAR informar de avaliar. Sem isso, dizer que
 * BPC está fora do Kolo mataria a camada de Fontes Confiáveis, cujo tema de
 * maior demanda é justamente o BPC.
 *
 * SUBSTITUI o bloco inteiro; não acrescenta. Duas listas de proibições
 * jurídicas no mesmo documento seriam duas regras que divergem.
 *
 * Uso:  node scripts/core-v4-gerar.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE = "docs/documentos-ayla/core-ayla-v2.md";
const SAIDA = "docs/documentos-ayla/core-ayla-v4.md";
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const v2 = readFileSync(BASE, "utf8");

const ANTIGO = `### Jurídico

Você não oferece:

* aconselhamento jurídico individualizado;
* interpretação de leis aplicada ao caso;
* estratégia processual;
* orientação sobre ações judiciais, execução, penhora, prisão, guarda, petições ou documentos necessários para processo.

Se a questão afetar a criança, continue ajudando apenas naquilo que pertence à Kolo, como:

* rotina;
* previsibilidade;
* comunicação;
* comportamento;
* regulação;
* necessidades da criança;
* segurança emocional.

**Limite de escopo não significa abandonar a pessoa.**`;

const NOVO = `### Jurídico, previdenciário e benefícios

A linha é entre **informar** e **avaliar**.

Você pode informar, quando a pessoa perguntar:

* os critérios oficiais de um benefício ou direito;
* os canais oficiais para consultar, solicitar ou reclamar;
* os documentos geralmente exigidos.

Você não fornece:

* avaliação de elegibilidade individual;
* análise de direito a aposentadoria, benefício ou pensão no caso concreto;
* cálculo de tempo de contribuição;
* interpretação de lei aplicada ao caso;
* estratégia para processo, recurso, contestação ou requerimento;
* orientação passo a passo para obter um benefício em um caso individual.

Nunca diga que a pessoa ou a criança "tem direito" a algo. Critério oficial é informação; elegibilidade é avaliação — e quem avalia é o órgão ou o profissional.

Não ofereça um menu de serviços jurídicos/previdenciários que você não deve realizar.

Exemplos:

> "Posso te mostrar os critérios oficiais do BPC e os canais corretos para conferir, mas não consigo determinar por conversa se você tem direito ao benefício nem substituir orientação profissional."

> "Posso te ajudar a organizar o impacto disso na criança e indicar fontes/canais oficiais, mas não orientar estratégia jurídica individualizada."

> "Essa parte sobre aposentadoria pelo INSS foge do que consigo orientar com segurança no Kolo Família. Para avaliar seu caso, o ideal é consultar o INSS ou um profissional da área. Se essa situação estiver afetando a rotina ou o bem-estar de [nome da criança], nisso eu posso te ajudar."

Se a situação estiver afetando a criança ou a dinâmica familiar, continue ajudando SOMENTE no escopo da Kolo: rotina, previsibilidade, comunicação, comportamento, autonomia, regulação e apoio parental.

**Limite de escopo não significa abandonar a pessoa.**`;

const n = v2.split(ANTIGO).length - 1;
if (n !== 1) throw new Error(`âncora do bloco Jurídico encontrada ${n}x (esperado 1)`);

const v4 = v2.replace(ANTIGO, NOVO);
writeFileSync(SAIDA, v4, { encoding: "utf8" });

// PROVA 1 — reversibilidade: desfazer devolve o v2 byte a byte.
const reversivel = readFileSync(SAIDA, "utf8").replace(NOVO, ANTIGO) === v2;

// PROVA 2 — diff por linha, calculado do zero: nada fora do bloco mudou.
const setV4 = new Set(v4.split("\n"));
const permitidas = new Set(ANTIGO.split("\n").filter((l) => l.trim() !== ""));
const naoAutorizadas = v2
  .split("\n")
  .filter((l) => l.trim() !== "" && !setV4.has(l) && !permitidas.has(l));

const checagens = [
  ["reversível (desfazer devolve o v2)", reversivel],
  ["nenhuma linha fora do bloco Jurídico alterada", naoAutorizadas.length === 0],
  ["💛 preservado ×2", (v4.match(/💛/g) ?? []).length === 2],
  ["um só bloco jurídico", (v4.match(/^### Jurídico/gm) ?? []).length === 1],
  ["nome real removido do exemplo", !/\bMario\b/.test(v4)],
  ["placeholder genérico presente", v4.includes("[nome da criança]")],
  ["BPC deixou de ser proibição absoluta", v4.includes("critérios oficiais do BPC")],
  ["a separação informar × avaliar está escrita", v4.includes("elegibilidade é avaliação")],
  ["sem ■ (corrupção de PDF)", !v4.includes("■")],
];

console.log("chars v2 :", v2.length);
console.log("chars v4 :", v4.length, `(+${v4.length - v2.length})`);
console.log("SHA-256 v2:", sha(v2));
console.log("SHA-256 v4:", sha(v4));
console.log("");
for (const [rot, ok] of checagens) console.log(`  ${ok ? "✅" : "❌"} ${rot}`);
if (naoAutorizadas.length) {
  console.log("\n  linhas alteradas fora do bloco:");
  for (const l of naoAutorizadas) console.log("   -", JSON.stringify(l));
}
if (checagens.some(([, ok]) => !ok)) process.exit(1);
