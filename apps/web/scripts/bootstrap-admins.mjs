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

const TARGET_EMAILS = ["kkoloszuk@gmail.com", "sergiokoloszuk.sk@gmail.com"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const map = new Map();
for (let page = 1; page <= 50; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("listUsers:", error.message); process.exit(1); }
  for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
  if (data.users.length < 200) break;
}

for (const email of TARGET_EMAILS) {
  const id = map.get(email.toLowerCase());
  if (!id) {
    console.log(`⚠️  ${email} — sem signup ainda. Rode novamente após o signup.`);
    continue;
  }
  const { error } = await supabase
    .from("controle_acessos")
    .upsert(
      { user_id: id, role: "admin_geral", ativo: true },
      { onConflict: "user_id" },
    );
  if (error) console.log(`❌  ${email} → ${error.message}`);
  else console.log(`✅  ${email} → admin_geral ativo (user_id=${id})`);
}
