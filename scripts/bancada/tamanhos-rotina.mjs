/**
 * OS 6 CASOS DO TAMANHO — a cadeia REAL, desde a mensagem que chega.
 *
 *   mensagem → classificador → entra (ou não) na capacidade → prontidão →
 *   tamanho → resposta/geração → persistência → PDF / cartões / link
 *
 * A versão anterior chamava a prontidão direto, e por isso não viu o furo mais
 * caro: "quero organizar a tarde da Manu" dava false no detector e "outro" no
 * classificador — o pedido mais explícito que existe não entrava no fluxo.
 *
 * Módulos de produção, inclusive o piso e o roteamento. Duplo só o Supabase.
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
  if (e === "next/headers" || e === "next/cache") {
    return { url: "data:text/javascript,export const cookies=()=>{throw new Error('stub')};export const headers=()=>{throw new Error('stub')};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  }
  return n(e, c);
} });

const mod = (p) => import(new URL(`src/${p}`, WEB).href);
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { classificarIntencao } = await mod("lib/ayla/intent.ts");
const { avaliarProntidaoParaRotina } = await mod("lib/ayla/prontidao-rotina.ts");
const { pedeRotina, pediuRotinaExplicitamente, pediuParaImprimir } = await mod("lib/ayla/rotina-guiada.ts");
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
    id: "1-explicita", titulo: "CASO 1 — ROTINA EXPLÍCITA", espera: "rotina", maxTurnos: 2,
    nome: "Manu", idade: 8, meses: 96,
    contexto: "Manu, 8 anos, TEA (laudo). TRANSIÇÕES JÁ CONHECIDAS: banho → costuma ser difícil, ela resiste a parar o que está fazendo.",
    turnos: ["Quero organizar a tarde da Manu.", "almoço 12h30, tarefa, brincar, banho, jantar, dormir"],
  },
  {
    id: "2-transicao", titulo: "CASO 2 — TRANSIÇÃO", espera: "orientacao",
    nome: "Enzo", idade: 7, meses: 84,
    contexto: "Enzo, 7 anos, TDAH (laudo). Interesses: videogame, dinossauros. Ele entende bem quando a mãe explica falando.",
    turnos: ["Todo dia dá briga pra sair do videogame e ir pro banho."],
  },
  {
    id: "3-visual", titulo: "CASO 3 — VISUAL NECESSÁRIO", espera: "mini",
    nome: "Theo", idade: 5, meses: 60,
    contexto: "Theo, 5 anos, TEA (laudo). comunicacao: fala pouco, entende melhor quando vê. A mãe já contou que apoio visual funciona muito bem com ele. Interesses: dinossauros.",
    turnos: ["Ele se perde quando termina de brincar. Precisa ver que depois vem banho, pijama e história."],
  },
  {
    id: "4-ja-funciona", titulo: "CASO 4 — JÁ TEM ALGO QUE FUNCIONA", espera: "orientacao",
    nome: "Lia", idade: 9, meses: 108,
    contexto: "Lia, 9 anos, TDAH (laudo). Ela entende bem instrução verbal.",
    turnos: ["Ela demora para sair, mas quando aviso antes ela vai."],
  },
  {
    id: "5-piso", titulo: "CASO 5 — PISO EXPLÍCITO", espera: "rotina",
    nome: "Davi", idade: 6, meses: 72,
    contexto: "Davi, 6 anos, TEA (laudo). ROTINA QUE A MÃE JÁ CONTOU: acorda 6h30, café, troca de roupa, escova os dentes, sai 7h20 pra escola.",
    turnos: ["Quero uma rotina visual da manhã."],
  },
  {
    id: "6-episodio", titulo: "CASO 6 — EPISÓDIO ISOLADO", espera: "(fora do fluxo)",
    nome: "Tiago", idade: 6, meses: 72,
    contexto: "Tiago, 6 anos, TEA (laudo).",
    turnos: ["Ele fez uma birra enorme no banho hoje."],
  },
];

const rel = [];
for (const c of CASOS) {
  console.log("\n" + "█".repeat(76) + `\n${c.titulo}\n` + "█".repeat(76));
  const historico = [];
  const mensagens = [];
  let tamanho = null, visual = null, gerou = null, turnos = 0, piso = false;
  let intencao = null, desfecho = null, entrou = false, motivo = "";

  for (const fala of c.turnos) {
    turnos += 1;
    console.log(`\n──▶ MÃE (turno ${turnos}):\n${fala}`);
    historico.push({ de: "mae", texto: fala });
    const conversa = historico.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");

    // ── 1. CLASSIFICADOR (o de produção) ────────────────────────────────
    const cl = await classificarIntencao({
      texto: fala,
      ultimaAyla: historico.filter((h) => h.de === "kolo").at(-1)?.texto ?? null,
      ultimaMae: historico.filter((h) => h.de === "mae").at(-2)?.texto ?? null,
      temasOnboarding: ["rotina", "sensorial"],
    });
    intencao = cl.intencao;

    // ── 2. A PORTA DO ORQUESTRADOR (a condição real, copiada) ───────────
    const conversaPendente = turnos > 1 && entrou;
    entrou =
      conversaPendente ||
      cl.intencao === "rotina_criar" ||
      cl.intencao === "organizacao" ||
      pedeRotina(fala) ||
      pediuRotinaExplicitamente(fala);
    console.log(`   [intenção=${cl.intencao} tema=${cl.tema ?? "-"} → ${entrou ? "ENTRA na capacidade" : "NÃO entra (conversa comum)"}]`);
    if (!entrou) { motivo = "classificador manteve na conversa comum"; break; }

    // ── 3. PRONTIDÃO + TAMANHO ──────────────────────────────────────────
    const p = await avaliarProntidaoParaRotina({ mensagem: fala, conversa, contexto: c.contexto, idadeMeses: c.meses });
    const explicito = pediuRotinaExplicitamente(fala);
    piso = piso || (explicito && p.tamanho !== "rotina");
    tamanho = explicito ? "rotina" : p.tamanho;
    visual = tamanho === "mini" ? true : p.visual;
    desfecho = p.desfecho;
    motivo = p.motivo;
    console.log(`   [prontidão=${p.desfecho} | modelo: tamanho=${p.tamanho} visual=${p.visual}${explicito ? " | PISO → rotina" : ""} | "${p.motivo}"]`);

    if (p.desfecho === "nao_e_rotina") { console.log("\n◀── (sai do fluxo — vai pro reativo)"); entrou = false; break; }

    const soOrientacao = tamanho === "orientacao" && p.desfecho === "suficiente";
    const deveMontar = p.desfecho === "suficiente" && !soOrientacao;

    const dicas = [
      soOrientacao ? ORIENTACAO_DE_TRANSICAO : "",
      deveMontar ? `JÁ DÁ PRA MONTAR — a criança, o pedaço do dia e a sequência já estão na mesa. acao="montar", obrigatoriamente. NÃO faça mais nenhuma pergunta neste turno.` : "",
      tamanho === "mini" && p.desfecho === "suficiente"
        ? `TAMANHO: SEQUÊNCIA CURTA. Monte de 2 a 4 etapas, só o trecho que trava. acao="montar".`
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
    if (deveMontar && o.acao !== "montar") console.log(`\n   ⚠ condutor pediu "${o.acao}" com prontidão suficiente — montando assim mesmo`);

    const pronto = !soOrientacao && (deveMontar || o.acao === "montar" || o.pronto === true);
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
  const link = persistiu;
  const deu = entrou ? tamanho : "(fora do fluxo)";
  console.log(`\n   ➜ intenção=${intencao} | tamanho=${deu} | turnos=${turnos} | persistiu=${persistiu ? "SIM" : "não"} | PDF=${pdf ? "SIM" : "não"} | cards=${cards ? "SIM" : "não"} | link=${link ? "SIM" : "não"}`);
  rel.push({ id: c.id, espera: c.espera, deu, intencao, desfecho, turnos, piso, persistiu, pdf, cards, link, etapas: gerou?.etapas ?? 0, motivo, maxTurnos: c.maxTurnos });
}

console.log("\n" + "═".repeat(104) + "\nRESUMO\n" + "═".repeat(104));
console.log("caso".padEnd(17) + "intenção".padEnd(15) + "prontidão".padEnd(14) + "esperado".padEnd(16) + "deu".padEnd(16) + "turnos".padEnd(8) + "persist".padEnd(9) + "PDF".padEnd(5) + "cards".padEnd(7) + "link");
for (const r of rel) {
  const ok = r.deu === r.espera ? " " : "✗";
  console.log(
    `${ok}${r.id}`.padEnd(17) + String(r.intencao).padEnd(15) + String(r.desfecho ?? "-").padEnd(14) +
    r.espera.padEnd(16) + String(r.deu).padEnd(16) + String(r.turnos).padEnd(8) +
    (r.persistiu ? "SIM" : "não").padEnd(9) + (r.pdf ? "SIM" : "não").padEnd(5) + (r.cards ? "SIM" : "não").padEnd(7) + (r.link ? "SIM" : "não"),
  );
}
const acertos = rel.filter((r) => r.deu === r.espera).length;
const turnosDemais = rel.filter((r) => r.maxTurnos && r.turnos > r.maxTurnos);
console.log(`\n${acertos}/${rel.length} como esperado.`);
if (turnosDemais.length) console.log(`⚠ turnos acima do teto: ${turnosDemais.map((r) => `${r.id} (${r.turnos}>${r.maxTurnos})`).join(", ")}`);
for (const r of rel) console.log(`  ${r.id}: ${r.motivo}`);
