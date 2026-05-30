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

function idade(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const h = new Date();
  let a = h.getFullYear() - d.getFullYear();
  const m = h.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--;
  return a;
}

console.log("=== membros_atipicos ===");
const { data: membros } = await admin
  .from("membros_atipicos")
  .select("id, family_account_id, nome, data_nascimento, perfil, ativo, created_at")
  .order("created_at", { ascending: true });
for (const m of membros ?? [])
  console.log(`${m.nome.padEnd(12)} nasc=${m.data_nascimento} → ${idade(m.data_nascimento)} anos | fam=${m.family_account_id.slice(0,8)} ativo=${m.ativo}`);

console.log("\n=== family_profiles ===");
const { data: profs } = await admin
  .from("family_profiles")
  .select("family_account_id, nome_mae, data_nascimento_mae, papel");
for (const p of profs ?? [])
  console.log(`${(p.nome_mae ?? "").padEnd(28)} nasc_mae=${p.data_nascimento_mae} → ${idade(p.data_nascimento_mae)} anos | papel=${p.papel} | fam=${p.family_account_id.slice(0,8)}`);
