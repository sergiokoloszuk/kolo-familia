/**
 * OS 4 CASOS DO TAMANHO — a menor ajuda suficiente.
 *
 * Mede a decisão que antes ninguém tomava: orientação × mini × rotina. E mede
 * as consequências dela — o que seria persistido, se sai PDF, se saem cartões.
 *
 * Módulos de produção, incluindo o piso determinístico e o critério do
 * porteiro. O único duplo é o Supabase.
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
// `rotina-guiada` puxa a ponte → supabase/server → next/headers, que só existe
// dentro do request do Next. A bancada não chama nada disso: usa os detectores.
// O stub evita ter que copiar o piso pra cá — copiado, ele mediria outra coisa.
registerHooks({ resolve(e, c, n) {
  if (e === "next/headers" || e === "next/cache") {
    return { url: "data:text/javascript,export const cookies=()=>{throw new Error('stub')};export const headers=()=>{throw new Error('stub')};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  }
  return n(e, c);
} });

const mod = (p) => import(new URL(`src/${p}`, WEB).href);
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { avaliarProntidaoParaRotina } = await mod("lib/ayla/prontidao-rotina.ts");
const { pediuRotinaExplicitamente, pediuParaImprimir } = await mod("lib/ayla/rotina-guiada.ts");
const { ORIENTACAO_DE_TRANSICAO } = await mod("lib/conducao/formas.ts");
const { validarRotina, resumirFalhas } = await mod("lib/ayla/validacao-rotina.ts");
const { interpretarRotina } = await mod("lib/ludico/rotina-ia.ts");

const src = readFileSync(new URL("src/lib/ayla/rotina-guiada.ts", WEB), "utf8");
const i = src.indexOf("const CONTRATO_ROTINA = `") + 25;
const CONTRATO = src.slice(i, src.indexOf("`;", i));

const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sbFake = { from: () => { throw new Error("sem banco na bancada"); } };

const CASOS = [
  {
    id: "1-rotina-explicita", titulo: "CASO 1 — ROTINA EXPLÍCITA",
    nome: "Manu", idade: 8, meses: 96,
    contexto: "Manu, 8 anos, TEA (laudo). TRANSIÇÕES JÁ CONHECIDAS: banho → costuma ser difícil, ela resiste a parar o que está fazendo.",
    turnos: [
      "Quero organizar a tarde da Manu.",
      "almoço 12h30, tarefa, brincar, banho, jantar, dormir",
    ],
    espera: "rotina",
  },
  {
    id: "2-transicao", titulo: "CASO 2 — TRANSIÇÃO IMPLÍCITA",
    nome: "Enzo", idade: 7, meses: 84,
    contexto: "Enzo, 7 anos, TDAH (laudo). Interesses: videogame, dinossauros. Ele entende bem quando a mãe explica falando.",
    turnos: ["Todo dia dá briga quando tiro o videogame pra ele ir tomar banho."],
    espera: "orientacao",
  },
  {
    id: "3-visual", titulo: "CASO 3 — VISUAL NECESSÁRIO",
    nome: "Theo", idade: 5, meses: 60,
    contexto: "Theo, 5 anos, TEA (laudo). comunicacao: fala pouco, entende melhor quando vê. A mãe já contou que apoio visual funciona muito bem com ele. Interesses: dinossauros.",
    turnos: [
      "Ele surta toda vez que acaba a brincadeira e tem que ir pro banho. Falar não adianta, ele não entende que depois vem o pijama e a história.",
    ],
    espera: "mini",
  },
  {
    id: "4-desnecessario", titulo: "CASO 4 — VISUAL DESNECESSÁRIO",
    nome: "Lia", idade: 9, meses: 108,
    contexto: "Lia, 9 anos, TDAH (laudo). Ela entende bem instrução verbal.",
    turnos: ["Ela demora pra sair de casa, mas quando aviso com antecedência ela vai."],
    espera: "orientacao",
  },
];

const rel = [];
for (const c of CASOS) {
  console.log("\n" + "█".repeat(76) + `\n${c.titulo}\n` + "█".repeat(76));
  const historico = [];
  const mensagens = [];
  let tamanho = null, visual = null, desfecho = null, gerou = null, turnos = 0, piso = false;

  for (const fala of c.turnos) {
    turnos += 1;
    console.log(`\n──▶ MÃE (turno ${turnos}):\n${fala}`);
    historico.push({ de: "mae", texto: fala });
    const conversa = historico.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");

    const p = await avaliarProntidaoParaRotina({ mensagem: fala, conversa, contexto: c.contexto, idadeMeses: c.meses });
    const explicito = pediuRotinaExplicitamente(fala);
    piso = piso || (explicito && p.tamanho !== "rotina");
    tamanho = explicito ? "rotina" : p.tamanho;
    visual = tamanho === "mini" ? true : p.visual;
    desfecho = p.desfecho;
    console.log(`   [prontidão: ${p.desfecho} | modelo disse tamanho=${p.tamanho} visual=${p.visual}${explicito ? " | PISO: pedido explícito → rotina" : ""}]`);

    if (p.desfecho === "nao_e_rotina") { console.log("\n◀── (sai do fluxo de rotina — vai pro reativo)"); break; }

    const soOrientacao = tamanho === "orientacao" && p.desfecho === "suficiente";
    const dicas = [
      soOrientacao ? ORIENTACAO_DE_TRANSICAO : "",
      tamanho === "mini" && p.desfecho === "suficiente"
        ? `TAMANHO: SEQUÊNCIA CURTA. O que ajuda aqui é a criança VER a passagem, não o dia inteiro organizado. Monte de 2 a 4 etapas, só o trecho que trava. acao="montar".`
        : "",
      p.desfecho === "falta" && p.pergunta ? `AINDA FALTA UMA COISA: ${p.pergunta}\nFaça ESSA pergunta, UMA só (acao="perguntar").` : "",
      p.desfecho === "falta_escopo" ? `ELA AINDA NÃO DISSE O QUE QUER ORGANIZAR. OFEREÇA CAMINHOS. acao="perguntar".` : "",
    ].filter(Boolean).join("\n\n");

    mensagens.push({ role: "user", content: [dicas, `CONTEXTO: ${c.contexto}`, `MENSAGEM DE AGORA: "${fala}"`].filter(Boolean).join("\n\n") });
    const r = await cli.messages.create({
      model: "claude-sonnet-4-5-20250929", max_tokens: 1400,
      system: `${nucleoConducao()}\n\n${CONTRATO}`, messages: mensagens,
    });
    const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let o; try { o = JSON.parse(t.match(/\{[\s\S]*\}/)[0]); } catch { o = { acao: "responder", mensagem: t }; }
    mensagens.push({ role: "assistant", content: JSON.stringify(o) });
    historico.push({ de: "kolo", texto: o.mensagem ?? "" });
    console.log(`\n◀── AYLA  [acao=${o.acao}]\n${o.mensagem ?? ""}`);

    // O portão real: em orientação, `pronto` é forçado a false.
    const pronto = !soOrientacao && (o.acao === "montar" || p.desfecho === "suficiente");
    if (pronto) {
      const notas = [...historico];
      if (tamanho === "mini") notas.push({ de: "mae", texto: "(monte SÓ a passagem que trava, de 2 a 4 etapas — não estenda pro resto do dia)" });
      const proposta = await interpretarRotina(sbFake, { familyId: null, nome: c.nome, idade: c.idade, historico: notas, propostaAtual: null });
      const tarefas = (proposta.rotinas ?? []).flatMap((x) => (x.tarefas ?? []).map((y) => ({ texto: y.texto, hora: y.hora })));
      const v = validarRotina({ tarefas, baseDeHorarios: `${conversa}\n${c.contexto}` });
      gerou = { proposta, valido: v.ok, etapas: tarefas.length };
      console.log(`\n   [GERADOR: ${proposta.rotinas?.length ?? 0} rotina(s), ${tarefas.length} etapas | validação: ${v.ok ? "OK" : "BARRADA " + resumirFalhas(v.falhas)}]`);
      for (const x of proposta.rotinas ?? []) {
        console.log(`     ${x.nome}: ${(x.tarefas ?? []).map((y) => `${y.hora ? y.hora + " " : ""}${y.texto}`).join(" → ")}`);
      }
      break;
    }
    if (soOrientacao) break;
  }

  const querImprimir = historico.some((h) => h.de === "mae" && pediuParaImprimir(h.texto));
  const persistiu = Boolean(gerou?.valido);
  const pdf = persistiu && querImprimir;
  const cards = persistiu && visual;
  console.log(`\n   ➜ tamanho=${tamanho} | persistiu=${persistiu ? "SIM" : "não"} | PDF=${pdf ? "SIM" : "não"} | cards=${cards ? "SIM" : "não"}`);
  rel.push({ id: c.id, espera: c.espera, tamanho, desfecho, turnos, piso, persistiu, pdf, cards, etapas: gerou?.etapas ?? 0 });
}

console.log("\n" + "═".repeat(84) + "\nRESUMO\n" + "═".repeat(84));
console.log("caso".padEnd(22) + "esperado".padEnd(12) + "deu".padEnd(12) + "turnos".padEnd(8) + "persistiu".padEnd(11) + "PDF".padEnd(6) + "cards".padEnd(7) + "etapas");
for (const r of rel) {
  const ok = r.tamanho === r.espera ? " " : "✗";
  console.log(
    `${ok}${r.id}`.padEnd(22) + r.espera.padEnd(12) + String(r.tamanho).padEnd(12) + String(r.turnos).padEnd(8) +
    (r.persistiu ? "SIM" : "não").padEnd(11) + (r.pdf ? "SIM" : "não").padEnd(6) + (r.cards ? "SIM" : "não").padEnd(7) + String(r.etapas),
  );
}
const acertos = rel.filter((r) => r.tamanho === r.espera).length;
console.log(`\n${acertos}/${rel.length} tamanhos como esperado.`);
