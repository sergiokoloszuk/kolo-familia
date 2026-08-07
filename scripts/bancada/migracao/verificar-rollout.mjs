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
// O veredito mora fora daqui porque é testado — ver rollout-veredito.mjs e o
// caso do whisper-1 que virou alarme falso de vazamento.
import { FEATURES_CONVERSA, agruparPorFamilia, veredito } from "./rollout-veredito.mjs";

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
// O agrupador refiltra por feature de propósito: a `.in()` acima é otimização,
// não é a garantia. Áudio (whisper-1) no OpenAI é normal e nunca conta.
const porFamilia = agruparPorFamilia(chamadas);
const { vazamentos, naoChegou, semDado } = veredito(porFamilia, autorizadas);

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
