/**
 * PRÉVIA VISUAL DA TELA DE REVISÃO.
 *
 * Renderiza os componentes REAIS (`Fila`, `CasoCard`) com dados sintéticos e o
 * CSS compilado do build, num HTML único que abre no navegador. Existe porque a
 * rota real depende de `perfil_fatos`, e a migração 0073 não pode ser aplicada.
 *
 * O que isto prova: layout, texto, hierarquia, os quatro botões, o recolhido.
 * O que NÃO prova: clique de verdade contra o banco (isso é validar-revisao.mjs).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const RAIZ = resolve("apps/web");
// Resolver a partir de apps/web: duas copias de React quebram os hooks.
const require_ = createRequire(pathToFileURL(join(RAIZ, "previa.js")).href);
const ts = require_("typescript");
const React = require_("react");
const { renderToStaticMarkup } = require_("react-dom/server");
// Dentro de node_modules: e o unico lugar de onde `import "react"` resolve.
const dir = join(RAIZ, "node_modules/.previa-revisao");
mkdirSync(dir, { recursive: true });

// Server action de mentira: a prévia é estática.
writeFileSync(join(dir, "actions.mjs"), "export async function decidir(){return{ok:true}}\n");

function levar(arquivo, destino, trocas = []) {
  let js = ts.transpileModule(readFileSync(join(RAIZ, arquivo), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: "react",
    },
  }).outputText;
  for (const [de, para] of trocas) js = js.replace(de, para);
  writeFileSync(join(dir, destino), js);
}

levar("src/app/admin/memoria/revisao/caso-card.tsx", "caso-card.mjs", [
  [/from\s+"\.\/actions"/g, 'from "./actions.mjs"'],
  [/from\s+"@\/lib\/memoria-viva\/revisao"/g, 'from "./tipos.mjs"'],
]);
levar("src/app/admin/memoria/revisao/fila.tsx", "fila.mjs", [
  [/from\s+"\.\/caso-card"/g, 'from "./caso-card.mjs"'],
  [/from\s+"@\/lib\/memoria-viva\/revisao"/g, 'from "./tipos.mjs"'],
]);
writeFileSync(join(dir, "tipos.mjs"), "export {};\n");

const { Fila } = await import(pathToFileURL(join(dir, "fila.mjs")).href);

const CASOS = [
  {
    id: "a1", familyId: "f1", membroId: "m1", membroNome: "Pedro", canal: "whatsapp",
    criadoEm: "2026-07-30T14:02:00Z", observadoEm: "2026-07-30", tempoOriginal: "ontem",
    afirmacao: "Recusa alimentos de textura pastosa; aceita apenas comida seca e crocante.",
    conceito: "nutricional.seletividade", dominio: "nutricional",
    motivo: "conflito_de_nome", sujeito: "child",
    sourceContentId: "whatsapp_turn:abc123", extractionRunId: "run-771",
    verificationStatus: "reported", dominiosSensiveis: [],
  },
  {
    id: "a2", familyId: "f1", membroId: "m2", membroNome: "Alice", canal: "whatsapp",
    criadoEm: "2026-07-30T18:40:00Z", observadoEm: "2026-07-30", tempoOriginal: null,
    afirmacao: "Dorme melhor quando o banho acontece antes das 19h.",
    conceito: "sono.rotina", dominio: "sono",
    motivo: "foco_fragil", sujeito: "multiple_or_ambiguous",
    sourceContentId: "whatsapp_turn:def456", extractionRunId: "run-772",
    verificationStatus: "reported", dominiosSensiveis: [],
  },
  {
    id: "a3", familyId: "f2", membroId: "m3", membroNome: "Miguel", canal: "diario",
    criadoEm: "2026-07-31T07:15:00Z", observadoEm: "2026-07-29", tempoOriginal: "anteontem",
    afirmacao: "Teve crise na escola durante a troca de sala; melhorou com aviso antecipado.",
    conceito: "transicoes.aviso_previo", dominio: "rotina",
    motivo: "sujeito_multiple_or_ambiguous", sujeito: "multiple_or_ambiguous",
    sourceContentId: "diario:2026-07-29", extractionRunId: "run-773",
    verificationStatus: "reported", dominiosSensiveis: ["saude"],
  },
];

const corpo = renderToStaticMarkup(React.createElement(Fila, { casos: CASOS }));

const cssDir = join(RAIZ, ".next/static/css");
const css = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(cssDir, f), "utf8"))
  .join("\n");

const CENARIOS = [
  ["celular (390px)", 390],
  ["tablet (768px)", 768],
  ["desktop (1280px)", 1280],
];

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Prévia — Revisão da Memória</title><style>${css}
body{background:#f5f5f4;font-family:system-ui,sans-serif}
.moldura{margin:24px auto;background:#fff;border:1px solid #d6d3d1;border-radius:10px;overflow:hidden}
.rotulo{background:#1c1917;color:#fafaf9;font:600 12px/1 system-ui;padding:8px 12px}
</style></head><body>
${CENARIOS.map(
  ([nome, w]) => `<div class="moldura" style="width:${w}px;max-width:96vw">
  <div class="rotulo">${nome}</div>
  <main class="mx-auto max-w-2xl px-4 py-6">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-neutral-900">Revisão da Memória</h1>
      <p class="mt-1 text-sm text-neutral-600">Estes são os casos em que o sistema ficou em dúvida e preferiu não decidir sozinho. Nenhum deles está sendo usado pela Ayla.</p>
    </header>
    ${corpo}
  </main></div>`,
).join("\n")}
</body></html>`;

const saida = resolve(
  "C:/Users/SRGIO~1/AppData/Local/Temp/claude/d--Projetos-Kolo-Fam-lia/90afe621-c3e0-4778-b2e8-824a13c57fd8/scratchpad/previa-revisao.html",
);
writeFileSync(saida, html);

// Verificações do que a prévia deve conter — se o HTML não tem isso, a tela
// não tem, e nenhum olho humano precisa procurar.
const exigido = [
  ["os quatro botões", ["Está certo", "Perfil errado", "Descartar", "Não sei dizer"]],
  ["a fala da família em destaque", ["textura pastosa"]],
  ["motivo em português", ["Pode ser sobre outra criança", "Não deu para saber de quem é"]],
  ["alvo de toque de 44px", ["min-h-11"]],
];
let falhas = 0;
for (const [nome, termos] of exigido) {
  const faltando = termos.filter((t) => !corpo.includes(t));
  if (faltando.length) {
    console.log(`  FALHA ${nome} — faltou: ${faltando.join(", ")}`);
    falhas += 1;
  } else console.log(`  OK    ${nome}`);
}
const jargao = ["epistemol", "lineage", "temporal_status", "verification_status", "sujeito_classificado"];
const visivel = corpo.split("<details")[0];
const vazando = jargao.filter((j) => visivel.includes(j));
if (vazando.length) {
  console.log(`  FALHA jargão fora do recolhido: ${vazando.join(", ")}`);
  falhas += 1;
} else console.log("  OK    jargão só dentro de “Detalhes técnicos”");

console.log(`\n  arquivo: ${saida}`);
process.exit(falhas ? 1 : 0);
