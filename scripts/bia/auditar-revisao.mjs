#!/usr/bin/env node
/**
 * AUDITORIA DOS CHUNKS EM `revisao_pendente` — leitura, nada mais.
 *
 * Não altera o conteúdo de chunk nenhum. Lê o corpus JSON e o acervo real de
 * Boas Práticas (o relatório da importação, que tem os 368 textos) e responde:
 * quanto há, de que tipo, em que domínio, quanto disso é encaminhamento ou
 * regra operacional, e onde há tensão com o que a Ayla já diz hoje.
 *
 * Por que isso importa: esses 298 são ~27% do acervo e o retriever NUNCA os
 * devolve. Revisar tudo é caro; revisar na ordem errada é caro e inútil. A
 * saída daqui é a fila de trabalho.
 *
 * USO
 *   node scripts/bia/auditar-revisao.mjs --corpus bia.json
 *   node scripts/bia/auditar-revisao.mjs --corpus bia.json --amostra 5
 */

import { readFileSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const LIB = join(RAIZ, "apps/web/src/lib/bia");

const args = (() => {
  const o = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    if (a[i + 1] && !a[i + 1].startsWith("--")) (o[k] = a[++i]);
    else o[k] = true;
  }
  return o;
})();

if (!args.corpus) {
  console.error("Falta --corpus bia.json");
  process.exit(1);
}

// ---------- módulos do app, sem duplicar lógica ----------
const require = createRequire(import.meta.url);
const ts = require("typescript");
const dir = mkdtempSync(join(tmpdir(), "bia-audit-"));
for (const n of ["tipos", "pontuacao", "conflitos"]) {
  const js = ts.transpileModule(readFileSync(join(LIB, `${n}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  writeFileSync(join(dir, `${n}.mjs`), js.replace(/from\s+"\.\/([a-z-]+)"/g, 'from "./$1.mjs"'));
}
const url = (n) => pathToFileURL(join(dir, `${n}.mjs`)).href;
const { BIA_NUCLEO_PARA_DOMINIOS, BIA_NUCLEO_LABEL } = await import(url("tipos"));
const { detectarConflitos, TENSOES } = await import(url("conflitos"));

// ---------- corpus ----------
const todos = JSON.parse(readFileSync(String(args.corpus), "utf8"));
const pendentes = todos.filter((c) => c.revisao_pendente);

// ---------- Boas Práticas reais ----------
/** O relatório `-live.json` mais recente da importação carrega os 368 textos. */
function carregarBoasPraticas() {
  const pasta = join(RAIZ, "apps/web/scripts/reports");
  if (!existsSync(pasta)) return [];
  const { readdirSync } = require("node:fs");
  const arq = readdirSync(pasta)
    .filter((f) => f.endsWith("-live.json"))
    .sort()
    .at(-1);
  if (!arq) return [];
  const j = JSON.parse(readFileSync(join(pasta, arq), "utf8"));
  return (j.rows ?? []).map((r) => ({
    codigo: r.codigo_externo,
    skill: r.skill ?? r.skill_slug ?? null,
    texto: [r.titulo, r.texto_original, r.versao_curta].filter(Boolean).join(" "),
  }));
}
const bps = carregarBoasPraticas();

// ---------- contagens ----------
function contar(lista, chave) {
  const m = new Map();
  for (const x of lista) {
    for (const k of [].concat(chave(x))) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function tabela(titulo, pares, total) {
  console.log(`\n### ${titulo}\n`);
  const largura = Math.max(...pares.map(([k]) => String(k).length), 8);
  for (const [k, n] of pares) {
    const pct = total ? ` ${((n / total) * 100).toFixed(1).padStart(5)}%` : "";
    console.log(`  ${String(k).padEnd(largura)}  ${String(n).padStart(4)}${pct}`);
  }
}

console.log(`# Auditoria — chunks em revisao_pendente\n`);
console.log(`Corpus:      ${todos.length}`);
console.log(`Pendentes:   ${pendentes.length}  (${((pendentes.length / todos.length) * 100).toFixed(1)}%)`);
console.log(`Recuperáveis: ${todos.length - pendentes.length}`);
console.log(`Boas Práticas carregadas: ${bps.length}`);

// --- por domínio ---
const porDominio = contar(pendentes, (c) => {
  const ds = BIA_NUCLEO_PARA_DOMINIOS[c.nucleo] ?? [];
  return ds.length ? [...ds] : ["(sem domínio mapeado)"];
});
tabela("Por domínio do Kolo Vivo (um chunk pode servir a mais de um)", porDominio, pendentes.length);

const porNucleo = contar(pendentes, (c) => c.nucleo);
tabela(
  "Por núcleo da BIA",
  porNucleo.map(([k, n]) => [`${k} — ${BIA_NUCLEO_LABEL[k] ?? "?"}`, n]),
  pendentes.length,
);

// --- por tipo ---
const porTipo = contar(pendentes, (c) => c.tipo_conhecimento);
tabela("Por tipo de conhecimento", porTipo, pendentes.length);

// --- motivo da marcação ---
const porMotivo = contar(pendentes, (c) => c.revisao_motivo ?? "(sem motivo)");
tabela("Por motivo da marcação", porMotivo, pendentes.length);

// --- destaques pedidos ---
const encaminhamentos = pendentes.filter((c) =>
  ["encaminhamento", "sinal_de_alerta"].includes(c.tipo_conhecimento),
);
const regras = pendentes.filter((c) => c.tipo_conhecimento === "regra_operacional");
const mudamConduta = pendentes.filter((c) => c.muda_conduta === true);
const cautelaAlta = pendentes.filter((c) =>
  ["alto", "muito_alto"].includes(c.nivel_de_cautela),
);

console.log(`\n### Destaques\n`);
console.log(`  encaminhamento + sinal_de_alerta   ${String(encaminhamentos.length).padStart(4)}`);
console.log(`  regra_operacional                  ${String(regras.length).padStart(4)}`);
console.log(`  muda_conduta = true                ${String(mudamConduta.length).padStart(4)}`);
console.log(`  cautela alta/muito alta            ${String(cautelaAlta.length).padStart(4)}`);

// --- conflitos com Boas Práticas ---
// Roda o MESMO detector da integração, chunk a chunk, contra o acervo real.
const conflitos = [];
for (const c of pendentes) {
  const achados = detectarConflitos({
    textosBia: [c.texto_original],
    textosBoasPraticas: bps.map((b) => b.texto),
  });
  for (const a of achados) {
    conflitos.push({ chunk: c, tema: a.tema });
  }
}
const porTema = contar(conflitos, (x) => x.tema);

console.log(`\n### Conflitos potenciais com Boas Práticas\n`);
console.log(`  chunks pendentes com tensão detectada: ${new Set(conflitos.map((x) => x.chunk.hash)).size}`);
console.log(`  temas conhecidos no detector: ${TENSOES.map((t) => t.tema).join(", ")}`);
if (porTema.length) tabela("Por tema", porTema, null);

// Quanto do MESMO tema já está ativo (esses sim a Ayla lê hoje).
const ativosComTensao = todos
  .filter((c) => !c.revisao_pendente)
  .filter(
    (c) =>
      detectarConflitos({
        textosBia: [c.texto_original],
        textosBoasPraticas: bps.map((b) => b.texto),
      }).length > 0,
  );
console.log(`\n  para comparação, chunks JÁ ATIVOS com a mesma tensão: ${ativosComTensao.length}`);

if (args.amostra) {
  const n = Number(args.amostra);
  console.log(`\n### Amostra de ${n} pendentes com conflito\n`);
  for (const x of conflitos.slice(0, n)) {
    console.log(`  [${x.tema}] ${x.chunk.nucleo} · ${x.chunk.tipo_conhecimento}`);
    console.log(`    ${x.chunk.texto_original.replace(/\s+/g, " ").slice(0, 220)}…\n`);
  }
}

// --- ordem recomendada ---
/**
 * A fila. O critério é RISCO × ALCANCE, não volume:
 *   1. o que pode fazer mal se estiver errado (segurança, conflito, cautela alta)
 *   2. o que muda o que a mãe faz (muda_conduta, regra operacional)
 *   3. o que cobre buraco de domínio (onde o acervo ativo é mais magro)
 *   4. o volume que sobra
 */
const ativosPorDominio = new Map(
  contar(
    todos.filter((c) => !c.revisao_pendente),
    (c) => [...(BIA_NUCLEO_PARA_DOMINIOS[c.nucleo] ?? [])],
  ),
);

const magros = porDominio
  .map(([d, n]) => ({ dominio: d, pendentes: n, ativos: ativosPorDominio.get(d) ?? 0 }))
  .sort((a, b) => a.ativos - b.ativos)
  .slice(0, 5);

console.log(`\n### Ordem recomendada de revisão\n`);
const idsConflito = new Set(conflitos.map((x) => x.chunk.hash));
const lote1 = pendentes.filter(
  (c) =>
    ["encaminhamento", "sinal_de_alerta"].includes(c.tipo_conhecimento) ||
    idsConflito.has(c.hash) ||
    ["alto", "muito_alto"].includes(c.nivel_de_cautela),
);
const lote2 = pendentes.filter(
  (c) => !lote1.includes(c) && (c.muda_conduta === true || c.tipo_conhecimento === "regra_operacional"),
);
const dominiosMagros = new Set(magros.map((m) => m.dominio));
const lote3 = pendentes.filter(
  (c) =>
    !lote1.includes(c) &&
    !lote2.includes(c) &&
    (BIA_NUCLEO_PARA_DOMINIOS[c.nucleo] ?? []).some((d) => dominiosMagros.has(d)),
);
const lote4 = pendentes.filter(
  (c) => !lote1.includes(c) && !lote2.includes(c) && !lote3.includes(c),
);

console.log(`  1. SEGURANÇA E CONFLITO        ${String(lote1.length).padStart(4)} chunks`);
console.log(`     encaminhamento, sinal de alerta, cautela alta, tensão com Boa Prática`);
console.log(`  2. MUDA O QUE A MÃE FAZ        ${String(lote2.length).padStart(4)} chunks`);
console.log(`     muda_conduta = true e regra operacional`);
console.log(`  3. DOMÍNIO COM ACERVO MAGRO    ${String(lote3.length).padStart(4)} chunks`);
console.log(`     ${magros.map((m) => `${m.dominio} (${m.ativos} ativos)`).join(", ")}`);
console.log(`  4. RESTO                       ${String(lote4.length).padStart(4)} chunks`);
console.log(`\n  Soma: ${lote1.length + lote2.length + lote3.length + lote4.length} / ${pendentes.length}\n`);
