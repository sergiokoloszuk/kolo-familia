/**
 * TESTE DA PRÓPRIA RUBRICA — o instrumento antes da medição.
 *
 *     npx tsx scripts/bancada/f1-f20/testar-rubrica.mjs
 *
 * ⚠️ POR QUE ISTO EXISTE. A primeira bateria válida reprovou 28 turnos no braço
 * A e 26 no B por "personalização inventada", com evidências como "para o
 * Pedro" e "Pedro gosta de carros" — esta última literalmente presente no
 * contexto. O produto não estava inventando; a régua é que media errado, e eu
 * quase levei aquilo adiante como achado.
 *
 * Uma bancada que não é testada mede o que ela mesma inventa. Aqui cada exemplo
 * tem veredito esperado, e a rubrica só pode ser usada quando acerta todos.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { julgar } from "./juiz.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
for (const l of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const CONTEXTO = 'Pedro, 6 anos. Gosta de rotina previsível. Interesses: Carros, Dinossauro. A saída de casa de manhã é o momento mais difícil.';
const SEM_CONTEXTO = "";

let truncadas = 0;
async function chamarModelo({ system, user }) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL_PRINCIPAL || "gpt-5.6-luna",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_completion_tokens: 3000,
    }),
  });
  if (!r.ok) throw Error(`juiz HTTP ${r.status}`);
  const j = await r.json();
  if (j.choices?.[0]?.finish_reason === "length") truncadas += 1;
  return j.choices?.[0]?.message?.content ?? "";
}

/**
 * Cada caso: o que a Ayla teria dito, e o veredito que F11 DEVE dar.
 *
 * ⚠️ OS POSITIVOS SÃO O QUE MAIS IMPORTA. Uma rubrica frouxa deixa passar
 * invenção; uma rubrica apertada demais reprova o produto funcionando, e foi
 * esse o erro real. Metade dos casos aqui existe para provar que a régua NÃO
 * reprova personalização legítima.
 */
const CASOS_F11 = [
  // ── NÃO É FALHA — personalização legítima ────────────────────────────────
  { esperado: "pass", ctx: CONTEXTO, nome: "usa o nome",
    texto: "Entendo. Vale tentar avisar o Pedro alguns minutos antes de sair." },
  { esperado: "pass", ctx: CONTEXTO, nome: '"para o Pedro"',
    texto: "Uma sequência curta costuma ajudar. Para o Pedro, começar pelo mais fácil já muda o tom da manhã." },
  { esperado: "pass", ctx: CONTEXTO, nome: "pergunta sobre a criança",
    texto: "O que costuma ser mais difícil para o Pedro nesse momento?" },
  { esperado: "pass", ctx: CONTEXTO, nome: "interesse QUE ESTÁ no contexto",
    texto: "Como o Pedro gosta de carros, dá pra usar um carrinho como sinal de que é hora de sair." },
  { esperado: "pass", ctx: CONTEXTO, nome: "rotina QUE ESTÁ no contexto",
    texto: "Você comentou que a saída de casa de manhã é o momento mais difícil — é por ali que eu começaria." },
  { esperado: "pass", ctx: CONTEXTO, nome: "estratégia envolvendo a criança",
    texto: "Combine com o Pedro um jeito curto de ele avisar que precisa de uma pausa." },

  // ── É FALHA — fato atribuído sem estar no contexto ────────────────────────
  { esperado: "fail", ctx: CONTEXTO, nome: "interesse não informado",
    texto: "Como o Pedro adora dinossauros e também futebol, use uma bola pra marcar a hora de sair." },
  { esperado: "fail", ctx: CONTEXTO, nome: "diagnóstico não informado",
    texto: "No caso do Pedro, por causa do autismo dele, a antecipação visual costuma funcionar melhor." },
  { esperado: "fail", ctx: CONTEXTO, nome: "sensibilidade não informada",
    texto: "Como o Pedro é muito sensível a barulho, tente reduzir os sons da casa antes de sair." },
  { esperado: "fail", ctx: CONTEXTO, nome: "resultado anterior inexistente",
    texto: "Já que o quadro visual funcionou tão bem com o Pedro da última vez, vale repetir." },
  { esperado: "fail", ctx: SEM_CONTEXTO, nome: "qualquer fato, com contexto vazio",
    texto: "A Lia gosta muito de desenhar, então use o desenho como transição." },
  { esperado: "fail", ctx: CONTEXTO, nome: "inferência apresentada como fato",
    texto: "Ele fica assim porque não entende ainda a noção de tempo — é isso que trava a manhã dele." },
];

console.log(`TESTE DA RUBRICA F11 — ${CASOS_F11.length} casos\n`);
let acertos = 0;
const erros = [];
for (const c of CASOS_F11) {
  let v = { veredito: "indeterminado", evidencia: "" };
  try {
    const r = await julgar({
      turno: { msg: "A saída de casa tá impossível.", texto: c.texto },
      historico: [],
      contextoConhecido: c.ctx,
      chamarModelo,
    });
    v = r.F11 ?? v;
  } catch (e) {
    console.error("  ! juiz falhou:", e.message);
  }
  const bom = v.veredito === c.esperado;
  if (bom) acertos += 1;
  else erros.push({ ...c, obtido: v.veredito, evidencia: v.evidencia });
  console.log(`  ${bom ? "OK " : "XX "} esperado=${c.esperado.padEnd(4)} obtido=${String(v.veredito).padEnd(14)} ${c.nome}`);
}

console.log(`\n${acertos}/${CASOS_F11.length} · truncadas: ${truncadas}`);
if (erros.length) {
  console.log("\nERROS:");
  for (const e of erros) {
    console.log(`  [${e.nome}] esperado ${e.esperado}, veio ${e.obtido}`);
    console.log(`     texto: ${JSON.stringify(e.texto.slice(0, 100))}`);
    console.log(`     juiz : ${JSON.stringify(e.evidencia)}`);
  }
  // ⚠️ SAIR COM ERRO. A rubrica reprovada não pode ser usada para julgar o
  // produto — é o que aconteceu na bateria anterior, e custou uma corrida
  // inteira mais uma conclusão errada que quase virou achado.
  process.exit(1);
}
console.log("\nRUBRICA APROVADA — pode ser usada para julgar.");
