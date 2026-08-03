/**
 * A FRONTEIRA `organizacao` × `plano` — a intenção nova roda em TODA mensagem.
 *
 * O risco não é o caso óbvio; é a mensagem do meio, onde a mesma cena (banho,
 * escola, tarefa) pode ser um problema de COMPORTAMENTO ou de PASSAGEM. Se a
 * intenção nova sequestrar o primeiro grupo, uma conversa que deveria acolher
 * e propor estratégia vira ferramenta.
 *
 * O desempate:
 *   comportamento / emoção / habilidade   → conversa ou Plano
 *   passagem / ordem / previsibilidade    → organização
 *
 * Os pares A/B, C/D, E/F existem de propósito: a mesma cena dos dois lados.
 */
import { readFileSync } from "node:fs";

const WEB = new URL("../../apps/web/", import.meta.url);
const env = readFileSync(new URL(".env.local", WEB), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
process.env.ANTHROPIC_API_KEY = get("ANTHROPIC_API_KEY");

const { registerHooks } = await import("node:module");
registerHooks({ resolve(e, c, n) { if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) { try { return n(`${e}.ts`, c); } catch {} } return n(e, c); } });
registerHooks({ resolve(e, c, n) { if (e.startsWith("@/")) return n(new URL(`src/${e.slice(2)}.ts`, WEB).href, c); return n(e, c); } });
registerHooks({ resolve(e, c, n) {
  if (e === "next/headers" || e === "next/cache") {
    return { url: "data:text/javascript,export const cookies=()=>{};export const headers=()=>{};export const revalidatePath=()=>{};export const revalidateTag=()=>{};", shortCircuit: true };
  }
  return n(e, c);
} });

const mod = (p) => import(new URL(`src/${p}`, WEB).href);
const { classificarIntencao } = await mod("lib/ayla/intent.ts");
const { avaliarProntidaoParaRotina } = await mod("lib/ayla/prontidao-rotina.ts");
const { pedeRotina, pediuRotinaExplicitamente } = await mod("lib/ayla/rotina-guiada.ts");

const CTX = "Criança de 7 anos, TEA (laudo). Interesses: dinossauros.";

const CASOS = [
  { id: "A", texto: "Toda hora do banho ele bate e grita.", organiza: false, porque: "o problema é o comportamento, não a passagem" },
  { id: "B", texto: "Toda vez que precisa parar de brincar e ir pro banho ele bate e grita.", organiza: true, porque: "a mesma cena, mas o que trava é a PASSAGEM" },
  { id: "C", texto: "Ela está muito agressiva ultimamente.", organiza: false, porque: "comportamento amplo, sem passagem nenhuma" },
  { id: "D", texto: "Ela fica agressiva quando aviso que é hora de sair de casa.", organiza: true, porque: "a agressão está amarrada na transição" },
  { id: "E", texto: "Não consegue fazer tarefa, perde o foco.", organiza: false, porque: "habilidade (foco), não ordem" },
  { id: "F", texto: "Não consegue começar a tarefa depois que chega da escola.", organiza: true, porque: "é a passagem escola → tarefa" },
  { id: "G", texto: "Está com medo da escola.", organiza: false, porque: "emoção; a palavra escola não faz rotina" },
  { id: "H", texto: "De manhã ela sabe tudo que precisa fazer, mas se perde na ordem.", organiza: true, porque: "é literalmente ordem/sequência" },
  { id: "I", texto: "Quero trabalhar a ansiedade.", organiza: false, porque: "habilidade emocional — é Plano" },
  { id: "J", texto: "Quero organizar o que fazer quando ela fica ansiosa.", organiza: false, porque: "o verbo é 'organizar', mas o objeto é ansiedade" },
];

const rel = [];
for (const c of CASOS) {
  const cl = await classificarIntencao({ texto: c.texto, temasOnboarding: ["rotina", "emocional", "escola"] });
  const entrou =
    cl.intencao === "rotina_criar" ||
    cl.intencao === "organizacao" ||
    pedeRotina(c.texto) ||
    pediuRotinaExplicitamente(c.texto);

  let prontidao = "-", tamanho = "-", desfecho = "-";
  if (entrou) {
    const p = await avaliarProntidaoParaRotina({ mensagem: c.texto, conversa: `Mãe: ${c.texto}`, contexto: CTX, idadeMeses: 84 });
    desfecho = p.desfecho;
    tamanho = pediuRotinaExplicitamente(c.texto) ? "rotina" : p.tamanho;
    prontidao = p.motivo;
    if (p.desfecho === "nao_e_rotina") tamanho = "(saiu)";
  }

  const ok = entrou === c.organiza;
  const final = !entrou ? "conversa/Plano" : desfecho === "nao_e_rotina" ? "conversa/Plano (saiu na prontidão)" : tamanho;
  console.log(`${ok ? " " : "✗"}${c.id}. "${c.texto}"`);
  console.log(`   intenção=${cl.intencao} → ${entrou ? "ENTRA" : "não entra"} | esperado: ${c.organiza ? "ENTRA" : "não entra"} (${c.porque})`);
  console.log(`   resultado final: ${final}${prontidao !== "-" ? `\n   prontidão: "${prontidao}"` : ""}\n`);
  rel.push({ ...c, intencao: cl.intencao, entrou, final, ok });
}

console.log("═".repeat(96));
console.log("caso".padEnd(6) + "intenção".padEnd(15) + "entra?".padEnd(9) + "esperado".padEnd(10) + "resultado final");
for (const r of rel) {
  console.log(`${r.ok ? " " : "✗"}${r.id}`.padEnd(6) + r.intencao.padEnd(15) + (r.entrou ? "SIM" : "não").padEnd(9) + (r.organiza ? "SIM" : "não").padEnd(10) + r.final);
}
const acertos = rel.filter((r) => r.ok).length;
console.log(`\n${acertos}/${rel.length} do lado certo da fronteira.`);
const sequestrados = rel.filter((r) => !r.organiza && r.entrou);
if (sequestrados.length) console.log(`⚠ SEQUESTRADOS pela organização (o erro caro): ${sequestrados.map((r) => r.id).join(", ")}`);
