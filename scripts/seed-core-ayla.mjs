/**
 * SEMEIA O CORE DA AYLA em `ayla_documentos` — Passo 1 do Admin.
 *
 * ⚠️ O CONTEÚDO NÃO É ESCRITO AQUI. Ele é LIDO de
 * `apps/web/src/lib/ayla/experimental-prompt.ts`, que é o Core já aprovado e
 * em QA com as três famílias. Copiar o texto para cá criaria duas versões da
 * mesma coisa, e um dia elas divergiriam — que é exatamente o problema que
 * este Passo 1 existe para acabar.
 *
 * ⚠️ POR QUE NÃO ESTÁ NO SQL DA MIGRAÇÃO. São 13 mil caracteres com crases,
 * aspas, cifrões e acentos. Escapar isso em SQL inline é frágil, e este
 * repositório já quebrou assim antes.
 *
 * SEGURO DE RODAR MAIS DE UMA VEZ: se já existir um documento ativo para
 * `core`, o script não faz nada e diz por quê. Ele nunca sobrescreve uma
 * versão publicada.
 *
 * Uso:  node scripts/seed-core-ayla.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry");

function env() {
  const arq = path.join(RAIZ, "apps/web/.env.local");
  const out = {};
  for (const linha of fs.readFileSync(arq, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** O Core, extraído do módulo de produto — fonte única. */
function coreDoCodigo() {
  const arq = path.join(RAIZ, "apps/web/src/lib/ayla/experimental-prompt.ts");
  const src = fs.readFileSync(arq, "utf8");
  const ini = src.indexOf("export const AYLA_EXPERIMENTAL_PROMPT = `");
  if (ini < 0) throw new Error("não achei AYLA_EXPERIMENTAL_PROMPT");
  const abre = src.indexOf("`", ini) + 1;
  const fecha = src.lastIndexOf("`;");
  const texto = src.slice(abre, fecha);
  if (texto.length < 10_000) throw new Error(`Core suspeito de estar truncado: ${texto.length} chars`);
  if (!texto.includes("Você é **AYLA**")) throw new Error("Core não começa como esperado");
  return texto;
}

const { NEXT_PUBLIC_SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = env();
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json" };

const core = coreDoCodigo();
console.log(`Core lido do código: ${core.length} caracteres.`);

const r = await fetch(`${URL}/rest/v1/ayla_documentos?select=id,versao,status&chave=eq.core`, { headers: H });
if (!r.ok) {
  console.error(`\n❌ Não consegui ler ayla_documentos (${r.status}).`);
  console.error(await r.text());
  console.error("\nA migração 0077 já foi aplicada? Enquanto ela não for, a Ayla usa o fallback do código — que é o comportamento correto.");
  process.exit(1);
}
const existentes = await r.json();
const ativo = existentes.find((x) => x.status === "ativo");
if (ativo) {
  console.log(`\nJá existe versão ATIVA (v${ativo.versao}). Nada a fazer — este script nunca sobrescreve publicação.`);
  process.exit(0);
}

if (DRY) {
  console.log("\n--dry: não escrevi nada. Criaria a v1 como ATIVA.");
  process.exit(0);
}

const ins = await fetch(`${URL}/rest/v1/ayla_documentos`, {
  method: "POST",
  headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify({
    chave: "core",
    versao: 1,
    status: "ativo",
    conteudo: core,
    publicado_em: new Date().toISOString(),
    nota: "Semeado do código (experimental-prompt.ts) — conteúdo idêntico ao aprovado em QA.",
  }),
});
if (!ins.ok) {
  console.error(`\n❌ Falha ao inserir (${ins.status}):`, (await ins.text()).slice(0, 300));
  process.exit(1);
}
const [linha] = await ins.json();
console.log(`\n✅ Core v${linha.versao} criado como ATIVO (${linha.conteudo.length} chars).`);
console.log("   Confira: a Ayla deve passar a reportar coreOrigem=admin no próximo turno (até 60s de cache).");
