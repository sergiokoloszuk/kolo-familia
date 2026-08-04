/**
 * O CASO DA TARDE DA MANU — os dois lados do `reusaHistorico`, e o visual.
 *
 * Reproduz a conversa exata de produção (um passeio de barco na janela de 12h,
 * e então "Quero organizar a tarde da Manu") e mede os dois lados da regra:
 * histórico incidental não vira sequência; histórico CONVOCADO vira.
 *
 * O que se mede não é PASSOU/FALHOU — é o que a Ayla efetivamente diz.
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
const { pediuApoioVisual, pediuParaImprimir, pediuRotinaExplicitamente } = await mod("lib/ayla/rotina-guiada.ts");
const { validarRotina } = await mod("lib/ayla/validacao-rotina.ts");
const { interpretarRotina } = await mod("lib/ludico/rotina-ia.ts");

const src = readFileSync(new URL("src/lib/ayla/rotina-guiada.ts", WEB), "utf8");
const i = src.indexOf("const CONTRATO_ROTINA = `") + 25;
const CONTRATO = src.slice(i, src.indexOf("`;", i));

const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sbFake = { from: () => { throw new Error("sem banco na bancada"); } };

const PERFIL_BASE = "Manu, 6 anos, TEA (laudo). TRANSIÇÕES JÁ CONHECIDAS: banho → costuma ser difícil, resiste a parar o que está fazendo.";
const ROTINA_ANTIGA = "ROTINA QUE JÁ EXISTE: Arrumar o quarto: guardar brinquedos → guardar livros → arrumar a cama.";

/** A conversa de OUTRO assunto que ficou na janela de 12h. */
const ANTERIOR = [
  { de: "mae", texto: "amanhã a gente vai passear de barco com a família toda" },
  { de: "kolo", texto: "Que passeio bom! Vale avisar a Manu antes, e levar protetor solar e o boné dela." },
  { de: "mae", texto: "sim, vou passar protetor solar antes de sair e avisar ela umas duas vezes que a gente vai de barco" },
  { de: "kolo", texto: "Perfeito. Me conta depois como foi." },
];

const linhas = (hs) => hs.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");
const CONTAMINADAS = ["barco", "protetor", "solar", "passeio", "quarto", "cama", "livros"];

async function prontidao(fala, daRotina, anterior, perfil) {
  return avaliarProntidaoParaRotina({
    mensagem: fala,
    conversa: linhas(daRotina),
    contexto: [
      perfil,
      anterior.length ? `CONVERSA ANTERIOR (outro assunto — contexto, NÃO é a sequência de agora):\n${linhas(anterior)}` : "",
    ].filter(Boolean).join("\n"),
    idadeMeses: 72,
  });
}

async function falar(mensagens, dicas, fala, perfil) {
  mensagens.push({ role: "user", content: [dicas, `CONTEXTO: ${perfil}`, `MENSAGEM DE AGORA: "${fala}"`].filter(Boolean).join("\n\n") });
  const r = await cli.messages.create({ model: "claude-sonnet-4-5-20250929", max_tokens: 1400, system: `${nucleoConducao()}\n\n${CONTRATO}`, messages: mensagens });
  const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  let o; try { o = JSON.parse(t.match(/\{[\s\S]*\}/)[0]); } catch { o = { acao: "responder", mensagem: t }; }
  mensagens.push({ role: "assistant", content: JSON.stringify(o) });
  return o;
}

/** Um turno completo, como o condutor faz. */
async function turno({ fala, daRotina, anterior, perfil, mensagens, historicoCompleto }) {
  daRotina.push({ de: "mae", texto: fala });
  const p = await prontidao(fala, daRotina, anterior, perfil);
  const explicito = pediuRotinaExplicitamente(fala);
  const tamanho = explicito ? "rotina" : p.tamanho;
  const visual = (tamanho === "mini" ? true : p.visual) || daRotina.some((h) => h.de === "mae" && pediuApoioVisual(h.texto));
  const so = tamanho === "orientacao" && p.desfecho === "suficiente";
  const deve = p.desfecho === "suficiente" && !so;

  console.log(`\n──▶ MÃE: ${fala}`);
  console.log(`   [prontidão=${p.desfecho} tamanho=${tamanho} visual=${visual} reusaHistorico=${p.reusaHistorico}]`);
  console.log(`   [motivo: ${p.motivo}]`);

  const o = await falar(mensagens, [
    p.desfecho === "falta" && p.pergunta ? `AINDA FALTA UMA COISA pra montar: ${p.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só — e NÃO monte neste turno (acao="perguntar").` : "",
    deve ? `JÁ DÁ PRA MONTAR. acao="montar", obrigatoriamente. NÃO faça mais nenhuma pergunta neste turno.` : "",
    visual ? `OS CARTÕES ILUSTRADOS VÃO SAIR nesta rotina. PROPONHA O TEMA na mesma mensagem em que entrega.` : "",
  ].filter(Boolean).join("\n\n"), fala, perfil);
  console.log(`\n◀── AYLA [acao=${o.acao}]\n${o.mensagem ?? ""}`);
  daRotina.push({ de: "kolo", texto: o.mensagem ?? "" });

  let etapas = [];
  if (deve) {
    // Espelha a decisão real: convocado → janela inteira; senão → só esta conversa.
    const paraGerador = p.reusaHistorico ? historicoCompleto.concat(daRotina) : daRotina;
    const prop = await interpretarRotina(sbFake, { familyId: null, nome: "Manu", idade: 6, historico: paraGerador, propostaAtual: null });
    const tarefas = (prop.rotinas ?? []).flatMap((r) => (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })));
    etapas = tarefas.map((t) => t.texto);
    const v = validarRotina({ tarefas, baseDeHorarios: `${linhas(daRotina)}\n${perfil}` });
    console.log(`\n   [GERADOR: ${prop.rotinas?.length} rotina(s), ${etapas.length} etapas | validação: ${v.ok ? "OK" : "BARRADA"}]`);
    console.log(`   ${etapas.join(" → ")}`);
  }
  const pdf = daRotina.some((h) => h.de === "mae" && pediuParaImprimir(h.texto));
  const sujas = etapas.filter((t) => CONTAMINADAS.some((c) => t.toLowerCase().includes(c)));
  console.log(`\n   ➜ gerou=${etapas.length ? "SIM" : "não"} | visual=${visual} → modo=${visual ? "cartoes" : "lista"} → cabeçalho="${visual ? "Rotina Visual" : "Rotina"}" | PDF=${pdf}`);
  return { p, tamanho, visual, deve, etapas, sujas, pdf, msg: o.mensagem ?? "" };
}

const R = [];
const bar = (t) => console.log("\n" + "█".repeat(78) + `\n${t}\n` + "█".repeat(78));

// ══════════════════════════════════════════════════════════════════════════
// 2 + 1-NEGATIVO — o bug real, com barco e rotina antiga plantados
// ══════════════════════════════════════════════════════════════════════════
bar("NEGATIVO — barco + protetor solar + rotina antiga na janela de 12h");
for (const h of ANTERIOR) console.log(`  ${h.de === "mae" ? "MÃE " : "AYLA"}: ${h.texto}`);
console.log(`  (perfil traz: ${ROTINA_ANTIGA})`);
{
  const perfil = `${PERFIL_BASE}\n${ROTINA_ANTIGA}`;
  const daRotina = [], mensagens = [];
  const t1 = await turno({ fala: "Quero organizar a tarde da Manu.", daRotina, anterior: ANTERIOR, perfil, mensagens, historicoCompleto: ANTERIOR });
  const t2 = await turno({ fala: "almoço, tarefa, brincar, banho, jantar e dormir", daRotina, anterior: ANTERIOR, perfil, mensagens, historicoCompleto: ANTERIOR });
  R.push({ nome: "NEG t1 não gera", ok: !t1.deve && t1.etapas.length === 0 });
  R.push({ nome: "NEG t1 reusaHistorico=false", ok: t1.p.reusaHistorico === false });
  R.push({ nome: "NEG t1 pede a sequência", ok: /me conta|me manda|na ordem|como (é|está|e) a tarde/i.test(t1.msg || "") });
  R.push({ nome: "NEG t2 gera no mesmo turno", ok: t2.etapas.length > 0 });
  R.push({ nome: "NEG t2 zero etapa herdada", ok: t2.sujas.length === 0, extra: t2.sujas.join(", ") });
  R.push({ nome: "NEG visual=false (ninguém pediu)", ok: t2.visual === false });
  R.push({ nome: "NEG PDF=false (ninguém pediu)", ok: t2.pdf === false });
  R.push({ nome: "NEG sem falar em cartões/tema", ok: !/cart(ão|ões)|tema/i.test(t2.msg) });
}

// ══════════════════════════════════════════════════════════════════════════
// 1-POSITIVO — a mãe CONVOCA o que já contou
// ══════════════════════════════════════════════════════════════════════════
bar("POSITIVO — a mãe manda usar o que já contou");
{
  const perfil = PERFIL_BASE;
  const anterior = [
    ...ANTERIOR,
    { de: "mae", texto: "Quero organizar a tarde da Manu." },
    { de: "kolo", texto: "Me conta como é a tarde hoje, na ordem." },
    { de: "mae", texto: "almoço, tarefa, brincar, banho, jantar e dormir" },
    { de: "kolo", texto: "Prontinho, montei a tarde da Manu." },
  ];
  const daRotina = [], mensagens = [];
  const t = await turno({ fala: "Quero refazer usando o que eu já te contei.", daRotina, anterior, perfil, mensagens, historicoCompleto: anterior });
  R.push({ nome: "POS reusaHistorico=true", ok: t.p.reusaHistorico === true });
  R.push({ nome: "POS gera sem re-perguntar", ok: t.etapas.length > 0 });
  R.push({ nome: "POS reusa a sequência certa", ok: ["almoç", "banho", "jantar"].every((x) => t.etapas.join(" ").toLowerCase().includes(x)) });
  R.push({ nome: "POS zero assunto incidental", ok: t.sujas.length === 0, extra: t.sujas.join(", ") });
}

// ══════════════════════════════════════════════════════════════════════════
// 4 — a experiência VISUAL
// ══════════════════════════════════════════════════════════════════════════
bar("VISUAL — a mãe pede cartões");
{
  const perfil = PERFIL_BASE;
  const daRotina = [], mensagens = [];
  const t1 = await turno({ fala: "Quero uma rotina visual da tarde da Manu com cartões.", daRotina, anterior: ANTERIOR, perfil, mensagens, historicoCompleto: ANTERIOR });
  const t2 = t1.deve ? t1 : await turno({ fala: "almoço, tarefa, brincar, banho, jantar e dormir", daRotina, anterior: ANTERIOR, perfil, mensagens, historicoCompleto: ANTERIOR });
  R.push({ nome: "VIS visual=true pelo piso", ok: t1.visual === true });
  R.push({ nome: "VIS tamanho=rotina (piso explícito)", ok: t1.tamanho === "rotina" });
  R.push({ nome: "VIS gera e propõe tema", ok: t2.etapas.length > 0 && /tema|cart/i.test(t2.msg) });
}

// ══════════════════════════════════════════════════════════════════════════
// 5 — PDF só quando pede
// ══════════════════════════════════════════════════════════════════════════
bar("PDF — pedido explícito de imprimir");
{
  const perfil = PERFIL_BASE;
  const daRotina = [], mensagens = [];
  await turno({ fala: "Quero organizar a tarde da Manu e imprimir pra colar na parede.", daRotina, anterior: [], perfil, mensagens, historicoCompleto: [] });
  const t = await turno({ fala: "almoço, tarefa, brincar, banho, jantar e dormir", daRotina, anterior: [], perfil, mensagens, historicoCompleto: [] });
  R.push({ nome: "PDF pedido → true", ok: t.pdf === true });
}

console.log("\n" + "═".repeat(78) + "\nRESUMO\n" + "═".repeat(78));
for (const r of R) console.log(`${r.ok ? "  ok " : "FALHA"}  ${r.nome}${r.extra ? "  → " + r.extra : ""}`);
const falhas = R.filter((r) => !r.ok);
console.log(`\n${R.length - falhas.length}/${R.length} portões.`);
if (falhas.length) { console.log("PORTÕES QUE FALHARAM: " + falhas.map((f) => f.nome).join(" | ")); process.exitCode = 1; }
