/**
 * SMOKE DO GPT COM O REPERTÓRIO — ponta a ponta, pelo código de produção.
 *
 * O que ele faz: classifica (4º campo), recupera boas práticas do acervo REAL,
 * monta o prompt de produção e gera a resposta com `gerarConversacional` no
 * braço OpenAI, passando pela rede de fronteiras — exatamente como o WhatsApp
 * faz.
 *
 * ⚠️ O QUE ELE NÃO FAZ, DE PROPÓSITO: não manda mensagem de WhatsApp para
 * ninguém e não usa família real. Disparar um webhook falso faria a Ayla enviar
 * mensagem de verdade para três pessoas — inclusive uma usuária externa — e o
 * que se quer provar aqui é o CÓDIGO, não a caixa de entrada delas.
 *
 * `IA_PROVIDER=openai` é setado só neste processo, para forçar o braço GPT sem
 * depender da allowlist. A produção não é tocada.
 *
 *   node scripts/bancada/repertorio/smoke-gpt.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");
const envPath = resolve(WEB, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
process.env.IA_PROVIDER = "openai"; // só neste processo

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { registerHooks } = await import("node:module");
registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(new URL("file:///" + WEB + "/src/" + e.slice(2) + ".ts"), c);
    const dentro = String(c?.parentURL ?? "").includes("/apps/web/src/");
    if (dentro && e.startsWith(".") && !/\.[a-z]+$/.test(e)) return n(e + ".ts", c);
    // A cadeia do responder alcança `lib/supabase/server`, que importa APIs de
    // request do Next. Fora do servidor elas não existem — e não são usadas
    // neste caminho. Mesmo stub da bancada ab-conversa.
    if (e === "next/headers" || e === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return n(e, c);
  },
});
const { classificarIntencao } = await import("file:///" + WEB + "/src/lib/ayla/intent.ts");
const { carregarCatalogoSkills } = await import("file:///" + WEB + "/src/lib/ayla/catalogo-skills.ts");
const { recuperarBoasPraticas, blocoBoasPraticas } = await import(
  "file:///" + WEB + "/src/lib/conhecimento/recuperar.ts"
);
const { gerarRespostaAyla } = await import("file:///" + WEB + "/src/lib/ayla/responder.ts");
const { providerConversacionalParaFamilia, MODELO_CONVERSA } = await import(
  "file:///" + WEB + "/src/lib/ia/provider.ts"
);

const catalogo = await carregarCatalogoSkills(sb);
console.log(`catálogo de runtime: ${catalogo.length} skills ativas`);
console.log(`provider forçado: ${providerConversacionalParaFamilia("qualquer")} / ${MODELO_CONVERSA.openai}\n`);

// Criança SINTÉTICA. Nenhum dado de família real.
const CRIANCA = {
  nomeMae: "Ana",
  nomeMembro: "Téo",
  idadeMembro: 6,
  perfilMembro: "TEA",
  generoMembro: "masculino",
  koloVivoResumo:
    "Téo, 6 anos. Gosta muito de carrinhos e de montar Lego. Fica bem quando a atividade tem começo e fim claros. Não gosta de barulho alto.",
};

const CASOS = [
  ["A. Foco", "Quando ele desenha ou mexe em Lego fica bastante tempo concentrado, mas na tarefa levanta toda hora."],
  ["B. Aprendizado", "Ele reconhece as letras, mas no ditado só escreve quando eu vou soletrando."],
  ["D. Nutricional", "Ele só aceita alimentos secos e percebe quando eu troco até a marca."],
  ["E. Socialização", "Ele quer brincar, mas chega pegando o brinquedo das outras crianças."],
  ["F. Autonomia", "Se eu não falar cada passo ele não escova os dentes."],
  ["G. Sensorial BUSCA", "Ele vive pulando, se jogando no sofá e apertando tudo."],
  ["H. Sensorial EVITA", "Ele tapa os ouvidos e foge quando liga o liquidificador."],
];

const resultados = [];
let historico = [];

for (const [rot, msg] of CASOS) {
  const t0 = Date.now();
  const t = await classificarIntencao({ texto: msg, catalogoSkills: catalogo });
  const bps = await recuperarBoasPraticas({
    supabase: sb, skills: t.skills, idade: CRIANCA.idadeMembro,
  });
  const repertorio = blocoBoasPraticas(bps);
  const texto = await gerarRespostaAyla({
    ...CRIANCA,
    mensagem: msg,
    historico: [],
    temaAtivo: t.tema,
    aceite: t.aceite,
    sinais: {},
    repertorio,
  });
  const ms = Date.now() - t0;
  const pergunta = /\?/.test(texto);
  const passosNoContexto = bps.filter((b) => b.passos_praticos.length).length;
  resultados.push({ rot, skills: t.skills, bps: bps.length, passosNoContexto, palavras: texto.split(/\s+/).length, pergunta, ms });
  console.log(`\n${"═".repeat(76)}\n${rot}  ·  skills=${t.skills.join("+") || "—"}  BPs=${bps.length} (${passosNoContexto} c/ passos)  ${ms}ms`);
  console.log(`MÃE: ${msg}`);
  console.log(`AYLA: ${texto}`);
}

// ── multiturno com continuidade ──
console.log(`\n${"═".repeat(76)}\nMULTITURNO — continuidade e informação nova`);
historico = [];
const TURNOS = [
  "Ele reconhece as letras, mas no ditado só escreve quando eu vou soletrando.",
  "Ele reconhece todas as letras.",
  "Já faço isso.",
  "Não funcionou.",
  "Cadê?",
];
for (const msg of TURNOS) {
  const t = await classificarIntencao({
    texto: msg, catalogoSkills: catalogo,
    ultimaMae: historico.filter((h) => h.de === "mae").slice(-1)[0]?.texto ?? null,
    ultimaAyla: historico.filter((h) => h.de === "ayla").slice(-1)[0]?.texto ?? null,
  });
  const bps = await recuperarBoasPraticas({ supabase: sb, skills: t.skills, idade: 6 });
  const texto = await gerarRespostaAyla({
    ...CRIANCA, mensagem: msg, historico: [...historico],
    temaAtivo: t.tema, aceite: t.aceite, sinais: {},
    repertorio: blocoBoasPraticas(bps),
  });
  historico.push({ de: "mae", texto: msg }, { de: "ayla", texto });
  console.log(`\nMÃE: ${msg}`);
  console.log(`AYLA: ${texto.slice(0, 700)}`);
}

console.log(`\n${"═".repeat(76)}\nRESUMO`);
for (const r of resultados)
  console.log(`  ${r.rot.padEnd(22)} ${(r.skills.join("+") || "—").padEnd(22)} BPs=${r.bps} passos=${r.passosNoContexto} ${String(r.palavras).padStart(4)}pal ${r.pergunta ? "c/pergunta" : "s/pergunta"}`);
