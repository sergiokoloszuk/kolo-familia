/**
 * A CONVERSA DA KARINA SOBRE O MARIO — antes × depois, com o modelo de verdade.
 *
 * Reproduz os TRÊS turnos exatos de 06/08/2026 (01:19–01:21 UTC), os mesmos
 * que estão gravados em `ayla_messages`. Dois braços:
 *
 *   ANTES  — núcleo sem EXPLICACAO, sem os TRÊS NÍVEIS e sem o bloco de
 *            ângulos já usados. É o que rodou em produção naquela noite.
 *   DEPOIS — o núcleo de agora, com as três correções.
 *
 * Mede os três defeitos que a Karina apontou, cada um por sinal objetivo:
 *   1. gravidade importada (linguagem de crise num relato cotidiano)
 *   2. repetição (ângulo prático já orientado voltando no turno seguinte)
 *   3. secura (explicação geral ausente) — e o defeito oposto, afirmar
 *      mecanismo sobre AQUELA criança
 *
 *   node scripts/bancada/progressao/rodar.mjs
 *   node scripts/bancada/progressao/rodar.mjs --rodadas 3
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
    // Só dentro do nosso src: acrescentar `.ts` em node_modules quebra CJS.
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

const { nucleoConducao, EXPLICACAO } = await mod("lib/conducao/diretrizes.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { angulosUsados, blocoProgressao } = await mod("lib/conducao/angulos.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const RODADAS = arg("--rodadas", 1);

/** O núcleo como era antes das correções de 07/08. */
function nucleoAntes() {
  return nucleoConducao()
    .replace(EXPLICACAO, "")
    .replace(/^TRÊS NÍVEIS, NÃO DOIS\..*$/m, "")
    .replace("agressão que machuca alguém, autolesão, fuga, acidente iminente",
             "agressão que machuca, autolesão, fuga, risco de acidente");
}

const PERFIL = "Mario, 7 anos. Em investigação. Gosta de desenhar.";
const TURNOS = [
  "Mario vive pulando se jogando apertando tudo",
  "Mas é agitado . Pode derrubar coisas em lojas . Pessoas olhando",
  "Como faço para acalmar ele ?",
  // 4º turno, que NÃO estava na conversa real: uma pergunta de POR QUÊ.
  // Os três primeiros são todos "o que eu faço", e a própria regra manda dar
  // direção primeiro nesses — medir explicação ali é medir o lugar errado.
  // É em "por que ele consegue uma hora no desenho e cinco na lição?" que a
  // mãe passa a enxergar o filho de outro jeito.
  "Mas por que ele consegue ficar uma hora desenhando e cinco minutos na lição ?",
];

function mensagem(historico, fala, comProgressao) {
  const linhas = [
    "Você está falando com a mãe de Mario.",
    "Em foco: Mario.",
    `\n<o_que_ja_sabemos_da_crianca>\n${PERFIL}\n</o_que_ja_sabemos_da_crianca>`,
  ];
  if (historico.length) {
    const h = historico.map((t) => `${t.de === "mae" ? "Mãe" : "Ayla"}: ${t.texto}`).join("\n");
    linhas.push(`\n<conversa_recente>\n${h}\n</conversa_recente>`);
    if (comProgressao) {
      const bloco = blocoProgressao(
        angulosUsados(historico.filter((t) => t.de === "ayla").map((t) => t.texto)),
      );
      if (bloco) linhas.push(`\n${bloco}`);
    }
  }
  linhas.push(`\n<mensagem_de_agora>\n${fala}\n</mensagem_de_agora>`);
  linhas.push(`\nResponda como a Ayla.`);
  return [{ role: "user", content: linhas.join("\n") }];
}

// ── OS SINAIS ──────────────────────────────────────────────────────────
/** Linguagem de crise: o que a Karina viu de gravidade importada. */
const CRISE = [
  /não vou deixar você se machucar/i,
  /afast\w+ (objetos|as coisas|quinas)/i,
  /objetos frágeis/i,
  /risco imediato/i,
  /emergência|SAMU|192/i,
  /lugar seguro/i,
];
/** Mecanismo afirmado sobre AQUELA criança — o defeito do app antigo. */
const MECANISMO_INDIVIDUAL = [
  /o (cérebro|sistema nervoso|córtex) (dele|do mario)/i,
  /(ele|o mario) (precisa|tem necessidade) de (propriocep|input sensorial)/i,
  /(ele|o mario) faz isso porque tem\b/i,
];
/** Explicação geral marcada como geral — o que se quer recuperar. */
const EXPLICACAO_GERAL = [
  /para algumas (crianças|pessoas)/i,
  /uma possibilidade é/i,
  /isso pode acontecer quando/i,
  /em geral,/i,
  /costuma(m)? (ter a função|ajudar|acontecer)/i,
];
const tem = (t, ps) => ps.filter((p) => p.test(t)).length;

const linha = (n, a, d) =>
  `${n.padEnd(34)} ${String(a).padStart(7)} ${String(d).padStart(7)}`;

async function jornada(comCorrecoes) {
  const system = [
    comCorrecoes ? nucleoConducao() : nucleoAntes(),
    FORMATO_WHATSAPP,
    DIRETRIZ_IDIOMA,
  ].join("\n\n");
  const historico = [];
  const respostas = [];
  for (const fala of TURNOS) {
    historico.push({ de: "mae", texto: fala });
    const r = await gerarConversacional({
      // GPT: é o provider oficial da conversa, e é o que rodou naquela noite.
      provider: "openai",
      model: MODELO_CONVERSA.openai,
      system,
      messages: mensagem(historico.slice(0, -1), fala, comCorrecoes),
      maxTokens: 1200,
    });
    const texto = (r.texto ?? "").trim();
    historico.push({ de: "ayla", texto });
    respostas.push(texto);
  }
  return respostas;
}

const acc = { antes: [], depois: [] };
for (let i = 0; i < RODADAS; i++) {
  process.stdout.write(`rodada ${i + 1}/${RODADAS} … `);
  acc.antes.push(await jornada(false));
  acc.depois.push(await jornada(true));
  console.log("ok");
}

const med = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** O turno 3 é o que a Karina criticou: é ali que a repetição apareceu. */
const ultimos = (b) => acc[b].map((r) => r[2]);
/** O 4º é a pergunta de POR QUÊ — é lá que a explicação tem que aparecer. */
const porques = (b) => acc[b].map((r) => r[3]);
const anteriores = (b) => acc[b].map((r) => r.slice(0, 2).join("\n"));

console.log(`\n${"".padEnd(34)} ${"ANTES".padStart(7)} ${"DEPOIS".padStart(7)}`);
console.log("─".repeat(50));
console.log(
  linha(
    "sinais de crise (turno 3)",
    med(ultimos("antes").map((t) => tem(t, CRISE))).toFixed(1),
    med(ultimos("depois").map((t) => tem(t, CRISE))).toFixed(1),
  ),
);
console.log(
  linha(
    "ângulos repetidos do turno anterior",
    med(
      acc.antes.map((r) => {
        const a = angulosUsados(r.slice(0, 2));
        return angulosUsados([r[2]]).filter((x) => a.includes(x)).length;
      }),
    ).toFixed(1),
    med(
      acc.depois.map((r) => {
        const a = angulosUsados(r.slice(0, 2));
        return angulosUsados([r[2]]).filter((x) => a.includes(x)).length;
      }),
    ).toFixed(1),
  ),
);
console.log(
  linha(
    "explic. geral no 'por quê'",
    med(porques("antes").map((t) => tem(t, EXPLICACAO_GERAL))).toFixed(1),
    med(porques("depois").map((t) => tem(t, EXPLICACAO_GERAL))).toFixed(1),
  ),
);
console.log(
  linha(
    "mecanismo afirmado da criança",
    med(porques("antes").map((t) => tem(t, MECANISMO_INDIVIDUAL))).toFixed(1),
    med(porques("depois").map((t) => tem(t, MECANISMO_INDIVIDUAL))).toFixed(1),
  ),
);
console.log(
  linha(
    "palavras (turno 3)",
    Math.round(med(ultimos("antes").map((t) => t.split(/\s+/).length))),
    Math.round(med(ultimos("depois").map((t) => t.split(/\s+/).length))),
  ),
);

console.log(`\n═══ "POR QUÊ", DEPOIS ═══\n${porques("depois")[0]}`);
console.log(`\n═══ "POR QUÊ", ANTES ═══\n${porques("antes")[0]}`);
void anteriores;
void ultimos;
