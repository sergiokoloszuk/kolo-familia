/**
 * CORE v7 — a secao de Boas Praticas do v6 SUBSTITUIDA pelo texto completo.
 *
 * Nao acrescentada: substituida. Duas secoes sobre o mesmo elemento no mesmo
 * system e o defeito que `formatacao-system.test.ts` documenta — o modelo
 * obedece a primeira e a segunda vira texto morto que ninguem percebe.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = readFileSync("docs/documentos-ayla/core-ayla-v6.md", "utf8");

const VELHA = `# BOAS PRÁTICAS SÃO REPERTÓRIO, NÃO LIMITE

Preserve a recuperação seletiva das Boas Práticas, brincadeiras, atividades, orientações e frases já existentes na Kolo quando forem relevantes. Elas podem ser usadas, adaptadas, combinadas ou servir de inspiração.

Você continua podendo raciocinar e criar orientações compatíveis com a base autorizada por este Core — neurodesenvolvimento, neuropsicologia, psicologia positiva, parentalidade, desenvolvimento infantil, funções executivas, regulação emocional, processamento sensorial, comunicação, autonomia, aprendizagem, vínculo, ludicidade e BNCC quando aplicável.

Não limite a resposta ao conteúdo recuperado e não force uma Boa Prática quando ela não for adequada àquela criança.

`;

const NOVA = `# BOAS PRÁTICAS SÃO REPERTÓRIO, NÃO LIMITE

Recupere Boas Práticas relevantes quando houver aderência clara ao assunto do turno.

As Boas Práticas são repertório curado adicional, não a única fonte de orientação.

Você deve poder combinar:

- este Core;
- o contexto real da criança;
- memória e aprendizados;
- o conhecimento geral permitido por este Core;
- Boas Práticas relevantes;
- brincadeiras, atividades, frases e estratégias do acervo Kolo quando úteis.

Você pode usar, adaptar, combinar ou se inspirar nas Boas Práticas.

Você não deve:

- copiar mecanicamente;
- limitar a resposta ao que foi recuperado;
- forçar uma Boa Prática inadequada;
- repetir repertório recente sem necessidade.

A personalização para idade, desenvolvimento, comunicação, compreensão, interesses, sensibilidades e situação atual prevalece sobre a aplicação literal do acervo.

`;

const n = base.split(VELHA).length - 1;
if (n !== 1) throw new Error(`secao do v6 encontrada ${n}x (esperado 1)`);
const v7 = base.replace(VELHA, NOVA);
writeFileSync("docs/documentos-ayla/core-ayla-v7.md", v7, "utf8");

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const semSecao = (t) => t.replace(t.includes(NOVA) ? NOVA : VELHA, "");
const ck = [
  ["reversivel (desfazer devolve o v6)", v7.replace(NOVA, VELHA) === base],
  ["texto da Karina verbatim", v7.includes(NOVA.trimEnd())],
  ["UMA secao de Boas Praticas, nao duas", (v7.match(/^# BOAS PRÁTICAS/gm) ?? []).length === 1],
  ["a secao antiga saiu", !v7.includes("Preserve a recuperação seletiva")],
  ["o resto do v6 sobreviveu", semSecao(base).split("\n").every((l) => v7.includes(l))],
  ["antes da Regra de Ouro", v7.indexOf("# BOAS PRÁTICAS") < v7.indexOf("# REGRA DE OURO")],
  ["Regra de Ouro ainda e o fecho", v7.trimEnd().endsWith(base.trimEnd().slice(-80))],
];
console.log("v6:", base.length, "-> v7:", v7.length, `(${v7.length - base.length >= 0 ? "+" : ""}${v7.length - base.length})`);
console.log("SHA v7:", sha(v7));
for (const [r, o] of ck) console.log(` ${o ? "OK " : "FALHOU "} ${r}`);
if (ck.some(([, o]) => !o)) process.exit(1);
