/**
 * A DECISÃO DE AGIR, RELIDA DE UM BRUTO JÁ GRAVADO.
 *
 *     node scripts/bancada/f1-f20/analisar-feature.mjs [resultados/bruto-direcional.json]
 *
 * ⚠️ EXISTE PARA NÃO REPETIR A CORRIDA QUANDO A ANÁLISE MUDA. A métrica fiel à
 * porta do orquestrador (`agiriaNaFeature`) foi acrescentada DEPOIS que os 360
 * turnos já estavam gravados. Repetir 460 chamadas para recalcular um booleano
 * sobre dados que já existem seria gastar por nada — e trocar uma medição
 * completa por outra, perdendo a comparabilidade com a que gerou o achado.
 *
 * Sem rede. Só lê o JSON.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resumoFeature, classificar } from "./analise.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const arquivo = resolve(AQUI, process.argv[2] ?? "resultados/bruto-direcional.json");
const d = JSON.parse(readFileSync(arquivo, "utf8"));

const l = [];
l.push(`# Decisão de agir — ${arquivo.split(/[\/]/).pop()}\n`);
l.push(`Core v${d.coreVersao} (sha ${d.coreSha}) - ${d.quando}`);
l.push(`\n- **A** = ${d.bracos.A}`);
l.push(`- **B** = ${d.bracos.B}`);
l.push(`\nTurnos: ${d.turnos.length} - execucoes: ${d.execucoesCriticos}`);

const origens = {};
for (const t of d.turnos) origens[`${t.braco}:${t.decisao.origem}`] = (origens[`${t.braco}:${t.decisao.origem}`] ?? 0) + 1;
l.push(`\nOrigem das decisoes: ${JSON.stringify(origens)}`);

for (const [titulo, campoA, campoB] of [
  ["A — `pedidoExplicito`, o booleano que a Fase 1B introduziu", "aAgiria", "bAgiria"],
  ["B — porta real do orquestrador: intencao NO ponto de sequestro E pedidoExplicito", "aAgiriaNaFeature", "bAgiriaNaFeature"],
]) {
  l.push(`\n## ${titulo}\n`);
  l.push(`| Caso — turno | Esperado | A por exec | B por exec | Erros A | Erros B | Classificacao |`);
  l.push(`|---|---|---|---|---|---|---|`);
  for (const r of resumoFeature(d.turnos)) {
    const a = r.execucoes.map((p) => p[campoA]);
    const b = r.execucoes.map((p) => p[campoB]);
    const errs = (xs) => (r.esperado === null ? null : xs.map((v) => (v !== r.esperado ? 1 : 0)));
    const ea = errs(a), eb = errs(b);
    const m = (xs) => xs.map((v) => (v === null ? "?" : v ? "sim" : "nao")).join(",");
    const soma = (xs) => (xs ? `${xs.reduce((s, x) => s + x, 0)}/${xs.length}` : "-");
    const cls = r.esperado === null ? "observacao - sem gabarito" : classificar(ea, eb);
    l.push(`| ${r.caso} — "${r.mensagem.slice(0, 38)}" | ${r.esperado} | ${m(a)} | ${m(b)} | ${soma(ea)} | ${soma(eb)} | ${cls} |`);
  }
}

const conta = (br, campo, esp) =>
  resumoFeature(d.turnos).filter((r) => r.esperado === esp).flatMap((r) => r.execucoes.map((p) => p[campo])).filter(Boolean).length;
const total = (esp) => resumoFeature(d.turnos).filter((r) => r.esperado === esp).flatMap((r) => r.execucoes).length;
l.push(`\n## Agregado (porta real)\n`);
l.push(`| | Pedidos explicitos disparados | Turnos conversacionais sequestrados |`);
l.push(`|---|---|---|`);
l.push(`| A | ${conta("A", "aAgiriaNaFeature", true)}/${total(true)} | ${conta("A", "aAgiriaNaFeature", false)}/${total(false)} |`);
l.push(`| B | ${conta("B", "bAgiriaNaFeature", true)}/${total(true)} | ${conta("B", "bAgiriaNaFeature", false)}/${total(false)} |`);

console.log(l.join("\n"));
