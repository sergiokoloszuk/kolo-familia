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
const newPassword = process.argv[3];
if (!email || !newPassword) {
  console.error("uso: node scripts/reset-password.mjs <email> <senha>");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// Acha o user
let user = null;
for (let page = 1; page <= 50; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) break;
  if (data.users.length < 200) break;
}
if (!user) { console.error(`User ${email} não encontrado`); process.exit(1); }

const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
if (error) { console.error("updateUserById erro:", error.message); process.exit(1); }
console.log(`✅ Senha atualizada pra ${email}`);

// Valida o sign-in via anon
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const { data: signin, error: signErr } = await anon.auth.signInWithPassword({ email, password: newPassword });
if (signErr) console.error("⚠️ sign-in falhou:", signErr.message);
else console.log("✅ sign-in OK via Supabase anon — user_id:", signin.user.id);
