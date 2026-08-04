/**
 * "SIM" TEM REFERENTE? — o caso Gustavo, 04/08/2026.
 *
 * A Ayla ofereceu montar uma história. A mãe respondeu "Sim. Vamos montar uma
 * história." e recebeu uma resposta sobre não poder dar diagnóstico: a
 * fronteira barrou duas vezes e o piso fixo foi ao ar. O "sim" não tinha
 * referente, e o modelo reconstruiu o turno da conversa inteira.
 *
 * Mede o classificador REAL nos dois lados: aceite de oferta × resposta a
 * pergunta × oferta ambígua.
 */
import { readFileSync } from "node:fs";
const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const g = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = g("ANTHROPIC_API_KEY");
const { registerHooks } = await import("node:module");
registerHooks({ resolve(e,c,n){ if(e.startsWith(".")&&!/\.[a-z]+$/.test(e)){try{return n(`${e}.ts`,c)}catch{}} return n(e,c);} });
registerHooks({ resolve(e,c,n){ if(e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`,WEB).href,c); return n(e,c);} });
const { classificarIntencao } = await import(new URL("src/lib/ayla/intent.ts", WEB).href);

const OFERTA_HISTORIA = "Me conta o que você reparar. E se quiser, a gente pode montar uma história curta pro Gustavo de protagonista, praticando exatamente esse momento de chegar num grupo — às vezes ajuda muito mais que o treino verbal direto.";

const CASOS = [
  { id: "GUSTAVO (o caso real)", ayla: OFERTA_HISTORIA, mae: "Sim. Vamos montar uma história.", aceite: true, intencao: "outro", pista: /hist[óo]ria/i },
  { id: "rotina + sim", ayla: "Posso montar essa rotina da tarde pra vocês, se quiser.", mae: "sim", aceite: true, intencao: "rotina_criar" },
  { id: "plano + quero", ayla: "Quer que eu transforme isso num plano estratégico com atividades?", mae: "quero", aceite: true, intencao: "plano" },
  // A intenção aqui pode ser "plano" ou "outro" — as duas só decidem se as
  // formas de entrega entram. Quem dispara o ARTEFATO é REGEX_OFERTA_PLANO, e
  // "pensar numa estratégia" não casa com ela. O que importa é o tema seguir.
  { id: "estratégia + vamos", ayla: "Quer que eu pense numa estratégia pro banho?", mae: "vamos", aceite: true, intencao: null, pista: /banho|estrat/i, semArtefato: "Quer que eu pense numa estratégia pro banho?" },
  { id: "história + pode fazer", ayla: "Se quiser, eu monto uma história social pra ela sobre a ida ao dentista.", mae: "pode fazer", aceite: true, intencao: "outro" },
  { id: "DUAS OPÇÕES + sim (ambíguo)", ayla: "Posso montar uma rotina da tarde, ou um plano pro momento da lição. O que faz mais sentido?", mae: "sim", aceite: false, intencao: "outro" },
  { id: "PERGUNTA + resposta curta", ayla: "Ele já fez xixi quando pega a fralda, ou pega antes?", mae: "Depois q ele já fez", aceite: false, intencao: "outro" },
  { id: "PERGUNTA + sim", ayla: "Ele costuma travar mais na hora de começar a lição?", mae: "sim", aceite: false, intencao: "outro" },
];

// A regex real do orquestrador — a que decide se o Plano é gerado.
const REGEX_OFERTA_PLANO = /monte(i)? um plano|montar (um |esse |o )?plano|junte.*plano|plano (completo|estrat[ée]gico)|um plano (completo|estrat[ée]gico|com|pra|sobre)/;
const R = [];
for (const c of CASOS) {
  const r = await classificarIntencao({ texto: c.mae, ultimaAyla: c.ayla, temasOnboarding: ["rotina", "escola"] });
  const temAceite = Boolean(r.aceite);
  const okA = temAceite === c.aceite;
  const okI = c.intencao === null || r.intencao === c.intencao;
  const okP = !c.pista || (r.aceite ? c.pista.test(r.aceite) : false);
  const okS = !c.semArtefato || !REGEX_OFERTA_PLANO.test(c.semArtefato.toLowerCase());
  const ok = okA && okI && okP && okS;
  R.push({ ...c, ok, r });
  console.log(`${ok ? " ok " : "FALHA"} ${c.id.padEnd(28)} intencao=${r.intencao.padEnd(13)} aceite=${r.aceite ? `"${r.aceite}"` : "—"}`);
  if (!ok) console.log(`        esperado: aceite=${c.aceite} intencao=${c.intencao}${c.pista ? ` pista=${c.pista}` : ""}`);
}
const f = R.filter((x) => !x.ok);
console.log(`\n${R.length - f.length}/${R.length} corretos.`);
if (f.length) process.exitCode = 1;
