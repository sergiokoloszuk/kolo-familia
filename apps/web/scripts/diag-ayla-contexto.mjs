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

console.log("=== membros (id, nome, nasc, perfil) ===");
const { data: membros } = await admin
  .from("membros_atipicos")
  .select("id, family_account_id, nome, data_nascimento, perfil");
for (const m of membros ?? [])
  console.log(`${m.nome.padEnd(12)} nasc=${m.data_nascimento} perfil=${m.perfil} fam=${m.family_account_id.slice(0, 8)} id=${m.id.slice(0, 8)}`);

console.log("\n=== perfil_vivo_membro (o que a Ayla puxaria) ===");
const { data: kv } = await admin
  .from("perfil_vivo_membro")
  .select("membro_atipico_id, essencial, como_e, corpo_rotina, desafios_regulacao, sensorial");
const nomePorId = new Map((membros ?? []).map((m) => [m.id, m.nome]));
for (const r of kv ?? []) {
  console.log(`\n--- ${nomePorId.get(r.membro_atipico_id) ?? r.membro_atipico_id.slice(0, 8)} ---`);
  for (const campo of ["essencial", "como_e", "corpo_rotina", "desafios_regulacao", "sensorial"]) {
    const v = r[campo];
    const texto = v ? JSON.stringify(v).slice(0, 200) : "(vazio)";
    console.log(`  ${campo}: ${texto}`);
  }
}
if (!kv?.length) console.log("(nenhuma linha em perfil_vivo_membro — Kolo Vivo vazio!)");
