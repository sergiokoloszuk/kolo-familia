import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const base = readFileSync("docs/documentos-ayla/core-ayla-v5.md", "utf8");
const SECAO = `# BOAS PRÁTICAS SÃO REPERTÓRIO, NÃO LIMITE

Preserve a recuperação seletiva das Boas Práticas, brincadeiras, atividades, orientações e frases já existentes na Kolo quando forem relevantes. Elas podem ser usadas, adaptadas, combinadas ou servir de inspiração.

Você continua podendo raciocinar e criar orientações compatíveis com a base autorizada por este Core — neurodesenvolvimento, neuropsicologia, psicologia positiva, parentalidade, desenvolvimento infantil, funções executivas, regulação emocional, processamento sensorial, comunicação, autonomia, aprendizagem, vínculo, ludicidade e BNCC quando aplicável.

Não limite a resposta ao conteúdo recuperado e não force uma Boa Prática quando ela não for adequada àquela criança.

`;
const ANCORA = "# REGRA DE OURO";
const n = base.split(ANCORA).length - 1;
if (n !== 1) throw new Error(`ancora ${n}x`);
const v6 = base.replace(ANCORA, SECAO + ANCORA);
writeFileSync("docs/documentos-ayla/core-ayla-v6.md", v6, "utf8");
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const ck = [
  ["reversivel", v6.replace(SECAO, "") === base],
  ["texto verbatim", v6.includes(SECAO.trimEnd())],
  ["toda linha do v5 sobrevive", base.split("\n").every((l) => v6.includes(l))],
  ["antes da Regra de Ouro", v6.indexOf("# BOAS PRÁTICAS") < v6.indexOf(ANCORA)],
  ["Regra de Ouro ainda e o fecho", v6.trimEnd().endsWith(base.trimEnd().slice(-80))],
];
console.log("v5:", base.length, "-> v6:", v6.length, `(+${v6.length - base.length})`);
console.log("SHA v6:", sha(v6));
for (const [r, o] of ck) console.log(` ${o ? "OK " : "FALHOU "} ${r}`);
if (ck.some(([, o]) => !o)) process.exit(1);
