/**
 * VERIFICA O ROLLOUT CONTROLADO — depois de ativar, pelos FATOS do banco.
 *
 * A pergunta que ele responde é uma só, e é a que não dá pra responder no olho:
 *
 *   "O GPT está atendendo EXATAMENTE as famílias autorizadas, e nenhuma outra?"
 *
 * Read-only: só SELECT em `api_calls`. Não altera env, não ativa nada, não
 * escreve. Roda contra o banco de produção (as credenciais saem do
 * apps/web/.env.local, como as outras bancadas).
 *
 *   node scripts/bancada/migracao/verificar-rollout.mjs
 *   node scripts/bancada/migracao/verificar-rollout.mjs --horas 2
 *
 * A allowlist é lida de `OPENAI_TEST_FAMILY_IDS` — a MESMA variável que o
 * produto lê. Comparar contra uma lista digitada aqui provaria que duas cópias
 * batem entre si, não que a produção está certa.
 *
 * ⚠️ Ele só enxerga o que JÁ CONVERSOU depois da ativação. Zero chamada de uma
 * família autorizada não é "está errado" — é "essa pessoa ainda não escreveu".
 * A distinção aparece no relatório, porque confundir as duas leva a mexer no
 * que não está quebrado.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const envPath = resolve(RAIZ, "apps/web/.env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
const HORAS = Number(arg("--horas", 24));

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// A conversa, e só ela. Se um destes aparecer no OpenAI, algo além da camada
// conversacional migrou — e isso é um achado, não um detalhe.
const FEATURES_CONVERSA = ["ayla_responder", "conversa_web"];

const autorizadas = new Set(
  (process.env.OPENAI_TEST_FAMILY_IDS ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
);
const modo = (process.env.IA_PROVIDER ?? "").trim() || "(ausente)";

console.log(`\nmodo (IA_PROVIDER) ........ ${modo}`);
console.log(`famílias autorizadas ...... ${autorizadas.size}`);
console.log(`janela .................... últimas ${HORAS}h\n`);

const desde = new Date(Date.now() - HORAS * 3600_000).toISOString();
const { data, error } = await sb
  .from("api_calls")
  .select("provider, model, feature, family_account_id, custo_usd, created_at")
  .in("feature", FEATURES_CONVERSA)
  .gte("created_at", desde);
if (error) {
  console.error("ERRO ao ler api_calls:", error.message);
  process.exit(1);
}

const chamadas = data ?? [];
const porFamilia = new Map();
for (const r of chamadas) {
  const f = porFamilia.get(r.family_account_id) ?? {
    openai: 0,
    anthropic: 0,
    usd: 0,
    modelos: new Set(),
    canais: new Set(),
  };
  f[r.provider] = (f[r.provider] ?? 0) + 1;
  f.usd += Number(r.custo_usd ?? 0);
  f.modelos.add(r.model);
  f.canais.add(r.feature === "conversa_web" ? "web" : "whatsapp");
  porFamilia.set(r.family_account_id, f);
}

// ── OS DOIS ERROS QUE IMPORTAM ─────────────────────────────────────────
// VAZAMENTO: família não autorizada atendida pelo GPT. É o erro grave — alguém
// que não pediu pra testar está testando.
const vazamentos = [...porFamilia].filter(([id, f]) => f.openai > 0 && !autorizadas.has(id));
// NÃO CHEGOU: família autorizada que conversou e recebeu Claude. Configuração
// que não valeu (env não aplicada, deploy velho, id errado).
const naoChegou = [...porFamilia].filter(([id, f]) => autorizadas.has(id) && f.anthropic > 0);

console.log("── FAMÍLIAS AUTORIZADAS");
for (const id of autorizadas) {
  const f = porFamilia.get(id);
  if (!f) {
    console.log(`  ·  ${id}  — ainda não conversou nesta janela (não é erro)`);
    continue;
  }
  const ok = f.openai > 0 && f.anthropic === 0;
  console.log(
    `  ${ok ? "✓" : "✗"}  ${id}  openai:${f.openai} claude:${f.anthropic}  ` +
      `[${[...f.canais].join(",")}]  ${[...f.modelos].join(",")}  US$ ${f.usd.toFixed(4)}`,
  );
}

const outras = [...porFamilia].filter(([id]) => !autorizadas.has(id));
console.log(`\n── OUTRAS FAMÍLIAS (${outras.length} conversaram na janela)`);
const totalOpenaiFora = outras.reduce((s, [, f]) => s + f.openai, 0);
console.log(`   chamadas no Claude: ${outras.reduce((s, [, f]) => s + f.anthropic, 0)}`);
console.log(`   chamadas no OpenAI: ${totalOpenaiFora}   ← tem que ser 0`);

console.log("\n═══ VEREDITO ═══");
if (vazamentos.length) {
  console.log(`  ✗ VAZAMENTO — ${vazamentos.length} família(s) fora da lista no GPT:`);
  for (const [id, f] of vazamentos) console.log(`      ${id}  openai:${f.openai}`);
  console.log("    Ação: IA_PROVIDER=anthropic e redeploy. Investigar depois.");
}
if (naoChegou.length) {
  console.log(`  ✗ NÃO CHEGOU — ${naoChegou.length} autorizada(s) recebendo Claude:`);
  for (const [id, f] of naoChegou) console.log(`      ${id}  claude:${f.anthropic}`);
  console.log("    Provável: env não aplicada, deploy anterior à variável, ou id diferente.");
}
const semDado = [...autorizadas].filter((id) => !porFamilia.has(id));
if (!vazamentos.length && !naoChegou.length) {
  console.log(`  ✓ nenhum vazamento e nenhuma autorizada no Claude`);
  if (semDado.length === autorizadas.size)
    console.log(`  ·  mas NENHUMA autorizada conversou ainda — nada foi provado de verdade`);
  else if (semDado.length) console.log(`  ·  ${semDado.length} autorizada(s) ainda sem conversa`);
}
console.log();
// `exitCode` e não `process.exit()`: o cliente do Supabase deixa handles
// abertos, e sair à força no Windows imprime um "Assertion failed" do libuv
// DEPOIS do veredito — barulho que faz um relatório verde parecer um erro.
process.exitCode = vazamentos.length || naoChegou.length ? 1 : 0;
