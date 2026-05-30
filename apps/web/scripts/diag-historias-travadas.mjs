import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lista (e opcionalmente limpa) histórias presas em status='gerando'.
 * Acontece quando o after() do Vercel é cortado por timeout antes do
 * try/catch marcar o status como 'erro' — fica eternamente "gerando" e
 * o usuário fica preso no skeleton.
 *
 * Uso:
 *   node scripts/diag-historias-travadas.mjs                 # só lista
 *   node scripts/diag-historias-travadas.mjs --cleanup       # marca como erro
 *   node scripts/diag-historias-travadas.mjs --min 10        # janela em minutos (default 5)
 */

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const cleanup = args.includes("--cleanup");
const minIdx = args.indexOf("--min");
const janelaMin = minIdx >= 0 ? Number(args[minIdx + 1]) : 5;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const corte = new Date(Date.now() - janelaMin * 60_000).toISOString();
console.log(`=== histórias em 'gerando' há mais de ${janelaMin} min (${corte}) ===`);

const { data: travadas, error } = await admin
  .from("historias")
  .select("id, family_account_id, membro_atipico_id, titulo, created_at")
  .eq("status", "gerando")
  .lt("created_at", corte)
  .order("created_at", { ascending: false });

if (error) {
  console.error("erro:", error.message);
  process.exit(1);
}

if (!travadas?.length) {
  console.log("nenhuma. tudo limpo.");
  process.exit(0);
}

for (const h of travadas) {
  const idade = Math.round((Date.now() - new Date(h.created_at).getTime()) / 60_000);
  console.log(`- ${h.id}  family=${h.family_account_id}  membro=${h.membro_atipico_id}  idade=${idade}min  titulo="${h.titulo}"`);
}

if (!cleanup) {
  console.log(`\n${travadas.length} travada(s). rode com --cleanup pra marcar como erro.`);
  process.exit(0);
}

console.log(`\nmarcando ${travadas.length} como erro…`);
const { error: upErr } = await admin
  .from("historias")
  .update({
    status: "erro",
    erro: "A geração demorou demais e foi interrompida. Tente criar de novo.",
  })
  .in(
    "id",
    travadas.map((h) => h.id),
  );
if (upErr) {
  console.error("erro no update:", upErr.message);
  process.exit(1);
}
console.log("ok.");
