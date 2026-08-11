/**
 * OS DOIS SELETORES DO ROLLOUT — PROVADOS POR EXECUÇÃO, NÃO POR LEITURA.
 *
 * Antes de mexer numa variável da Vercel, é preciso saber o que cada valor faz.
 * Hoje isso é sabido por LEITURA do código: `IA_PROVIDER=openai` nunca rodou, e
 * `KOLO_PILOTO_4A` nunca esteve em `on` em ambiente nenhum. Ler o código diz o
 * que ele deveria fazer; só a execução diz o que ele faz.
 *
 * ⚠️ ZERO CHAMADA AO MODELO E ZERO FAMÍLIA REAL. Os dois seletores são funções
 * puras sobre `process.env` — dá para exercitá-los diretamente, com ids
 * sintéticos, sem tocar em rede, banco ou família. É a forma segura de provar,
 * e é por isso que ela vem ANTES de qualquer alteração de ambiente.
 *
 *   node scripts/bancada/piloto-4a/seletores-prova.mjs
 */
import { mod, linha } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { providerConversacionalParaFamilia } = await mod("lib/ia/provider.ts");
const { pilotoQuatroA, estadoPiloto4A } = await mod("lib/conducao/piloto.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const provas = [];
const prova = (nome, ok, det) => {
  provas.push({ nome, ok });
  w(`  ${ok ? "✓" : "✗"} ${nome}${det ? `   ${det}` : ""}`);
};

/** Ids que não existem e nunca existirão no banco. */
const DENTRO = "aaaaaaaa-4a4a-4a4a-4a4a-000000000001";
const FORA = "bbbbbbbb-4a4a-4a4a-4a4a-000000000002";
const QUALQUER = "99999999-9999-9999-9999-999999999999";

/** Ambiente limpo a cada caso — nenhum resíduo entre um cenário e o seguinte. */
function comAmbiente(vars, fn) {
  const antes = {};
  const chaves = ["IA_PROVIDER", "OPENAI_TEST_FAMILY_IDS", "KOLO_PILOTO_4A", "KOLO_PILOTO_4A_FAMILIAS"];
  for (const k of chaves) { antes[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try { return fn(); }
  finally {
    for (const k of chaves) {
      if (antes[k] === undefined) delete process.env[k];
      else process.env[k] = antes[k];
    }
  }
}

w(`${linha()}\nOS DOIS SELETORES — PROVA POR EXECUÇÃO (zero chamada, zero família real)\n${linha()}`);

// ── PROVA A · O PROVIDER CONVERSACIONAL ──────────────────────────────────
w(`\nPROVA A · GPT — quem responde\n`);
const provider = (env, id) =>
  comAmbiente(env, () => providerConversacionalParaFamilia(id));

prova("IA_PROVIDER=anthropic → anthropic, para quem estiver na lista ou fora",
  provider({ IA_PROVIDER: "anthropic", OPENAI_TEST_FAMILY_IDS: DENTRO }, DENTRO) === "anthropic" &&
  provider({ IA_PROVIDER: "anthropic" }, QUALQUER) === "anthropic",
  "a lista não vaza quando o modo é anthropic");

prova("IA_PROVIDER=openai_teste + id DENTRO → openai",
  provider({ IA_PROVIDER: "openai_teste", OPENAI_TEST_FAMILY_IDS: DENTRO }, DENTRO) === "openai");

prova("IA_PROVIDER=openai_teste + id FORA → anthropic",
  provider({ IA_PROVIDER: "openai_teste", OPENAI_TEST_FAMILY_IDS: DENTRO }, FORA) === "anthropic");

// ⚠️ ESTE É O CENÁRIO QUE NUNCA RODOU EM LUGAR NENHUM.
const abertos = [QUALQUER, FORA, DENTRO, "", null, undefined].map((id) =>
  provider({ IA_PROVIDER: "openai" }, id),
);
prova("IA_PROVIDER=openai → openai para QUALQUER id, e sem lista nenhuma",
  abertos.slice(0, 3).every((p) => p === "openai"),
  `com lista ausente: ${abertos.slice(0, 3).join(", ")}`);

// E o que acontece com id vazio/nulo sob `openai`? Importa: se caísse em
// anthropic, o rollout geral deixaria buracos silenciosos.
prova("IA_PROVIDER=openai → openai TAMBÉM sem id (vazio, null, undefined)",
  abertos.slice(3).every((p) => p === "openai"),
  `vazio/null/undefined: ${abertos.slice(3).join(", ")}`);

prova("grafia errada de IA_PROVIDER → anthropic (fail-closed)",
  provider({ IA_PROVIDER: "openai_ON" }, QUALQUER) === "anthropic" &&
  provider({ IA_PROVIDER: "OPENAI" }, QUALQUER) === "anthropic" &&
  provider({}, QUALQUER) === "anthropic",
  "'openai_ON', 'OPENAI' e ausente → todos anthropic");

// ── PROVA B · A INTELIGÊNCIA 4A ──────────────────────────────────────────
w(`\nPROVA B · 4A — com o que ela pensa\n`);
const quatroA = (env, id) => comAmbiente(env, () => pilotoQuatroA(id));

prova("KOLO_PILOTO_4A=off → ninguém, nem quem está na lista",
  quatroA({ KOLO_PILOTO_4A: "off", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, DENTRO) === false &&
  quatroA({ KOLO_PILOTO_4A: "off" }, QUALQUER) === false);

prova("KOLO_PILOTO_4A=teste + id DENTRO → true",
  quatroA({ KOLO_PILOTO_4A: "teste", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, DENTRO) === true);

prova("KOLO_PILOTO_4A=teste + id FORA → false",
  quatroA({ KOLO_PILOTO_4A: "teste", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, FORA) === false);

// ⚠️ O OUTRO CENÁRIO INÉDITO.
prova("KOLO_PILOTO_4A=on → true para QUALQUER id, e a lista deixa de importar",
  quatroA({ KOLO_PILOTO_4A: "on" }, QUALQUER) === true &&
  quatroA({ KOLO_PILOTO_4A: "on", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, FORA) === true,
  "inclusive para quem NÃO está na lista — é isto que 'para todos' significa");

// A armadilha que o rollout de três estados existe para evitar: sob `teste`,
// esvaziar a lista por engano promoveria todo mundo se a semântica fosse
// "ligado + lista que restringe".
prova("KOLO_PILOTO_4A=teste + lista VAZIA → ninguém (o acidente não promove)",
  quatroA({ KOLO_PILOTO_4A: "teste", KOLO_PILOTO_4A_FAMILIAS: "" }, QUALQUER) === false &&
  quatroA({ KOLO_PILOTO_4A: "teste" }, QUALQUER) === false);

prova("valor inválido → fail-closed (cai em off)",
  ["ON", "1", "true", "ligado", "teste ", "sim", ""].every(
    (v) => quatroA({ KOLO_PILOTO_4A: v, KOLO_PILOTO_4A_FAMILIAS: DENTRO }, DENTRO) === (v === "teste "),
  ),
  "só 'teste' e 'on' ligam; 'teste ' com espaço é tolerado, o resto cai em off");

prova("sob `on`, id ausente/vazio também recebe",
  quatroA({ KOLO_PILOTO_4A: "on" }, null) === true &&
  quatroA({ KOLO_PILOTO_4A: "on" }, "") === true);

prova("sob `teste`, id ausente/vazio NÃO recebe",
  quatroA({ KOLO_PILOTO_4A: "teste", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, null) === false &&
  quatroA({ KOLO_PILOTO_4A: "teste", KOLO_PILOTO_4A_FAMILIAS: DENTRO }, "") === false);

// ── PROVA C · OS DOIS SÃO INDEPENDENTES ──────────────────────────────────
//
// É a prova que sustenta os DOIS rollbacks separados: desligar um não pode
// mexer no outro, senão reverter o GPT levaria a 4A junto.
w(`\nPROVA C · INDEPENDÊNCIA — as quatro combinações\n`);
const combos = [
  ["GPT ON  + 4A OFF", { IA_PROVIDER: "openai", KOLO_PILOTO_4A: "off" }, "openai", false],
  ["GPT OFF + 4A ON ", { IA_PROVIDER: "anthropic", KOLO_PILOTO_4A: "on" }, "anthropic", true],
  ["GPT ON  + 4A ON ", { IA_PROVIDER: "openai", KOLO_PILOTO_4A: "on" }, "openai", true],
  ["GPT OFF + 4A OFF", { IA_PROVIDER: "anthropic", KOLO_PILOTO_4A: "off" }, "anthropic", false],
];
w("  combinação".padEnd(22) + "provider".padEnd(14) + "4A");
for (const [nome, env, provEsp, quatroEsp] of combos) {
  const p = provider(env, QUALQUER);
  const q = quatroA(env, QUALQUER);
  w(`  ${nome.padEnd(20)}${String(p).padEnd(14)}${q}`);
  prova(`${nome} → provider=${provEsp}, 4A=${quatroEsp}`, p === provEsp && q === quatroEsp);
}

// E a prova mais forte da independência: mexer numa variável não move a outra.
const semTocar4A = ["anthropic", "openai_teste", "openai", "lixo"].map((v) =>
  quatroA({ IA_PROVIDER: v, KOLO_PILOTO_4A: "on" }, QUALQUER),
);
const semTocarGPT = ["off", "teste", "on", "lixo"].map((v) =>
  provider({ IA_PROVIDER: "openai", KOLO_PILOTO_4A: v }, QUALQUER),
);
prova("mudar IA_PROVIDER nos 4 valores NÃO move a 4A",
  semTocar4A.every((x) => x === true), `4A: ${semTocar4A.join(", ")}`);
prova("mudar KOLO_PILOTO_4A nos 4 valores NÃO move o provider",
  semTocarGPT.every((x) => x === "openai"), `provider: ${semTocarGPT.join(", ")}`);

// ── PLACAR ───────────────────────────────────────────────────────────────
const falhas = provas.filter((p) => !p.ok);
w(`\n${linha()}\nPLACAR: ${provas.length - falhas.length}/${provas.length}`);
if (falhas.length) w(falhas.map((f) => `  ✗ ${f.nome}`).join("\n"));
w(`\nestado do piloto NESTE processo, ao final: ${estadoPiloto4A()}`);
w(`(o ambiente foi restaurado a cada caso — nada vazou entre cenários)`);
w(linha());

writeFileSync("docs/bancada/seletores-prova-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/seletores-prova-2026-08-11.txt");
process.exit(falhas.length ? 1 : 0);
