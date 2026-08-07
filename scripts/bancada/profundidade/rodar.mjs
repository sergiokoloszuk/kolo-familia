/**
 * BANCADA DA PROFUNDIDADE ADAPTATIVA — o modelo de verdade, antes × depois.
 *
 * A pergunta NÃO é "ficou maior". É:
 *   · o caso simples continuou curto?
 *   · o caso complexo ganhou riqueza ÚTIL — caminhos diferentes, atividade com
 *     nome, progressão, frase pronta — sem virar tratado?
 *
 * O braço ANTES reconstrói os tetos que existiam: "no máximo 2 balões" na
 * regra de idioma competindo com "2 a 4" no formato, e o teto fixo de blocos
 * em `formasDeEntrega`.
 *
 *   node scripts/bancada/profundidade/rodar.mjs
 *   node scripts/bancada/profundidade/rodar.mjs --rodadas 2
 */
import { readFileSync } from "node:fs";
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
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp) && ctx.parentURL?.includes("/apps/web/src/")) {
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

const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { formasDeEntrega, INTERESSE_COMO_VEICULO, A_CRIANCA_ANTES_DO_ROTULO } =
  await mod("lib/conducao/formas.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const RODADAS = arg("--rodadas", 1);

/** Reconstrói os tetos que existiam antes de `a629ea2`. */
function comoEraAntes(texto) {
  return texto
    .replace(
      /- O TAMANHO VEM DO CASO[\s\S]*?(?=\n- UMA PERGUNTA)/,
      "- Curto por padrão — 2 a 4 balões curtos — mas dê o espaço que a necessidade pedir. No máximo UMA pergunta por vez.\n",
    )
    .replace(/- UMA PERGUNTA — QUE NÃO É UMA INFORMAÇÃO[^\n]*\n/, "")
    .replace(
      /- Mantenha o MESMO tom e as MESMAS regras[^\n]*/,
      "- Mantenha o MESMO tom e as MESMAS regras (curto, humano, sem jargão clínico, no máximo 2 balões) em qualquer idioma.",
    )
    .replace(
      /Isto é uma ENTREGA: componha blocos curtos[^\n]*/,
      "Isto é uma ENTREGA: componha de 2 a 4 blocos curtos, cada um com um título curto em negrito e duas ou três linhas embaixo. Os títulos saem deste repertório:",
    )
    .replace(/- QUANTOS BLOCOS:[\s\S]*?(?=\n- Título curto)/, "")
    .replace(/Emoji marca mudança de tipo[^.]*\./, "No máximo um emoji por resposta.");
}

const PERFIS = {
  manu: "Manu, 8 anos. Em investigação. Gosta de desenhar e de bichos.",
  linguagem: "Manu, 5 anos. Atraso de linguagem, faz fono. Gosta de carrinhos.",
  matheo: "Matheo, 4 anos. Gosta de dinossauros.",
  andre: "André, 34 anos. Autista, diagnosticado adulto. Está escrevendo um livro.",
};

/** Os casos, com o nível de profundidade que CADA um deveria ter. */
const CASOS = [
  {
    id: "1-simples",
    nivel: "curto",
    perfil: PERFIS.matheo,
    fala: "Que horas você acha bom começar a rotina da noite?",
  },
  {
    id: "2-continuidade",
    nivel: "curto",
    perfil: PERFIS.matheo,
    fala: "Ok, vou testar assim.",
  },
  {
    id: "3-dia",
    nivel: "medio",
    perfil: PERFIS.matheo,
    fala: "Ele tá difícil de entender a hora de dormir, tem aula no outro dia e não quer ir pra cama.",
  },
  {
    id: "A-educacao-fisica",
    nivel: "rico",
    perfil: PERFIS.manu,
    fala: "ela esta dando trabalho na escola pois nao quer fazer as atividades de exercicio fisico. ela é preguiçosa, detesta ficar pulando, correndo. e o pior, fecha a cara e ninguem vai conseguir fazer ela mudar de ideia",
  },
  {
    id: "B-linguagem-R",
    nivel: "rico",
    perfil: PERFIS.linguagem,
    fala: "minha filha está com atraso de linguagem e a fono tá trabalhando o R. quero atividades que possam ajudar",
  },
  {
    id: "D-adulto",
    nivel: "medio",
    perfil: PERFIS.andre,
    fala: "Preciso me organizar pra terminar o livro e ainda preparar uma palestra. Tô travando pra começar.",
  },
];

async function responder(caso, antes) {
  const formato = antes ? comoEraAntes(FORMATO_WHATSAPP) : FORMATO_WHATSAPP;
  const idioma = antes ? comoEraAntes(DIRETRIZ_IDIOMA) : DIRETRIZ_IDIOMA;
  const formas = formasDeEntrega({ canal: "whatsapp", tema: null });
  const system = [
    nucleoConducao(),
    formato,
    antes ? comoEraAntes(formas) : formas,
    INTERESSE_COMO_VEICULO,
    A_CRIANCA_ANTES_DO_ROTULO,
    idioma,
  ].join("\n\n");
  const conteudo = [
    `Você está falando com a mãe/pessoa responsável.`,
    `\n<o_que_ja_sabemos>\n${caso.perfil}\n</o_que_ja_sabemos>`,
    `\n<mensagem_de_agora>\n${caso.fala}\n</mensagem_de_agora>`,
    `\nResponda como a Ayla.`,
  ].join("\n");
  const r = await gerarConversacional({
    provider: "openai",
    model: MODELO_CONVERSA.openai,
    system,
    messages: [{ role: "user", content: conteudo }],
    maxTokens: 1500,
  });
  return (r.texto ?? "").trim();
}

// ── SINAIS ─────────────────────────────────────────────────────────────
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;
/** Título em negrito do WhatsApp = um bloco. */
const blocos = (t) => (t.match(/\*[^*\n]{3,40}\*/g) || []).length;
/** Atividade com NOME: "Missão dos cones", entre aspas ou em negrito. */
const temNomeDeAtividade = (t) =>
  /\b(miss[ãa]o|ca[çc]a ao tesouro|est[áa]tua|sem[áa]foro|jogo d[aeo]|brincadeira d[aeo])\b/i.test(t);
const temProgressao = (t) => /→|primeiro[^.]{0,40}depois|come[çc]a[^.]{0,60}depois|aos poucos/i.test(t);
const temFrasePronta = (t) => /["“][^"”]{15,140}["”]/.test(t);
const temExplicacao = (t) =>
  /para algumas (crian[çc]as|pessoas)|uma possibilidade|pode acontecer|costuma|envolve/i.test(t);
const temAcolhimento = (t) =>
  /deve estar (pesado|cansativo|difícil)|entendo|imagino|isso que você (observou|contou)|não é (preguiça|falta de)/i.test(t);
const elogioGenerico = (t) => /você é (uma )?(mãe|pai|pessoa) (incrível|maravilhos|ótim)/i.test(t);
const mecanismoIndividual = (t) =>
  /o (cérebro|sistema nervoso|córtex) (dele|dela)|(ele|ela) (não consegue|precisa) porque tem/i.test(t);
const perguntas = (t) => (t.match(/\?/g) || []).length;

const SINAIS = [
  ["blocos", blocos],
  ["palavras", palavras],
  ["perguntas", perguntas],
  ["explicação", (t) => (temExplicacao(t) ? 1 : 0)],
  ["atividade c/ nome", (t) => (temNomeDeAtividade(t) ? 1 : 0)],
  ["progressão", (t) => (temProgressao(t) ? 1 : 0)],
  ["frase pronta", (t) => (temFrasePronta(t) ? 1 : 0)],
  ["acolhimento", (t) => (temAcolhimento(t) ? 1 : 0)],
  ["elogio genérico ⚠️", (t) => (elogioGenerico(t) ? 1 : 0)],
  ["mecanismo indiv. ⚠️", (t) => (mecanismoIndividual(t) ? 1 : 0)],
];

const acc = {};
for (let r = 0; r < RODADAS; r++) {
  for (const c of CASOS) {
    process.stdout.write(`${c.id} … `);
    const antes = await responder(c, true);
    const depois = await responder(c, false);
    (acc[c.id] ??= { caso: c, antes: [], depois: [] });
    acc[c.id].antes.push(antes);
    acc[c.id].depois.push(depois);
    console.log("ok");
  }
}

const med = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`\n${"".padEnd(22)}${SINAIS.map(([n]) => n.slice(0, 9).padStart(11)).join("")}`);
for (const [id, d] of Object.entries(acc)) {
  for (const braco of ["antes", "depois"]) {
    const vals = SINAIS.map(([, f]) => med(d[braco].map(f)));
    const rot = braco === "antes" ? `${id} (${d.caso.nivel})` : "  → depois";
    console.log(
      rot.padEnd(22) + vals.map((v) => (v < 10 ? v.toFixed(1) : String(Math.round(v))).padStart(11)).join(""),
    );
  }
}

console.log("\n\n═══════════ TEXTOS ═══════════");
for (const [id, d] of Object.entries(acc)) {
  console.log(`\n\n████ ${id} (${d.caso.nivel}) — "${d.caso.fala.slice(0, 70)}…"`);
  console.log(`\n──── ANTES ────\n${d.antes[0]}`);
  console.log(`\n──── DEPOIS ────\n${d.depois[0]}`);
}
