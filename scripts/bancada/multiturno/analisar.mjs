/**
 * Agrega a bancada multiturno. Não chama modelo — só lê `resultados.json`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const { respostas: R, falhas } = JSON.parse(readFileSync(resolve(AQUI, "resultados.json"), "utf8"));
const { JORNADAS } = await import(new URL("./jornadas.mjs", import.meta.url).href);

const med = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a) => (a.length ? (100 * a.filter(Boolean).length) / a.length : 0);
const quantil = (a, q) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const filtra = (f) => R.filter(f);
const sinal = (rs, k) => pct(rs.map((r) => r.sinais.includes(k)));

function bloco(rotulo, rs) {
  const por = (b) => rs.filter((r) => r.braco === b);
  const l = (nome, fn, casas = 1) =>
    `${nome.padEnd(26)} ${fn(por("claude")).toFixed(casas).padStart(8)} ${fn(por("gpt")).toFixed(casas).padStart(8)}`;
  console.log(`\n── ${rotulo} ${"─".repeat(Math.max(0, 44 - rotulo.length))}`);
  console.log(`${"".padEnd(26)} ${"CLAUDE".padStart(8)} ${"GPT".padStart(8)}`);
  console.log(l("palavras/resposta", (x) => med(x.map((r) => r.palavras)), 0));
  console.log(l("perguntas/resposta", (x) => med(x.map((r) => r.perguntas)), 2));
  console.log(l("% termina c/ pergunta", (x) => sinal(x, "pergunta_final")));
  console.log(l("% 3+ perguntas seguidas", (x) => sinal(x, "tres_perguntas")));
  console.log(l("% 'me conta mais'", (x) => sinal(x, "me_conta_mais")));
  console.log(l("% acolhimento fórmula", (x) => sinal(x, "acolhimento_formula")));
  console.log(l("% observe e volte", (x) => sinal(x, "observe_e_volte")));
  console.log(l("% recita perfil", (x) => sinal(x, "recita_perfil")));
  console.log(l("% repetição literal", (x) => sinal(x, "repeticao_literal")));
  console.log(l("latência média (s)", (x) => med(x.map((r) => r.ms)) / 1000, 1));
  console.log(l("latência p50 (s)", (x) => quantil(x.map((r) => r.ms), 0.5) / 1000, 1));
  console.log(l("latência p95 (s)", (x) => quantil(x.map((r) => r.ms), 0.95) / 1000, 1));
  console.log(l("tokens in (média)", (x) => med(x.map((r) => r.tokensIn)), 0));
  console.log(l("tokens out (média)", (x) => med(x.map((r) => r.tokensOut)), 0));
  console.log(l("custo/resposta (US$)", (x) => med(x.map((r) => r.custo)), 6));
  console.log(l("custo/1.000 (US$)", (x) => med(x.map((r) => r.custo)) * 1000, 2));
  console.log(l("fronteira disparou %", (x) => pct(x.map((r) => r.fronteira))));
}

console.log("═".repeat(62));
console.log(`BANCADA MULTITURNO · ${R.length} respostas · ${falhas.length} falha(s)`);
console.log("═".repeat(62));

bloco("AGREGADO", R);
bloco("WHATSAPP", filtra((r) => r.canal === "whatsapp"));
bloco("ESTRATÉGIAS (web)", filtra((r) => r.canal === "web"));
for (const j of JORNADAS) bloco(j.titulo, filtra((r) => r.jornada === j.id));

console.log("\n── CONSISTÊNCIA entre rodadas ".padEnd(48, "─"));
console.log(`${"".padEnd(26)} ${"CLAUDE".padStart(8)} ${"GPT".padStart(8)}`);
for (const nome of ["palavras", "perguntas"]) {
  const linha = ["claude", "gpt"].map((b) => {
    const porRodada = [1, 2, 3].map((n) => med(filtra((r) => r.braco === b && r.rodada === n).map((r) => r[nome])));
    const v = porRodada.filter((x) => x > 0);
    return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
  });
  console.log(`${`amplitude ${nome}`.padEnd(26)} ${linha[0].toFixed(2).padStart(8)} ${linha[1].toFixed(2).padStart(8)}`);
}

console.log("\n── J3 · CONTAMINAÇÃO ENTRE CRIANÇAS ".padEnd(48, "─"));
for (const b of ["claude", "gpt"]) {
  const pos = filtra((r) => r.jornada === "j3_troca_de_crianca" && r.braco === b && r.turno >= 3);
  const cont = pos.filter((r) => r.contaminacao);
  console.log(`  ${b.padEnd(8)} ${cont.length}/${pos.length} respostas pós-troca com traço do Yuri`);
  for (const c of cont.slice(0, 4)) console.log(`      r${c.rodada} ${c.canal} t${c.turno}: ${c.contaminacao}`);
}

console.log("\n── SEGURANÇA (detector real, não alterado) ".padEnd(48, "─"));
for (const b of ["claude", "gpt"]) {
  const d = filtra((r) => r.braco === b && r.fronteira);
  console.log(`  ${b.padEnd(8)} ${d.length}/${filtra((r) => r.braco === b).length} disparos`);
  for (const x of d) console.log(`      r${x.rodada} ${x.canal} ${x.jornada} t${x.turno} → ${x.fronteira}`);
}

const totalCusto = (b) => filtra((r) => r.braco === b).reduce((a, r) => a + r.custo, 0);
console.log(`\n── CUSTO TOTAL DAS 3 RODADAS ${"─".repeat(20)}`);
console.log(`  claude  US$ ${totalCusto("claude").toFixed(4)}`);
console.log(`  gpt     US$ ${totalCusto("gpt").toFixed(4)}`);

writeFileSync(
  resolve(AQUI, "agregado.json"),
  JSON.stringify({ respostas: R.length, falhas: falhas.length }, null, 2),
);
