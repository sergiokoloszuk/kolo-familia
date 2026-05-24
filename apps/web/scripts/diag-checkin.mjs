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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: fam } = await supabase
  .from("family_accounts")
  .select("id")
  .limit(1)
  .maybeSingle();
if (!fam) {
  console.log("sem família");
  process.exit(0);
}
const { data: membro } = await supabase
  .from("membros_atipicos")
  .select("id")
  .eq("family_account_id", fam.id)
  .limit(1)
  .maybeSingle();

const DATA = "2099-01-01"; // data sentinela; limpamos depois

console.log("Testando upsert com onConflict='family_account_id,membro_atipico_id,data' (com membro)...");
const r1 = await supabase.from("check_ins_diarios").upsert(
  {
    family_account_id: fam.id,
    membro_atipico_id: membro?.id ?? null,
    data: DATA,
    escala_emocional_mae: "bem",
    origem: "app",
  },
  { onConflict: "family_account_id,membro_atipico_id,data" },
);
console.log(r1.error ? `❌ ${r1.error.code} — ${r1.error.message}` : "✅ ok");

console.log("\nTestando upsert com membro NULL...");
const r2 = await supabase.from("check_ins_diarios").upsert(
  {
    family_account_id: fam.id,
    membro_atipico_id: null,
    data: DATA,
    escala_emocional_mae: "bem",
    origem: "app",
  },
  { onConflict: "family_account_id,membro_atipico_id,data" },
);
console.log(r2.error ? `❌ ${r2.error.code} — ${r2.error.message}` : "✅ ok");

// limpeza das sentinelas que porventura tenham entrado
await supabase.from("check_ins_diarios").delete().eq("family_account_id", fam.id).eq("data", DATA);
console.log("\n(sentinelas limpas)");
