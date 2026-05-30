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

const email = process.argv[2] ?? "sergiokoloszuk.sk@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 1. Acha o user
let userId = null;
for (let page = 1; page <= 50; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) {
    userId = found.id;
    break;
  }
  if (data.users.length < 200) break;
}
if (!userId) {
  console.log(`❌ Usuário ${email} não existe`);
  process.exit(0);
}
console.log(`👤 user_id: ${userId}`);

// 2. family_account
const { data: family } = await supabase
  .from("family_accounts")
  .select("id, whatsapp_e164, onboarding_step, onboarding_completed")
  .eq("user_id", userId)
  .maybeSingle();
console.log("\n📋 family_accounts:", family);

if (!family) process.exit(0);

// 3. ayla_preferences (LGPD)
const { data: prefs } = await supabase
  .from("ayla_preferences")
  .select("consentimento_em, desativada, pausada_ate")
  .eq("family_account_id", family.id)
  .maybeSingle();
console.log("\n🔐 ayla_preferences:", prefs);

// 4. membros
const { data: membros } = await supabase
  .from("membros_atipicos")
  .select("id, nome, ativo")
  .eq("family_account_id", family.id);
console.log(`\n👶 membros: ${membros?.length ?? 0}`, membros);

// 5. profile (nome_mae)
const { data: profile } = await supabase
  .from("family_profiles")
  .select("nome_mae, como_chamar")
  .eq("family_account_id", family.id)
  .maybeSingle();
console.log("\n👩 family_profiles:", profile);

// 6. ayla_send_log
const { data: logs } = await supabase
  .from("ayla_send_log")
  .select("template_key, status, erro, resposta_provider, created_at")
  .eq("family_account_id", family.id)
  .order("created_at", { ascending: false });
console.log(`\n📨 ayla_send_log (${logs?.length ?? 0} rows):`);
for (const l of logs ?? []) console.log("  ", l);

// 7. ayla_messages
const { data: msgs } = await supabase
  .from("ayla_messages")
  .select("direcao, tipo, texto, created_at")
  .eq("family_account_id", family.id)
  .order("created_at", { ascending: false });
console.log(`\n💬 ayla_messages (${msgs?.length ?? 0} rows):`);
for (const m of msgs ?? []) {
  console.log(`   [${m.direcao}/${m.tipo}] ${m.texto?.slice(0, 60)}...`);
}

// 8. eventos_app (erros recentes)
const { data: erros } = await supabase
  .from("eventos_app")
  .select("severity, contexto, mensagem, created_at")
  .or(`family_account_id.eq.${family.id},family_account_id.is.null`)
  .in("severity", ["warn", "error", "fatal"])
  .order("created_at", { ascending: false })
  .limit(10);
console.log(`\n🚨 eventos_app warn/error (${erros?.length ?? 0}):`);
for (const e of erros ?? []) console.log("  ", e);
