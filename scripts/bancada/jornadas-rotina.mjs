/**
 * AS 5 JORNADAS DE ROTINA, ponta a ponta.
 *
 * Pedido → prontidão → condução → geração → validação → PDF.
 * Tudo com os módulos de produção; o único duplo é o Supabase, que aqui só
 * serve pro log de uso (best-effort, já dentro de try/catch no código real).
 */
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = get("ANTHROPIC_API_KEY");

const { registerHooks } = await import("node:module");
registerHooks({ resolve(e, c, n) { if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(`${e}.ts`, c); } catch {} } return n(e, c); } });
registerHooks({ resolve(e, c, n) { if (e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`, WEB).href, c); return n(e, c); } });

const mod = (p) => import(new URL(`src/${p}`, WEB).href);
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { avaliarProntidaoParaRotina } = await mod("lib/ayla/prontidao-rotina.ts");
const { validarRotina, resumirFalhas } = await mod("lib/ayla/validacao-rotina.ts");
const { interpretarRotina } = await mod("lib/ludico/rotina-ia.ts");
const { rotinaParaPdf } = await mod("lib/ludico/rotina-pdf.ts");

// O CONTRATO real, lido do fonte — a bancada não pode ter cópia própria.
const src = readFileSync(new URL("src/lib/ayla/rotina-guiada.ts", WEB), "utf8");
const i = src.indexOf("const CONTRATO_ROTINA = `") + 25;
const SYSTEM_CONDUTOR = `${nucleoConducao()}\n\n${src.slice(i, src.indexOf("`;", i))}`;

const cli = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sbFake = { from: () => { throw new Error("sem banco na bancada"); } };

async function conduzir(system, mensagens) {
  const r = await cli.messages.create({ model: "claude-sonnet-4-5-20250929", max_tokens: 1400, system, messages: mensagens });
  const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(t.match(/\{[\s\S]*\}/)[0]); } catch { return { acao: "perguntar", mensagem: t }; }
}

const JORNADAS = [
  {
    id: "1-generico", titulo: "JORNADA 1 — PEDIDO GENÉRICO",
    nome: "Mateus", idade: 9, meses: 108,
    contexto: "Mateus, 9 anos, TDAH (laudo). foco: trava pra COMEÇAR a lição. Interesses: futebol, Minecraft.",
    turnos: [
      "Preciso de uma rotina.",
      "Quero organizar a tarde depois da escola.",
      "ele chega meio dia e quarenta, come, fica de bobeira no celular, ai eu tenho q brigar pra fazer a licao, as vezes so faz de noite. terça e quinta tem futebol as 3 e meia. banho e janta depois",
    ],
  },
  {
    id: "2-dia-inteiro", titulo: "JORNADA 2 — DIA INTEIRO",
    nome: "Mateus", idade: 9, meses: 108,
    contexto: "Mateus, 9 anos, TDAH (laudo). foco: trava pra COMEÇAR a lição.",
    turnos: [
      "Quero uma rotina completa do dia inteiro.",
      "Ele acorda 6h30, toma café, se troca, escova os dentes e vai pra escola. Volta 12h40, almoça, descansa, faz lição, futebol 15h30, banho, jantar, lê e dorme 20h30.",
    ],
  },
  {
    id: "3-escola", titulo: "JORNADA 3 — MARIO / ESCOLA",
    nome: "Mario", idade: 7, meses: 84,
    contexto: "Mario, 7 anos, TEA (laudo). sensorial: incomoda-se com barulho e com roupa de etiqueta. rotina: sai de casa 7h; a manhã é corrida.",
    turnos: [
      "Ele não quer ir para escola. Preciso de ajuda para organizar a rotina dele.",
      "acorda umas 6h20, custa a levantar, tem que trocar de roupa umas 3 vezes, toma leite, escova os dentes e a gente sai correndo 7h",
    ],
  },
  {
    id: "4-ja-contei", titulo: "JORNADA 4 — JÁ TE CONTEI",
    nome: "Mateus", idade: 9, meses: 108,
    contexto: `Mateus, 9 anos, TDAH (laudo). foco: trava pra COMEÇAR a lição.
ROTINA QUE A MÃE JÁ CONTOU: chega 12h40, almoça 13h, descansa, lição, futebol 15h30 (terças e quintas), banho, jantar, dorme 20h30.`,
    turnos: ["Já te contei os horários dele. Agora monta a rotina."],
  },
  {
    id: "5-tema", titulo: "JORNADA 5 — TEMA / DINOSSAUROS",
    nome: "Theo", idade: 5, meses: 60,
    contexto: `Theo, 5 anos. Interesses: dinossauros, massinha.
ROTINA QUE A MÃE JÁ CONTOU: acorda 7h, café, escola 8h, volta meio-dia, almoça, brinca, jantar, banho, dorme 20h.`,
    turnos: ["Quero uma rotina usando dinossauros porque ele ama."],
  },
];

const rel = [];
for (const j of JORNADAS) {
  console.log("\n" + "█".repeat(76) + `\n${j.titulo}\n` + "█".repeat(76));
  const historico = [];
  const mensagens = [];
  let turnosMae = 0, perguntas = 0, gerou = null, prontidoes = [];

  for (const fala of j.turnos) {
    turnosMae += 1;
    historico.push({ de: "mae", texto: fala });
    console.log(`\n──▶ MÃE (turno ${turnosMae}):\n${fala}`);

    const conversa = historico.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");
    const p = await avaliarProntidaoParaRotina({ mensagem: fala, conversa, contexto: j.contexto, idadeMeses: j.meses });
    prontidoes.push(p.desfecho);
    console.log(`   [prontidão: ${p.desfecho}${p.pergunta ? ` — "${p.pergunta}"` : ""}]`);

    const dica =
      p.desfecho === "falta_escopo"
        ? `ELA AINDA NÃO DISSE O QUE QUER ORGANIZAR. NÃO pergunte dado nenhum. OFEREÇA CAMINHOS e espere ela escolher. acao="perguntar".`
        : p.desfecho === "falta" && p.pergunta
          ? `AINDA FALTA UMA COISA pra montar: ${p.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só —, e NÃO monte a rotina neste turno (acao="perguntar").`
          : "";

    mensagens.push({ role: "user", content: [dica, `CONTEXTO: ${j.contexto}`, `MENSAGEM DE AGORA: "${fala}"`].filter(Boolean).join("\n\n") });
    const o = await conduzir(SYSTEM_CONDUTOR, mensagens);
    mensagens.push({ role: "assistant", content: JSON.stringify(o) });
    historico.push({ de: "kolo", texto: o.mensagem ?? "" });

    console.log(`\n◀── AYLA  [acao=${o.acao}]\n${o.mensagem ?? ""}`);
    if ((o.mensagem ?? "").includes("?")) perguntas += 1;

    if (o.acao === "montar" || p.desfecho === "suficiente") {
      const proposta = await interpretarRotina(sbFake, { familyId: null, nome: j.nome, idade: j.idade, historico, propostaAtual: null });
      const tarefas = (proposta.rotinas ?? []).flatMap((r) => (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })));
      const v = validarRotina({ tarefas, baseDeHorarios: `${conversa}\n${j.contexto}` });
      gerou = { proposta, valido: v.ok, falhas: v.falhas };
      console.log(`\n   [GERADOR: ${proposta.rotinas?.length ?? 0} rotina(s), ${tarefas.length} etapas | validação: ${v.ok ? "OK" : "BARRADA " + resumirFalhas(v.falhas)}]`);
      break;
    }
  }

  if (gerou?.valido) {
    const dias = gerou.proposta.rotinas.map((r) => ({ nome: r.nome ?? "", tarefas: r.tarefas ?? [] }));
    const pd = j.contexto.match(/trava pra COMEÇAR a (\w+)/i)?.[1] ?? null;
    const pdf = await rotinaParaPdf({
      titulo: dias.length === 1 ? dias[0].nome || `A rotina do ${j.nome}` : `O dia do ${j.nome}`,
      nome: j.nome, tema: gerou.proposta.tema ?? null,
      pontoDificil: pd, fraseDeApoio: pd ? "Quando o timer tocar, começa a lição. Depois vem o futebol." : null,
      dias,
    });
    writeFileSync(new URL(`j${j.id}.pdf`, import.meta.url), Buffer.from(pdf));
    console.log(`   [PDF: j${j.id}.pdf — ${pdf.length} bytes]`);
    console.log("\n   ESTRUTURA GERADA:");
    for (const d of dias) console.log(`     ${d.nome || "(sem nome)"}: ` + d.tarefas.map((t) => `${t.hora ? t.hora + " " : ""}${t.texto}`).join(" → "));
  }

  rel.push({ id: j.id, turnosMae, perguntas, prontidoes, gerou: Boolean(gerou?.valido) });
}

console.log("\n\n" + "═".repeat(76) + "\nRESUMO\n" + "═".repeat(76));
console.log("jornada".padEnd(16) + "turnos".padEnd(8) + "gerou".padEnd(8) + "prontidões");
for (const r of rel) console.log(r.id.padEnd(16) + String(r.turnosMae).padEnd(8) + (r.gerou ? "SIM" : "NÃO").padEnd(8) + r.prontidoes.join(" → "));
