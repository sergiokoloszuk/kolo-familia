/**
 * A BANCADA F1–F20 — gerador + casos + avaliador + relatório.
 *
 * Comando único:
 *
 *     node scripts/bancada/f1-f20/rodar.mjs
 *
 * Variáveis opcionais:
 *     EXECUCOES=2      repetições por caso crítico (padrão 2; não-críticos: 1)
 *     SO_CASO=id       roda um caso só
 *     SEM_JUIZ=1       só os critérios determinísticos (rápido, sem custo de juiz)
 *
 * ⚠️ O EXPERIMENTO É ISOLADO DE PROPÓSITO. Os dois braços rodam o MESMO Core
 * v11, o MESMO gerador (`responderExperimental`) e os MESMOS casos. A única
 * diferença é quem decide o turno:
 *
 *     A = `classificarIntencao`  (claude-haiku-4-5)   — produção 1c1b415
 *     B = `decidirTurno`         (GPT + <estado>)     — candidato 471e782
 *
 * Comparar dois checkouts inteiros mediria também tudo o que não mudou entre
 * eles; trocando só o decisor, a diferença que aparecer É a Fase 1B.
 *
 * ⚠️ NENHUMA ESCRITA É POSSÍVEL. A chave de service-role é apagada do ambiente
 * antes de qualquer import do app, e a rede fica restrita aos endpoints dos
 * modelos. Nada é enviado por WhatsApp, nada entra no histórico de família
 * nenhuma.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { RUBRICA, CRITERIOS_JUIZ, avaliarDeterministicos, jargaoEncontrado } from "./rubrica.mjs";
import { CASOS, CASOS_CRITICOS } from "./casos.mjs";
import { julgar } from "./juiz.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

for (const l of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rede = globalThis.fetch;
const ler = async (q) => {
  const r = await rede(`${SB}/rest/v1/${q}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } });
  if (!r.ok) throw Error(`leitura falhou HTTP ${r.status}`);
  return r.json();
};

// ── O CORE, CARREGADO EXPLICITAMENTE ────────────────────────────────────────
// ⚠️ SEM NÚMERO CHUMBADO. A bancada antiga travava em `versao !== 10` e por
// isso não rodava mais. Aqui a versão ativa é LIDA e REGISTRADA no relatório —
// se mudar, o relatório mostra; a bancada não para de existir por isso.
const docs = await ler("ayla_documentos?select=versao,conteudo&chave=eq.core&status=eq.ativo");
if (docs.length !== 1) throw Error(`esperava 1 core ativo, achei ${docs.length}`);
const core = docs[0];
const bps = await ler("boas_praticas?select=*&status=eq.ativo&limit=1000");
const skills = await ler("specialist_prompt_templates?select=name,routing_keywords&ativo=eq.true");
console.log(`Core v${core.versao} (${core.conteudo.length} ch, sha ${sha(core.conteudo)}) · ${bps.length} BPs · ${skills.length} skills`);

const CHAVE_OPENAI = process.env.OPENAI_API_KEY;

// A partir daqui nenhuma escrita é possível.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(pathToFileURL(resolve(SRC, e.slice(2) + ".ts")).href, c);
    if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(e + ".ts", c); } catch {} }
    if (["next/headers", "next/cache", "server-only"].includes(e))
      return { url: pathToFileURL(resolve(RAIZ, "scripts/bancada/core-v9-vs-v2/stub-next.mjs")).href, shortCircuit: true };
    return n(e, c);
  },
});

const PERMITIDOS = ["https://api.openai.com/v1/chat/completions", "https://api.anthropic.com/v1/messages"];
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!PERMITIDOS.some((p) => url.startsWith(p))) throw Error("rede fora do endpoint autorizado: " + url);
  return rede(input, { ...init, signal: AbortSignal.timeout(90000) });
};

const mod = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const { responderExperimental } = await mod("lib/ayla/experimental.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
const { classificarIntencao } = await mod("lib/ayla/intent.ts");
const { decidirTurno } = await mod("lib/conducao/decisao-do-turno.ts");
const { blocoDeEstado } = await mod("lib/conducao/estado-do-turno.ts");
// ⚠️ AVALIAR O QUE A FAMÍLIA VERIA, NÃO O QUE O MODELO DEVOLVEU. Entre a saída
// do modelo e o WhatsApp existe `paraWhatsApp`, que converte `**negrito**` em
// `*negrito*`, tira títulos e divisores. Medir o texto cru acusaria markdown em
// todo turno — e acusou, na primeira execução desta bancada, nos DOIS braços.
const { paraWhatsApp } = await mod("lib/ayla/apresentacao.ts");

/** O juiz fala direto com a OpenAI — fora do app, para não herdar nada dele. */
async function chamarJuiz({ system, user }) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${CHAVE_OPENAI}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_PRINCIPAL || "gpt-5.6-luna",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      // ⚠️ 3000, E O NÚMERO VEIO DE UM ERRO MEDIDO. Com 900 o juiz truncava:
      // são 13 critérios, e só a saída passa de 500 tokens — mais o raciocínio,
      // que neste modelo consome do MESMO teto. O JSON chegava cortado, virava
      // `indeterminado` em silêncio, e 75 dos 122 turnos da primeira bateria
      // saíram sem avaliação semântica nenhuma sem que nada acusasse.
      max_completion_tokens: 3000,
    }),
  });
  if (!r.ok) throw Error(`juiz HTTP ${r.status}`);
  const j = await r.json();
  custo.juiz += 1;
  custo.tokensJuiz += j.usage?.total_tokens ?? 0;
  // ⚠️ TRUNCAGEM NÃO PODE SER SILENCIOSA. Se o teto estourar de novo, o
  // relatório tem que dizer — um juiz que emudece faz a bancada parecer limpa.
  if (j.choices?.[0]?.finish_reason === "length") {
    custo.juizTruncado += 1;
    console.error("  ! juiz truncado — veredito descartado");
  }
  return j.choices?.[0]?.message?.content ?? "";
}

const custo = { juiz: 0, juizTruncado: 0, tokensJuiz: 0, geracao: 0, decisao: 0 };

/** O `<estado>` do caso — vazio, ou com o artefato pendente que ele descreve. */
function estadoDoCaso(caso, historico) {
  const ultimaAyla = [...(historico ?? [])].reverse().find((h) => h.quem === "ayla")?.texto ?? null;
  return blocoDeEstado({
    sujeito: { conhecido: "sim", valor: { id: "x", nome: caso.crianca.nome } },
    perguntaPendente: ultimaAyla && ultimaAyla.includes("?")
      ? { conhecido: "sim", valor: { pergunta: ultimaAyla.split("?")[0].slice(-200) + "?", opcoes: [] } }
      : { conhecido: "nenhum" },
    ofertaPendente: { conhecido: "nao_rastreado" },
    jaOrientouNestaConversa: (historico ?? []).some((h) => h.quem === "ayla" && (h.texto ?? "").length > 200),
    estrategiaEmAcompanhamento: { conhecido: "nenhum" },
    resultadoConhecido: { conhecido: "nenhum" },
    artefatoPendente: caso.artefatoPendente
      ? { conhecido: "sim", valor: { tipo: "rotina", id: "r1", ...caso.artefatoPendente } }
      : { conhecido: "nenhum" },
    perguntasRecentes: (historico ?? [])
      .filter((h) => h.quem === "ayla" && (h.texto ?? "").includes("?"))
      .map((h) => h.texto.split(/(?<=\?)/)[0].trim().slice(0, 160))
      .slice(-4),
    correcoesDaFamilia: { conhecido: "nao_rastreado" },
  });
}

/** Decide o turno pelo braço pedido. É a ÚNICA diferença entre A e B. */
async function decidir(braco, { msg, historico, caso }) {
  const ultimaMae = [...historico].reverse().find((h) => h.quem === "mae")?.texto ?? null;
  const ultimaAyla = [...historico].reverse().find((h) => h.quem === "ayla")?.texto ?? null;
  try {
    if (braco === "A") {
      const r = await classificarIntencao({ texto: msg, catalogoSkills: skills, ultimaMae, ultimaAyla });
      custo.decisao += 1;
      // O braço A não conhece `pedidoExplicito`: em produção, a intenção
      // sozinha bastava para a feature agir. É essa a diferença sob teste.
      return { ...r, pedidoExplicito: r.intencao !== "outro", origem: "haiku" };
    }
    const r = await decidirTurno({
      texto: msg,
      blocoEstado: estadoDoCaso(caso, historico),
      ultimaMae, ultimaAyla, catalogoSkills: skills,
    });
    custo.decisao += 1;
    return r;
  } catch (e) {
    return { intencao: "outro", tema: null, aceite: null, skills: [], pedidoExplicito: false, origem: "erro" };
  }
}

const N_CRITICOS = Number(process.env.EXECUCOES ?? 2);
const SO = process.env.SO_CASO;
const SEM_JUIZ = process.env.SEM_JUIZ === "1";
const alvo = SO ? CASOS.filter((c) => c.id === SO) : CASOS;

const saida = {
  quando: new Date().toISOString(),
  coreVersao: core.versao,
  coreSha: sha(core.conteudo),
  bracos: { A: "classificarIntencao · claude-haiku-4-5 · produção 1c1b415", B: "decidirTurno · GPT + <estado> · candidato 471e782" },
  execucoesCriticos: N_CRITICOS,
  turnos: [],
};

for (const caso of alvo) {
  const repeticoes = caso.critico ? N_CRITICOS : 1;
  for (const braco of ["A", "B"]) {
    for (let exec = 1; exec <= repeticoes; exec++) {
      const mundo = montarMundo({ nomeMae: "Ana", criancas: [caso.crianca] });
      mundo.db.semear("boas_praticas", structuredClone(bps));
      const historico = [];
      for (const turno of caso.turnos) {
        const d = await decidir(braco, { msg: turno.msg, historico, caso });
        const t0 = Date.now();
        let texto = "";
        try {
          const r = await responderExperimental(mundo.db, {
            familyId: mundo.familyId,
            mensagem: turno.msg,
            rascunhoCore: { conteudo: core.conteudo, versao: core.versao },
            origem: "simulador",
            turnosSimulados: historico.map((h) => ({ quem: h.quem, texto: h.texto })),
            turnoClassificado: d,
          });
          texto = paraWhatsApp(r?.texto ?? "");
          custo.geracao += 1;
        } catch (e) {
          texto = "";
          console.error(`  ! geração falhou (${caso.id}/${braco}): ${e.message}`);
        }
        const ms = Date.now() - t0;

        const contexto = { ...turno, texto };
        const det = avaliarDeterministicos(contexto);
        let sem = {};
        if (!SEM_JUIZ && texto) {
          try {
            sem = await julgar({
              turno: contexto,
              historico,
              contextoConhecido: JSON.stringify(caso.crianca.sabe ?? {}) + " " + JSON.stringify(caso.crianca.extras ?? {}),
              chamarModelo: chamarJuiz,
            });
          } catch (e) {
            console.error(`  ! juiz falhou (${caso.id}/${braco}): ${e.message}`);
          }
        }

        historico.push({ quem: "mae", texto: turno.msg });
        historico.push({ quem: "ayla", texto });

        saida.turnos.push({
          caso: caso.id, braco, execucao: exec, mensagem: turno.msg,
          nivelEsperado: turno.nivelEsperado ?? null,
          decisao: { intencao: d.intencao, pedidoExplicito: d.pedidoExplicito, skills: d.skills ?? [], origem: d.origem },
          esperaFeature: turno.esperaFeature ?? null,
          featureAgiria: d.pedidoExplicito === true,
          texto, chars: texto.length, ms,
          jargao: jargaoEncontrado(texto),
          vereditos: { ...det, ...sem },
        });
        mkdirSync(resolve(AQUI, "resultados"), { recursive: true });
        writeFileSync(resolve(AQUI, "resultados/bruto.json"), JSON.stringify(saida, null, 2));
      }
      console.log(`${caso.id} · braço ${braco} · exec ${exec} · ${caso.turnos.length} turno(s)`);
    }
  }
}

// ── RELATÓRIO ───────────────────────────────────────────────────────────────
const conta = (braco, id) => {
  const t = saida.turnos.filter((x) => x.braco === braco);
  let pass = 0, fail = 0, na = 0, ind = 0;
  for (const x of t) {
    const v = x.vereditos?.[id]?.veredito;
    if (v === "pass") pass++;
    else if (v === "fail") fail++;
    else if (v === "nao_aplicavel") na++;
    else if (v === "indeterminado") ind++;
  }
  return { pass, fail, na, ind, avaliados: pass + fail };
};

const linhas = [];
linhas.push(`# Bancada F1–F20\n`);
linhas.push(`Core v${core.versao} (sha ${sha(core.conteudo)}) · ${saida.quando}`);
linhas.push(`\n- **A** = ${saida.bracos.A}`);
linhas.push(`- **B** = ${saida.bracos.B}`);
linhas.push(`\nCasos: ${alvo.length} · turnos gerados: ${saida.turnos.length} · execuções por caso crítico: ${N_CRITICOS}`);
linhas.push(`\n## F1–F20 — A × B\n`);
linhas.push(`| Critério | Tipo | A pass/fail | B pass/fail | Δ fails | N/A | Indet. |`);
linhas.push(`|---|---|---|---|---|---|---|`);
for (const c of RUBRICA) {
  const a = conta("A", c.id), b = conta("B", c.id);
  const delta = b.fail - a.fail;
  const marca = delta > 0 ? ` ⚠️ +${delta}` : delta < 0 ? ` ✅ ${delta}` : " 0";
  linhas.push(`| ${c.id} ${c.nome} | ${c.tipo} | ${a.pass}/${a.fail} | ${b.pass}/${b.fail} |${marca} | A${a.na} B${b.na} | A${a.ind} B${b.ind} |`);
}

linhas.push(`\n## Por caso\n`);
linhas.push(`| Caso | Fails A | Fails B | Nova regressão? |`);
linhas.push(`|---|---|---|---|`);
for (const caso of alvo) {
  const fails = (br) => saida.turnos.filter((x) => x.caso === caso.id && x.braco === br)
    .reduce((n, x) => n + Object.values(x.vereditos ?? {}).filter((v) => v.veredito === "fail").length, 0);
  const a = fails("A"), b = fails("B");
  linhas.push(`| ${caso.id}${caso.critico ? " ⭑" : ""} | ${a} | ${b} | ${b > a ? "**SIM**" : "não"} |`);
}

linhas.push(`\n## Feature — sequestro do turno\n`);
linhas.push(`| Caso | Esperado | A agiria | B agiria |`);
linhas.push(`|---|---|---|---|`);
for (const x of saida.turnos.filter((t) => t.esperaFeature !== null && t.braco === "A")) {
  const b = saida.turnos.find((t) => t.caso === x.caso && t.mensagem === x.mensagem && t.braco === "B");
  linhas.push(`| ${x.caso} — "${x.mensagem.slice(0, 40)}" | ${x.esperaFeature} | ${x.featureAgiria} | ${b?.featureAgiria} |`);
}

linhas.push(`\n## "Me mostra" — resultado explícito\n`);
for (const x of saida.turnos.filter((t) => /me mostra/i.test(t.mensagem))) {
  const f4 = x.vereditos?.F4?.veredito;
  linhas.push(`- \`${x.braco}\` exec ${x.execucao}: F4 **${f4}** — ${x.vereditos?.F4?.evidencia ?? ""} (${x.chars} chars)`);
}

linhas.push(`\n## Violações — exemplos\n`);
for (const c of RUBRICA) {
  const ex = saida.turnos.filter((x) => x.vereditos?.[c.id]?.veredito === "fail").slice(0, 2);
  if (!ex.length) continue;
  linhas.push(`\n**${c.id} · ${c.nome}**`);
  for (const x of ex) linhas.push(`- \`${x.braco}\` ${x.caso} — ${x.vereditos[c.id].evidencia}`);
}

linhas.push(`\n## Custo\n`);
linhas.push(`- chamadas de decisão: ${custo.decisao}`);
linhas.push(`- chamadas de geração: ${custo.geracao}`);
linhas.push(`- chamadas do juiz: ${custo.juiz} (${custo.tokensJuiz} tokens) · truncadas: ${custo.juizTruncado}`);

const md = linhas.join("\n") + "\n";
writeFileSync(resolve(AQUI, "resultados/relatorio.md"), md);
writeFileSync(resolve(AQUI, "resultados/bruto.json"), JSON.stringify(saida, null, 2));
console.log("\n" + md);
console.log(`\nrelatório: scripts/bancada/f1-f20/resultados/relatorio.md`);
