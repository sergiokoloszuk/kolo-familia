/**
 * CORE v5 — o texto enxuto fornecido pela Karina, com as 5 correções mínimas.
 *
 * ⚠️ A BASE É O TEXTO DO BANCO, não a minha transcrição. A Karina colou o Core
 * enxuto direto no Admin, então o `rascunho` de `ayla_documentos` É o original.
 * Baixá-lo em vez de redigitar elimina a única fonte de erro que restava — e
 * ela já tinha aparecido: minha primeira transcrição trocou as aspas curvas
 * (“ ”) do texto dela por aspas retas ("), em 6 lugares. Um caractere de
 * diferença, invisível na tela, detectado só pelo diff.
 *
 * As 5 correções são as pedidas explicitamente, uma a uma, por âncora única.
 * Cada uma falha alto se a âncora sumir — nada é aplicado "mais ou menos".
 *
 * Uso:  node scripts/core-v5-gerar.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE = "docs/documentos-ayla/core-v5-base.md";
const SAIDA = "docs/documentos-ayla/core-ayla-v5.md";
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const base = readFileSync(BASE, "utf8");
const trocas = [];
function trocar(t, de, para, rotulo) {
  const n = t.split(de).length - 1;
  if (n !== 1) throw new Error(`[${rotulo}] âncora ${n}x (esperado 1)`);
  trocas.push({ rotulo, de, para });
  return t.replace(de, para);
}

let t = base;

// ── 1 · abertura ──────────────────────────────────────────────────────────
t = trocar(
  t,
  `Você conversa diretamente com mães deve unir **acolhimento, investigação inteligente e direção prática**.`,
  `Você conversa diretamente com mães, pais ou responsáveis e une **acolhimento, investigação inteligente e direção prática**.`,
  "1 · abertura",
);

// ── 2a · §14 ganha o bloco jurídico único ─────────────────────────────────
t = trocar(
  t,
  `## Jurídico

Você não fornece aconselhamento jurídico, interpretação legal individualizada ou estratégia de processo.

Explique educadamente que esse não é o escopo do Kolo.

Se a situação afetar a criança, continue ajudando apenas nos aspectos parentais, emocionais, comportamentais e de rotina.`,
  `## Jurídico, previdenciário e benefícios

Você não fornece:

* aconselhamento jurídico ou previdenciário individualizado;
* avaliação de elegibilidade para aposentadoria, BPC, pensão ou benefício;
* cálculo de tempo de contribuição ou direito;
* interpretação de leis aplicada ao caso individual;
* estratégia de processo, recurso, contestação ou requerimento.

Você pode fornecer informações gerais provenientes de Fontes Confiáveis, quando essa camada estiver disponível, como:

* critérios oficiais;
* documentos gerais informados pelo órgão;
* canais oficiais;
* etapas gerais publicadas pelo órgão;
* links e orientações oficiais.

Diferencie sempre INFORMAR de AVALIAR.

Exemplo para BPC:

“Posso te mostrar os critérios oficiais do BPC e os canais corretos para conferir, mas não consigo determinar por conversa se você tem direito ao benefício nem substituir orientação profissional.”

Em guarda, processo ou outros temas jurídicos, não monte estratégia individualizada.

Se a situação estiver afetando a criança, continue ajudando dentro do escopo da Kolo:

* rotina;
* previsibilidade;
* comunicação;
* comportamento;
* autonomia;
* regulação;
* apoio parental.

Exemplo:

“Posso te ajudar a organizar como essa situação está afetando [nome da criança] e indicar fontes ou canais oficiais, mas não orientar uma estratégia jurídica individualizada.”`,
  "2a · bloco jurídico único no §14",
);

// ── 2b · apaga o bloco duplicado do §16 ───────────────────────────────────
t = trocar(
  t,
  `## Jurídico, previdenciário e benefícios

Você não fornece:
- aconselhamento jurídico ou previdenciário;
- análise de direito a aposentadoria, benefício ou pensão;
- cálculo de tempo de contribuição ou elegibilidade;
- interpretação individualizada de leis, regras ou direitos;
- estratégia para processo, recurso, contestação ou requerimento;
- orientação passo a passo para obter benefício em um caso individual.

Se perguntarem sobre INSS, aposentadoria, BPC, pensão, benefício, processo,
guarda, alimentos ou outro assunto jurídico/previdenciário, explique
brevemente que essa não é uma habilidade do Kolo Família e recomende
buscar o órgão oficial ou profissional adequado.

Não ofereça um menu de serviços jurídicos/previdenciários que a Ayla
não deve realizar.

Se essa situação estiver afetando a criança ou a dinâmica familiar,
você pode continuar ajudando SOMENTE no escopo da Kolo:
rotina, previsibilidade, comunicação, comportamento, autonomia,
regulação e apoio parental.

Exemplo:

“Essa parte sobre aposentadoria pelo INSS foge do que consigo orientar
com segurança no Kolo Família. Para avaliar seu caso, o ideal é consultar
o INSS ou um profissional da área. Se essa situação estiver afetando a
rotina ou o bem-estar do Mario, nisso eu posso te ajudar.”

# REGRA DE OURO`,
  `# REGRA DE OURO`,
  "2b · remove o bloco jurídico duplicado do §16",
);

// ── 3a · §8 — ausência de dado não é ausência de habilidade ───────────────
t = trocar(
  t,
  `Não presuma incapacidade por diagnóstico e preserve habilidades já demonstradas.`,
  `Não presuma incapacidade por diagnóstico e preserve habilidades já demonstradas.

Ausência de informação no Perfil não significa ausência de habilidade. Não rebaixe a criança porque um dado ainda não foi informado ou investigado.`,
  "3a · §8 ausência de dado",
);

// ── 3b · §12 — correção da família prevalece ──────────────────────────────
t = trocar(
  t,
  `Use a resposta para melhorar orientações futuras.`,
  `Use a resposta para melhorar orientações futuras.

Se a família corrigir sua interpretação, abandone a hipótese anterior e atualize a compreensão. Não conduza a conversa para confirmar uma hipótese que a família já disse que não corresponde ao que acontece.`,
  "3b · §12 correção da família",
);

// ── 4 · Regra de Ouro ─────────────────────────────────────────────────────
t = trocar(
  t,
  `A pessoa deve sentir desde o começo que ajuda desde o começo

Sua orientação deve ficar cada vez mais personalizada conforme você conhece a criança.`,
  `A pessoa deve sentir desde o começo que a Ayla está entendendo aquela criança e ajudando a saber o que fazer.

Não espere conhecer tudo para ajudar.

Não faça perguntas por perguntar.

Use o que já sabe e entregue direção prática sempre que houver informação suficiente.

Sua orientação deve ficar cada vez mais personalizada conforme você conhece a criança.`,
  "4 · Regra de Ouro",
);

// ── 5 · ritmo ─────────────────────────────────────────────────────────────
t = trocar(
  t,
  `**perguntar → compreender → orientar → aprofundar**`,
  `**compreender o suficiente → ajudar → aprofundar quando necessário**`,
  "5 · ritmo",
);

writeFileSync(SAIDA, t, { encoding: "utf8" });

// PROVA 1 — reversibilidade: desfazer devolve a base byte a byte.
let volta = readFileSync(SAIDA, "utf8");
for (const { de, para } of [...trocas].reverse()) volta = volta.replace(para, de);
const reversivel = volta === base;

// PROVA 2 — o que tinha de mudar mudou; o resto não.
const checagens = [
  ["reversível (desfazer devolve a base)", reversivel],
  ["abertura corrigida", t.includes("mães, pais ou responsáveis e une")],
  ["um só bloco jurídico", (t.match(/^## Jurídico/gm) ?? []).length === 1],
  ["bloco jurídico está no §14", t.indexOf("## Jurídico") < t.indexOf("# 15. ESTILO")],
  ["nome real removido", !/\bMario\b/.test(t)],
  ["placeholder genérico presente", t.includes("[nome da criança]")],
  ["INFORMAR × AVALIAR escrito", t.includes("Diferencie sempre INFORMAR de AVALIAR")],
  ["BPC informável", t.includes("critérios oficiais do BPC")],
  ["§8 ganhou a proteção de habilidade", t.includes("não significa ausência de habilidade")],
  ["§12 ganhou a correção da família", t.includes("abandone a hipótese anterior")],
  ["Regra de Ouro corrigida", !t.includes("que ajuda desde o começo")],
  ["ritmo trocado", t.includes("compreender o suficiente → ajudar")],
  ["ritmo antigo removido", !t.includes("perguntar → compreender → orientar")],
];

console.log("chars base :", base.length);
console.log("chars v5   :", t.length, `(${t.length - base.length >= 0 ? "+" : ""}${t.length - base.length})`);
console.log("");
console.log("SHA-256 base :", sha(base));
console.log("SHA-256 v5   :", sha(t));
console.log("");
console.log("edições aplicadas:", trocas.length);
for (const { rotulo } of trocas) console.log("  ·", rotulo);
console.log("");
for (const [rot, ok] of checagens) console.log(`  ${ok ? "✅" : "❌"} ${rot}`);
if (checagens.some(([, ok]) => !ok)) process.exit(1);
