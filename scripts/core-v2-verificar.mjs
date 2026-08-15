/**
 * PROVA INDEPENDENTE: o v2 só difere do v1 nas regiões autorizadas.
 *
 * ⚠️ NÃO REUSA A LÓGICA DO GERADOR. O gerador prova reversibilidade com as
 * próprias substituições que aplicou — se ele estivesse errado, provaria o
 * próprio erro. Aqui a verificação é por DIFF de linhas, calculado do zero, e
 * a lista de linhas que podem mudar é declarada explicitamente.
 *
 * Sai com código 1 se alguma linha não autorizada tiver sido alterada.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const v1 = readFileSync("docs/documentos-ayla/core-ayla-v1.md", "utf8").split("\n");
const v2 = readFileSync("docs/documentos-ayla/core-ayla-v2.md", "utf8").split("\n");
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** As ÚNICAS linhas do v1 que a missão autorizou alterar. */
const AUTORIZADAS = new Set([
  "# 16. PLANO E SEQUÊNCIA VISUAL",
  "Você pode reconhecer quando um Plano Kolo ou uma Sequência Visual poderia ajudar.",
  '> "Como essa situação acontece em etapas previsíveis, uma sequência visual pode ajudar."',
  "Mas só prometa gerar um Plano, imagem, PDF ou sequência se essa capacidade estiver realmente disponível no sistema.",
  "# 17. EMOJIS",
  "# 18. ESTILO",
  "# 19. RITMO",
]);

/** LCS por linha — o diff de verdade, sem depender do gerador. */
function lcs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(["=", a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["-", a[i]]); i++; }
    else { ops.push(["+", b[j]]); j++; }
  }
  while (i < n) ops.push(["-", a[i++]]);
  while (j < m) ops.push(["+", b[j++]]);
  return ops;
}

const ops = lcs(v1, v2);
const removidas = ops.filter((o) => o[0] === "-").map((o) => o[1]);
const acrescentadas = ops.filter((o) => o[0] === "+").map((o) => o[1]);
const iguais = ops.filter((o) => o[0] === "=").length;

console.log("linhas v1:", v1.length, "| linhas v2:", v2.length);
console.log("linhas IDÊNTICAS preservadas:", iguais);
console.log("linhas removidas do v1:", removidas.length);
console.log("linhas acrescentadas no v2:", acrescentadas.length);
console.log("");

const naoAutorizadas = removidas.filter((l) => l.trim() !== "" && !AUTORIZADAS.has(l));
if (naoAutorizadas.length) {
  console.log("❌ LINHAS DO v1 ALTERADAS SEM AUTORIZAÇÃO:");
  for (const l of naoAutorizadas) console.log("   -", JSON.stringify(l));
  process.exit(1);
}
console.log("✅ nenhuma linha do v1 fora das regiões autorizadas foi alterada");
console.log("   (removidas e autorizadas:", removidas.filter((l) => l.trim() !== "").length + ")");

// Emojis: têm de sobreviver, e nas mesmas frases.
const emo = (arr) => arr.filter((l) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l));
const e1 = emo(v1), e2 = emo(v2);
console.log("");
console.log("emojis no v1:", e1.length, "| no v2:", e2.length);
const emojiOk = e1.length === e2.length && e1.every((l, k) => l === e2[k]);
console.log(emojiOk ? "✅ emojis preservados byte a byte" : "❌ EMOJI ALTERADO");
for (const l of e2) console.log("   ", JSON.stringify(l.slice(0, 74)));
if (!emojiOk) process.exit(1);

// Nenhum resquício de extração de PDF.
const lixo = v2.filter((l) => l.includes("■"));
console.log("");
console.log(lixo.length === 0 ? "✅ nenhum caractere corrompido de PDF (■)" : "❌ ENCONTRADO ■");
if (lixo.length) process.exit(1);

console.log("");
console.log("SHA-256 v1:", sha(v1.join("\n")));
console.log("SHA-256 v2:", sha(v2.join("\n")));
