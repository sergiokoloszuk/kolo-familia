/**
 * O CASO DA TARDE DA MANU — antes × depois, com a fala real.
 *
 * Reproduz a conversa exata de produção: um assunto anterior na janela de 12h
 * (o passeio de barco), e então "Quero organizar a tarde da Manu." O que se
 * mede não é PASSOU/FALHOU — é o que a Ayla efetivamente diz.
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = get("ANTHROPIC_API_KEY");

const { registerHooks } = await import("node:module");
registerHooks({ resolve(e, c, n) { if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(`${e}.ts`, c); } catch {} } return n(e, c); } });
registerHooks({ resolve(e, c, n) { if (e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`, WEB).href, c); return n(e, c); } });
registerHooks({ resolve(e, c, n) {
  if (e === "next/headers" || e === "next/cache") return { url: "data:text/javascript,export const cookies=()=>{};export const headers=()=>{};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  return n(e, c);
} });

const mod = (p) => import(new URL(`src/${p}`, WEB).href);
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { avaliarProntidaoParaRotina } = await mod("lib/ayla/prontidao-rotina.ts");
const { pediuApoioVisual, pediuParaImprimir } = await mod("lib/ayla/rotina-guiada.ts");
const { validarRotina } = await mod("lib/ayla/validacao-rotina.ts");
const { interpretarRotina } = await mod("lib/ludico/rotina-ia.ts");

const src = readFileSync(new URL("src/lib/ayla/rotina-guiada.ts", WEB), "utf8");
const i = src.indexOf("const CONTRATO_ROTINA = `") + 25;
const CONTRATO = src.slice(i, src.indexOf("`;", i));

const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sbFake = { from: () => { throw new Error("sem banco na bancada"); } };

const PERFIL = "Manu, 6 anos, TEA (laudo). TRANSIÇÕES JÁ CONHECIDAS: banho → costuma ser difícil, resiste a parar o que está fazendo.";

// A conversa de ONTEM/HOJE MAIS CEDO — outro assunto, dentro das 12h.
const ANTERIOR = [
  { de: "mae", texto: "amanhã a gente vai passear de barco com a família toda" },
  { de: "kolo", texto: "Que passeio bom! Vale avisar a Manu antes, e levar protetor solar e o boné dela.", tipo: "resposta_registro" },
  { de: "mae", texto: "sim, vou passar protetor solar antes de sair e avisar ela umas duas vezes que a gente vai de barco" },
  { de: "kolo", texto: "Perfeito. Me conta depois como foi.", tipo: "resposta_registro" },
];

async function turno(historico, fala, historicoAnterior) {
  const linhas = (hs) => hs.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");
  const conversa = linhas(historico);
  const anterior = historicoAnterior.length ? linhas(historicoAnterior) : "";
  const p = await avaliarProntidaoParaRotina({
    mensagem: fala,
    conversa,
    contexto: [PERFIL, anterior ? `CONVERSA ANTERIOR (outro assunto — contexto, NÃO é a sequência de agora):\n${anterior}` : ""].filter(Boolean).join("\n"),
    idadeMeses: 72,
  });
  return p;
}

async function conduzir(mensagens, dicas, fala) {
  mensagens.push({ role: "user", content: [dicas, `CONTEXTO: ${PERFIL}`, `MENSAGEM DE AGORA: "${fala}"`].filter(Boolean).join("\n\n") });
  const r = await cli.messages.create({ model: "claude-sonnet-4-5-20250929", max_tokens: 1400, system: `${nucleoConducao()}\n\n${CONTRATO}`, messages: mensagens });
  const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let o; try { o = JSON.parse(t.match(/\{[\s\S]*\}/)[0]); } catch { o = { acao: "responder", mensagem: t }; }
  mensagens.push({ role: "assistant", content: JSON.stringify(o) });
  return o;
}

console.log("█".repeat(78));
console.log("O CASO REAL — conversa anterior sobre o passeio de barco, na janela de 12h");
console.log("█".repeat(78));
for (const h of ANTERIOR) console.log(`  ${h.de === "mae" ? "MÃE " : "AYLA"}: ${h.texto}`);

const historico = [];
const mensagens = [];
let reusou = false;

// ── TURNO 1 — o pedido que quebrou ───────────────────────────────────────
const f1 = "Quero organizar a tarde da Manu.";
console.log(`\n──▶ MÃE: ${f1}`);
historico.push({ de: "mae", texto: f1 });
const p1 = await turno(historico, f1, ANTERIOR);
console.log(`   [prontidão=${p1.desfecho} tamanho=${p1.tamanho} visual=${p1.visual} reusaHistorico=${p1.reusaHistorico}]`);
console.log(`   [motivo: ${p1.motivo}]`);

const so1 = p1.tamanho === "orientacao" && p1.desfecho === "suficiente";
const deve1 = p1.desfecho === "suficiente" && !so1;
const o1 = await conduzir(mensagens, [
  p1.desfecho === "falta" && p1.pergunta ? `AINDA FALTA UMA COISA pra montar: ${p1.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só — e NÃO monte neste turno (acao="perguntar").` : "",
  deve1 ? `JÁ DÁ PRA MONTAR. acao="montar", obrigatoriamente.` : "",
].filter(Boolean).join("\n\n"), f1);
console.log(`\n◀── AYLA [acao=${o1.acao}]\n${o1.mensagem}`);
historico.push({ de: "kolo", texto: o1.mensagem ?? "" });

let gerou1 = null;
if (deve1) {
  const prop = await interpretarRotina(sbFake, { familyId: null, nome: "Manu", idade: 6, historico, propostaAtual: null });
  gerou1 = (prop.rotinas ?? []).flatMap((r) => (r.tarefas ?? []).map((t) => t.texto));
  console.log(`\n   ⚠ GEROU no turno 1: ${gerou1.length} etapas — ${gerou1.join(" → ")}`);
}
const visual1 = p1.visual || historico.some((h) => h.de === "mae" && pediuApoioVisual(h.texto));
const pdf1 = historico.some((h) => h.de === "mae" && pediuParaImprimir(h.texto));
console.log(`\n   ➜ gerou=${gerou1 ? "SIM (" + gerou1.length + " etapas)" : "não"} | visual=${visual1} | PDF=${pdf1}`);

// ── TURNO 2 — a sequência de verdade ─────────────────────────────────────
const f2 = "almoço, tarefa, brincar, banho, jantar e dormir";
console.log(`\n──▶ MÃE: ${f2}`);
historico.push({ de: "mae", texto: f2 });
const p2 = await turno(historico, f2, ANTERIOR);
console.log(`   [prontidão=${p2.desfecho} tamanho=${p2.tamanho} visual=${p2.visual} reusaHistorico=${p2.reusaHistorico}]`);
const so2 = p2.tamanho === "orientacao" && p2.desfecho === "suficiente";
const deve2 = p2.desfecho === "suficiente" && !so2;
const o2 = await conduzir(mensagens, deve2 ? `JÁ DÁ PRA MONTAR. acao="montar", obrigatoriamente. NÃO faça mais nenhuma pergunta.` : "", f2);
console.log(`\n◀── AYLA [acao=${o2.acao}]\n${o2.mensagem}`);
historico.push({ de: "kolo", texto: o2.mensagem ?? "" });

let etapas = [];
if (deve2 || o2.acao === "montar") {
  const prop = await interpretarRotina(sbFake, { familyId: null, nome: "Manu", idade: 6, historico, propostaAtual: null });
  etapas = (prop.rotinas ?? []).flatMap((r) => (r.tarefas ?? []).map((t) => t.texto));
  const tarefas = (prop.rotinas ?? []).flatMap((r) => (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })));
  const v = validarRotina({ tarefas, baseDeHorarios: `${f2}\n${PERFIL}` });
  console.log(`\n   [GERADOR: ${prop.rotinas?.length} rotina(s), ${etapas.length} etapas | validação: ${v.ok ? "OK" : "BARRADA"}]`);
  console.log(`   ${etapas.join(" → ")}`);
}
const visual2 = p2.visual || historico.some((h) => h.de === "mae" && pediuApoioVisual(h.texto));
console.log(`\n   ➜ visual=${visual2} → modo_exibicao=${visual2 ? "cartoes" : "lista"} → cabeçalho="${visual2 ? "Rotina Visual" : "Rotina"}"`);

// ── VEREDITO ─────────────────────────────────────────────────────────────
const CONTAMINADAS = ["barco", "protetor", "solar", "passeio", "sair de casa", "avisar"];
const sujas = etapas.filter((t) => CONTAMINADAS.some((c) => t.toLowerCase().includes(c)));
console.log("\n" + "═".repeat(78));
console.log(`turno 1 gerou?          ${gerou1 ? "SIM ← ERRADO" : "não ← certo"}`);
console.log(`turno 1 perguntou?      ${(o1.mensagem ?? "").includes("?") ? "sim ← certo" : "NÃO ← errado"}`);
console.log(`turno 2 gerou?          ${etapas.length ? "sim ← certo" : "NÃO ← errado"}`);
console.log(`etapas herdadas do barco: ${sujas.length ? sujas.join(", ") + " ← ERRADO" : "nenhuma ← certo"}`);
console.log(`visual (ninguém pediu):  ${visual2 ? "true ← ERRADO" : "false ← certo"}`);
