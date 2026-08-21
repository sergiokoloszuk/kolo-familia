/**
 * BANCADA DA OFERTA DE PLANO — reprodução honesta da regressão de 09/08.
 *
 * ⚠️ POR QUE ESTA BANCADA EXISTE, e o que ela corrige na anterior.
 *
 * `scripts/ttft-web.mjs` e `scripts/gate-estrategias.mjs` mediram "0 ofertas de
 * Plano" com um system RECONSTRUÍDO À MÃO: um NUCLEO de três linhas no lugar do
 * `nucleoConducao()` real (dezenas de milhares de caracteres), o bloco de
 * desafio recortado, sem `VOZ_CONVERSA`, sem `FATOS_COMERCIAIS`, sem as skills,
 * sem `formasDeEntrega`, e com `claude-sonnet-4-5-20250929` no lugar do modelo
 * de produção. O próprio comentário de `buildSystemTextConversa` já avisava:
 * "sem isto a bancada reconstrói o prompt e mede um produto que não existe".
 *
 * Aqui o system sai da função REAL de produção, o modelo é o de produção
 * (`MODELO_CONVERSA[anthropic]`), e a intenção sai do classificador REAL — que
 * é justamente a peça que decide se o bloco com o marcador chega ao modelo.
 *
 * DOIS BRAÇOS, uma variável só: o trecho de texto que `b3898da` trocou dentro
 * do bloco de desafio. Todo o resto do system é byte a byte igual.
 *
 *   node scripts/bancada/oferta-plano/rodar.mjs
 *   node scripts/bancada/oferta-plano/rodar.mjs --rodadas 2 --so-classificador
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");

for (const l of readFileSync(resolve(WEB, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/"))
      return next(new URL(`../../../apps/web/src/${esp.slice(2)}.ts`, import.meta.url).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try {
        return next(`${esp}.ts`, ctx);
      } catch {
        /* não era .ts */
      }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return next(esp, ctx);
  },
});
const mod = (p) => import(new URL(`../../../apps/web/src/${p}`, import.meta.url).href);

// ── módulos REAIS de produção ──────────────────────────────────────────
const { buildSystemTextConversa } = await mod("lib/ia/prompt.ts");
const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const { MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const { MARCADOR_PLANO } = await mod("lib/ia/marcadores.ts");

const MODELO = MODELO_CONVERSA.anthropic;

/**
 * `logarUsoApi` grava em `api_calls` e engole o próprio erro. Um stub que
 * estoura é suficiente e NÃO escreve em banco nenhum — bancada não persiste.
 */
const supabaseStub = {
  from() {
    throw new Error("bancada não escreve no banco");
  },
};

// ── a variável sob teste ───────────────────────────────────────────────
// Verbatim de `apps/web/src/lib/ia/prompt.ts` (atual) e de `b3898da^` (antes).
const TRECHO_ATUAL = `PLANO NÃO É FECHAMENTO PADRÃO DE CONVERSA BOA. Antes de oferecer, responda a si mesma: **transformar isto num plano acrescenta algo que esta conversa sozinha não entrega?** Se a resposta for não, não ofereça — e uma conversa que ajudou de verdade e terminou sem oferta é um bom resultado, não uma oportunidade perdida.
Ofereça quando: houver várias ações para organizar ao longo dos próximos dias; OU o caso precisar de continuidade, progressão e acompanhamento que uma resposta isolada não sustenta.
E QUANDO A FAMÍLIA PEDIR, o pedido basta — mesmo que você ainda precise perguntar o que o plano deve organizar, **ofereça o botão na mesma resposta**. Deixar a mãe pedir um plano e sair sem o botão é fazê-la pedir duas vezes.
Quando oferecer, diga o GANHO DAQUELE CASO, não o que o produto contém. "Isso aqui tem várias frentes e elas mudam de ordem conforme ele responde — num plano eu consigo te dar a sequência e o que observar em cada passo" vale; "posso te montar um plano com mais ideias e frases prontas" é anúncio de funcionalidade, e não convence ninguém.
Aponte pro BOTÃO (NÃO peça um "sim" digitado) e, na ÚLTIMA linha, escreva exatamente o marcador ${MARCADOR_PLANO} — ele some do texto e faz aparecer o botão. NUNCA termine sistematicamente com oferta de plano.`;

const TRECHO_ANTERIOR = `Assim que tiver contexto suficiente pra um bom plano, FECHE assim: dê uma ideia útil + ofereça o plano como um APROFUNDAMENTO, apontando pro BOTÃO (NÃO peça um "sim" digitado) — algo como "Acho que já consigo te montar um plano completo com isso (mais ideias, frases prontas e o que observar). É só tocar no botão 'Montar plano completo' aqui embaixo quando quiser." — e, na ÚLTIMA linha, escreva exatamente o marcador ${MARCADOR_PLANO}. Esse marcador some do texto e faz aparecer, abaixo da caixa, o botão de montar o plano; use SÓ quando for mesmo hora de oferecer, nunca em toda resposta.`;

/** A skill sintética das outras bancadas — mesma de `multiturno/rodar.mjs`. */
const SKILL = [
  {
    display_name: "Desenvolvimento e comportamento",
    objective: "ajudar a família a compreender e apoiar a criança no dia a dia",
    tone: "próximo, prático, sem jargão",
    scope: "rotina, regulação, comunicação, aprendizagem, autonomia",
    limits: "não diagnostica, não prescreve",
  },
];

/**
 * Os três casos são os de `docs/bancada/ttft-web-2026-08-09.txt`, VERBATIM —
 * é o que permite comparar com o número que abriu a regressão.
 */
const CASOS = [
  {
    id: "A · pedido EXPLÍCITO de plano",
    esperado: "OFERECER",
    relato: "Você consegue me montar um plano pra essa semana?",
    perfil:
      "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. INTERESSES: trens e metrô.",
  },
  {
    id: "B · várias frentes, Plano AGREGA",
    esperado: "OFERECER",
    relato:
      "Ele explode no fim da tarde, briga com a irmã, não quer tomar banho e ainda tem a lição. Todo dia é uma guerra e eu não sei por onde começar.",
    perfil:
      "Téo · 6 anos · TEA 1. EMOCIONAL — sinais: fica mais rápido, fala mais alto. ROTINA — precisa saber o que vem depois. INTERESSES: trens e metrô.",
  },
  {
    id: "C · dúvida pontual, Plano NÃO agrega",
    esperado: "NÃO OFERECER",
    relato: "Ele pode dormir com a luz acesa?",
    perfil: "Téo · 6 anos · TEA 1. SONO — dorme com a mãe junto.",
  },
];

const args = process.argv.slice(2);
const N = Number(args[args.indexOf("--rodadas") + 1]) || (args.includes("--rodadas") ? 4 : 4);
const SO_CLASSIFICADOR = args.includes("--so-classificador");

async function chamar(sistema, relato, perfil) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1200,
      system: sistema,
      stream: true,
      // ⚠️ SINTÉTICO: em produção o perfil chega por `buildContextBlock`, com
      // Kolo Vivo, histórico e boas práticas do banco. Aqui é uma linha só —
      // IDÊNTICA nos dois braços, que é o que a comparação exige.
      messages: [{ role: "user", content: `<o_que_ja_sabemos>\n${perfil}\n</o_que_ja_sabemos>\n\n${relato}` }],
    }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);

  const dec = new TextDecoder();
  let buffer = "";
  let texto = "";
  let ttft = null;
  for await (const chunk of r.body) {
    buffer += dec.decode(chunk, { stream: true });
    let q;
    while ((q = buffer.indexOf("\n")) !== -1) {
      const linha = buffer.slice(0, q).trim();
      buffer = buffer.slice(q + 1);
      if (!linha.startsWith("data: ")) continue;
      const corpo = linha.slice(6);
      if (corpo === "[DONE]") continue;
      let ev;
      try {
        ev = JSON.parse(corpo);
      } catch {
        continue;
      }
      if (ev.type === "content_block_delta" && ev.delta?.text) {
        if (ttft === null) ttft = Date.now() - t0;
        texto += ev.delta.text;
      }
    }
  }
  return { texto, total: Date.now() - t0, ttft: ttft ?? 0 };
}

const out = [];
const w = (s) => {
  out.push(s);
  console.log(s);
};

w(`BANCADA DA OFERTA DE PLANO · modelo de produção: ${MODELO}`);
w(`system: buildSystemTextConversa REAL · intenção: classificarIntencao REAL\n`);

for (const c of CASOS) {
  w(`\n${"█".repeat(78)}\n${c.id}\n"${c.relato}"\nesperado: ${c.esperado}\n`);

  // ── 1. o classificador REAL, que é o primeiro portão da oferta ──────
  const turno = await classificarIntencao({
    supabase: supabaseStub,
    familyId: "bancada",
    texto: c.relato,
    historico: [],
    temaAnterior: null,
  });
  const sistemaAtual = buildSystemTextConversa(SKILL, turno.intencao, turno.tema);
  const temMarcador = sistemaAtual.includes(MARCADOR_PLANO);
  w(`  classificador REAL → intencao=${turno.intencao} · tema=${turno.tema ?? "-"} · aceite=${turno.aceite ?? "-"}`);
  w(`  o system deste turno ${temMarcador ? "CONTÉM" : "**NÃO CONTÉM**"} a instrução do marcador`);
  w(`  system: ${sistemaAtual.length} caracteres`);

  if (SO_CLASSIFICADOR) continue;
  if (!temMarcador) {
    w(`  → sem instrução de marcador no system, o modelo NÃO TEM COMO oferecer. 0 rodadas.`);
    continue;
  }

  // ── 2. os dois braços, com uma única variável ───────────────────────
  if (!sistemaAtual.includes(TRECHO_ATUAL)) {
    throw new Error("TRECHO_ATUAL não bate com o prompt de hoje — a bancada mediria outra coisa.");
  }
  const bracos = [
    ["atual (pós b3898da)", sistemaAtual],
    ["anterior (b3898da^)", sistemaAtual.replace(TRECHO_ATUAL, TRECHO_ANTERIOR)],
  ];

  for (const [nome, sistema] of bracos) {
    let ofertas = 0;
    for (let i = 0; i < N; i++) {
      const r = await chamar(sistema, c.relato, c.perfil);
      const ofereceu = r.texto.includes(MARCADOR_PLANO);
      if (ofereceu) ofertas++;
      w(`  [${nome}] rodada ${i + 1}: TTFT ${r.ttft}ms · ${r.texto.length}ch · ${ofereceu ? "OFERECEU" : "não ofereceu"}`);
      if (i === 0)
        w(`\n    ┌─ ${nome} · rodada 1\n${r.texto.split("\n").map((l) => `    │ ${l}`).join("\n")}\n    └─\n`);
    }
    const acertou = c.esperado === "OFERECER" ? ofertas === N : ofertas === 0;
    w(`  → [${nome}] ofertas ${ofertas}/${N} · ${acertou ? "PASS" : "FAIL"}`);
  }
}

mkdirSync(resolve(AQUI, "../../../docs/bancada"), { recursive: true });
const destino = resolve(AQUI, "../../../docs/bancada/oferta-plano-2026-08-10.txt");
writeFileSync(destino, out.join("\n"), "utf8");
console.log(`\npronto → ${destino}`);
