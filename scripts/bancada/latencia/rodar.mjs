/**
 * BANCADA DE LATÊNCIA — onde o tempo do turno é gasto, por etapa.
 *
 * NÃO TOCA FAMÍLIA REAL: as leituras de banco usam um id real (são SELECTs), e
 * a geração usa criança sintética. Nenhuma mensagem é enviada.
 *
 * Reproduz a MESMA sequência do `processInbound`, medindo cada etapa em
 * separado — inclusive as três leituras que hoje rodam em série dentro do
 * argumento de `classificarIntencao`.
 *
 *   node scripts/bancada/latencia/rodar.mjs
 *   node scripts/bancada/latencia/rodar.mjs --provider anthropic
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(AQUI, "../../../apps/web");
for (const l of readFileSync(resolve(WEB, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const PROVIDER = arg("--provider", "openai");
process.env.IA_PROVIDER = PROVIDER === "anthropic" ? "anthropic" : "openai";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(new URL("file:///" + WEB + "/src/" + e.slice(2) + ".ts"), c);
    const d = String(c?.parentURL ?? "").includes("/apps/web/src/");
    if (d && e.startsWith(".") && !/\.[a-z]+$/.test(e)) return n(e + ".ts", c);
    if (e === "next/headers" || e === "next/cache")
      return { url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
    return n(e, c);
  },
});
const { classificarIntencao } = await import("file:///" + WEB + "/src/lib/ayla/intent.ts");
const { carregarCatalogoSkills } = await import("file:///" + WEB + "/src/lib/ayla/catalogo-skills.ts");
const { recuperarBoasPraticas, blocoBoasPraticas } = await import("file:///" + WEB + "/src/lib/conhecimento/recuperar.ts");
const { gerarRespostaAyla } = await import("file:///" + WEB + "/src/lib/ayla/responder.ts");
const { fronteiraAtravessada } = await import("file:///" + WEB + "/src/lib/conducao/fronteiras.ts");

// Família REAL só pra medir latência de SELECT realista. Nada é escrito.
const { data: fam } = await sb.from("family_accounts").select("id").limit(1);
const FAM_ID = fam[0].id;
const { data: mem } = await sb.from("membros_atipicos").select("id").eq("family_account_id", FAM_ID).limit(1);
const MEMBRO_ID = mem?.[0]?.id ?? null;

const CRIANCA = {
  nomeMae: "Ana", nomeMembro: "Téo", idadeMembro: 6, perfilMembro: "TEA", generoMembro: "masculino",
  koloVivoResumo: "Téo, 6 anos. Gosta de carrinhos e Lego. Não gosta de barulho alto.",
};

const MSGS = [
  "Ele levanta toda hora na hora da tarefa.",
  "Ele reconhece as letras, mas no ditado só escreve se eu soletrar.",
  "Só aceita comida seca e crocante.",
  "Ele quer brincar mas chega pegando o brinquedo dos outros.",
  "Se eu não falar cada passo ele não escova os dentes.",
  "Ele tapa os ouvidos quando ligo o liquidificador.",
  "Ele aperta demais o lápis.",
  "Ele não copia quando eu peço, mas imita o irmão.",
  "Ele acorda várias vezes de noite.",
  "Hoje foi um dia difícil aqui em casa.",
];

const cron = async (fn) => { const t = Date.now(); const r = await fn(); return [r, Date.now() - t]; };
const amostras = [];

console.log(`provider: ${PROVIDER}\n`);
console.log("  #  total   ultFalas desafios catálogo classif  recup   montagem  modelo  fronteira");
for (const [i, msg] of MSGS.entries()) {
  const t0 = Date.now();
  // ── as três leituras que hoje rodam EM SÉRIE (ordem idêntica à produção)
  const [falas, msFalas] = await cron(() => ultimasFalasSim());
  const [desafios, msDesafios] = await cron(() => desafiosSim());
  const [catalogo, msCat] = await cron(() => carregarCatalogoSkills(sb));
  const [turno, msClass] = await cron(() =>
    classificarIntencao({ texto: msg, ...falas, temasOnboarding: desafios, catalogoSkills: catalogo }),
  );
  const [bps, msRecup] = await cron(() => recuperarBoasPraticas({ supabase: sb, skills: turno.skills, idade: 6 }));
  const [bloco, msMontagem] = await cron(async () => blocoBoasPraticas(bps));
  const [texto, msModelo] = await cron(() =>
    gerarRespostaAyla({ ...CRIANCA, mensagem: msg, historico: [], temaAtivo: turno.tema, aceite: turno.aceite, sinais: {}, repertorio: bloco }),
  );
  const [vaz, msFront] = await cron(async () => fronteiraAtravessada(texto));
  const total = Date.now() - t0;
  amostras.push({ total, msFalas, msDesafios, msCat, msClass, msRecup, msMontagem, msModelo, msFront, regenerou: !!vaz });
  console.log(
    `  ${String(i + 1).padStart(2)}  ${String(total).padStart(5)}   ${String(msFalas).padStart(6)} ${String(msDesafios).padStart(8)} ${String(msCat).padStart(8)} ${String(msClass).padStart(7)} ${String(msRecup).padStart(6)} ${String(msMontagem).padStart(9)} ${String(msModelo).padStart(7)} ${String(msFront).padStart(9)}`,
  );
}

// Simulações fiéis das duas leituras do orquestrador (mesmas tabelas/limites).
async function ultimasFalasSim() {
  const { data } = await sb.from("ayla_messages").select("direcao, texto, created_at")
    .eq("family_account_id", FAM_ID).order("created_at", { ascending: false }).limit(9);
  const t = (data ?? []).filter((m) => m.texto);
  return { ultimaMae: t.find((m) => m.direcao === "inbound")?.texto ?? null, ultimaAyla: t.find((m) => m.direcao === "outbound")?.texto ?? null, temaAnterior: null };
}
async function desafiosSim() {
  if (!MEMBRO_ID) return [];
  const { data } = await sb.from("perfil_vivo_membro").select("*").eq("membro_atipico_id", MEMBRO_ID).maybeSingle();
  return data ? Object.keys(data).slice(0, 6) : [];
}

const est = (campo) => {
  const v = amostras.map((a) => a[campo]).sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)];
  const p90 = v[Math.floor(v.length * 0.9)];
  return { media: Math.round(v.reduce((a, b) => a + b, 0) / v.length), mediana: med, p90, min: v[0], max: v[v.length - 1] };
};
console.log("\n── ESTATÍSTICA (ms) ──");
console.log("etapa            média  mediana    p90    min    max");
for (const [rot, c] of [["TOTAL", "total"], ["ultimasFalas", "msFalas"], ["desafios", "msDesafios"], ["catálogo", "msCat"], ["classificador", "msClass"], ["recuperação", "msRecup"], ["montagem", "msMontagem"], ["MODELO", "msModelo"], ["fronteira", "msFront"]]) {
  const e = est(c);
  console.log(`${rot.padEnd(16)} ${String(e.media).padStart(5)} ${String(e.mediana).padStart(8)} ${String(e.p90).padStart(6)} ${String(e.min).padStart(6)} ${String(e.max).padStart(6)}`);
}
const t = est("total").media, m = est("msModelo").media;
const dbSerial = est("msFalas").media + est("msDesafios").media + est("msCat").media;
console.log(`\nmodelo = ${Math.round(m / t * 100)}% do total`);
console.log(`3 leituras em série antes do classificador = ${dbSerial} ms (${Math.round(dbSerial / t * 100)}% do total)`);
console.log(`regenerações por fronteira: ${amostras.filter((a) => a.regenerou).length}/${amostras.length}`);
