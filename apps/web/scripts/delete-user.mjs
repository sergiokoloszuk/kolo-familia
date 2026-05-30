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

const email = process.argv[2];
if (!email) {
  console.error("uso: node scripts/delete-user.mjs <email>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let userId = null;
for (let page = 1; page <= 50; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("listUsers falhou:", error.message);
    process.exit(1);
  }
  const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) {
    userId = found.id;
    break;
  }
  if (data.users.length < 200) break;
}

if (!userId) {
  console.error(`Usuário ${email} não encontrado.`);
  process.exit(1);
}

console.log(`Deletando ${email} (id=${userId})...`);
const { error } = await supabase.auth.admin.deleteUser(userId);
if (error) {
  console.error("deleteUser falhou:", error.message);
  process.exit(1);
}
console.log("✅ Removido. family_accounts e descendentes caem via ON DELETE CASCADE.");
