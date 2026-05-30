import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const NOVA = "1986-11-26"; // André (informado pelo Sérgio: 26/11/1986)

// Alvo seguro: o André cuja data está com a do pai (1962-09-20).
const { data: alvo } = await admin
  .from("membros_atipicos")
  .select("id, nome, data_nascimento, family_account_id")
  .eq("nome", "André")
  .eq("data_nascimento", "1962-09-20");

if (!alvo?.length) {
  console.log("Nenhum André com data 1962-09-20 encontrado (já corrigido?).");
} else if (alvo.length > 1) {
  console.log("Mais de um André com essa data — abortando por segurança:", alvo);
} else {
  const row = alvo[0];
  const { error } = await admin
    .from("membros_atipicos")
    .update({ data_nascimento: NOVA })
    .eq("id", row.id);
  if (error) console.log("ERRO:", error.message);
  else console.log(`✅ André (${row.id.slice(0,8)}) corrigido: 1962-09-20 → ${NOVA}`);
}

console.log("\n=== conferência ===");
const { data } = await admin.from("membros_atipicos").select("nome, data_nascimento").order("created_at");
function idade(iso){const d=new Date(iso+"T00:00:00");const h=new Date();let a=h.getFullYear()-d.getFullYear();const m=h.getMonth()-d.getMonth();if(m<0||(m===0&&h.getDate()<d.getDate()))a--;return a;}
for (const m of data ?? []) console.log(`${m.nome.padEnd(12)} ${m.data_nascimento} → ${idade(m.data_nascimento)} anos`);
