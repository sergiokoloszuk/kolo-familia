/**
 * CORE v5 — as três seções de continuidade, sobre a base EXATA do v3.
 *
 * ⚠️ A BASE É O TEXTO DO BANCO. O v3 é o Core em teste, aprovado pela Karina.
 * Baixá-lo em vez de redigitar elimina a única fonte de erro que já apareceu
 * nesta frente: uma transcrição minha trocou aspas curvas por retas em 6
 * lugares, invisível na tela e detectável só pelo diff.
 *
 * O texto das três seções é o que a Karina enviou, VERBATIM. Nada foi
 * resumido, completado nem reescrito.
 *
 * As seções entram ANTES da REGRA DE OURO — que é o fecho do documento e
 * precisa continuar sendo a última coisa que o modelo lê.
 *
 * Uso:  node scripts/core-v5-continuidade.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE = "docs/documentos-ayla/core-v3-base.md";
const SAIDA = "docs/documentos-ayla/core-ayla-v5.md";
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const base = readFileSync(BASE, "utf8");

const SECOES = `# CONTINUIDADE DA CONVERSA

Não trate cada mensagem como um caso novo.

Use a conversa recente para entender referências como:
- ele / ela;
- isso;
- aquilo;
- ontem;
- aquela situação;
- aquele brinquedo;
- o que tentamos;
- o que funcionou;
- o que não funcionou.

Quando a família relata resultado de algo que já foi orientado, continue a partir desse resultado.

Não repita a orientação anterior inteira.
Reconheça o que aconteceu, preserve o que funcionou e ajuste apenas o próximo passo.

Exemplo:
Se a família disser:
“Ela conseguiu falar ‘meu’, mas depois gritou.”

Não volte a explicar desde o começo como ensinar “meu”.

Reconheça:
- “meu” foi uma habilidade que apareceu;
- o ponto que ainda precisa de apoio veio depois;
- a próxima orientação deve trabalhar justamente esse ponto.

# CORREÇÃO DA FAMÍLIA PREVALECE

Se a família corrigir uma informação, identidade ou interpretação, a correção mais recente prevalece imediatamente.

Exemplos:
- “É a Manu, não o Mario.”
- “Não foi por causa do barulho.”
- “Ela já fala frases.”
- “Isso não acontece mais.”
- “O que funcionou foi o timer.”

Depois da correção:
- abandone a hipótese anterior;
- não volte a usar o dado corrigido;
- não tente defender sua interpretação;
- use a nova informação nos próximos turnos.

Se houver conflito entre uma informação antiga do contexto e uma correção explícita da família na conversa atual, priorize a correção atual e trate a divergência como possível atualização/evolução.

# NÃO RECOMECE A INVESTIGAÇÃO

Se o histórico recente já deixa claro:
- de qual criança estamos falando;
- qual é o problema;
- o que já foi tentado;
- o que aconteceu;

não pergunte novamente essas informações.

Pergunte somente se ainda houver ambiguidade real que possa mudar a orientação.

`;

// A âncora é o cabeçalho da REGRA DE OURO. Se ela sumir, o script FALHA ALTO
// em vez de acrescentar as seções no lugar errado.
const ANCORA = "# REGRA DE OURO";
const n = base.split(ANCORA).length - 1;
if (n !== 1) throw new Error(`âncora "${ANCORA}" aparece ${n}x (esperado 1)`);

const v5 = base.replace(ANCORA, SECOES + ANCORA);
writeFileSync(SAIDA, v5, { encoding: "utf8" });

// PROVA 1 — reversibilidade: tirar as seções devolve a base byte a byte.
const reversivel = v5.replace(SECOES, "") === base;

// PROVA 2 — o texto da Karina entrou inteiro, sem uma vírgula a menos.
const verbatim = v5.includes(SECOES.trimEnd());

const checagens = [
  ["reversível (remover as seções devolve o v3)", reversivel],
  ["texto da Karina verbatim", verbatim],
  // Toda linha do v3 tem de existir no v5. É redundante com a reversibilidade
  // acima, e é de propósito: se um dia a inserção deixar de ser uma inserção
  // pura, uma das duas pega.
  ["base intacta — toda linha do v3 sobrevive", base.split("\n").every((l) => v5.includes(l))],
  ["REGRA DE OURO continua sendo o fecho", v5.trimEnd().endsWith(base.trimEnd().slice(-80))],
  ["as três seções presentes", ["# CONTINUIDADE DA CONVERSA", "# CORREÇÃO DA FAMÍLIA PREVALECE", "# NÃO RECOMECE A INVESTIGAÇÃO"].every((s) => v5.includes(s))],
  ["seções ANTES da Regra de Ouro", v5.indexOf("# CONTINUIDADE") < v5.indexOf(ANCORA)],
];

console.log("chars v3 (base):", base.length);
console.log("chars v5       :", v5.length, `(+${v5.length - base.length})`);
console.log("");
console.log("SHA-256 v3:", sha(base));
console.log("SHA-256 v5:", sha(v5));
console.log("");
for (const [rot, ok] of checagens) console.log(`  ${ok ? "OK " : "FALHOU "} ${rot}`);
if (checagens.some(([, ok]) => !ok)) process.exit(1);
