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

console.log("=== ayla_send_log (últimos 10) ===");
const { data: log } = await supabase
  .from("ayla_send_log")
  .select("created_at, template_key, status, erro")
  .order("created_at", { ascending: false })
  .limit(10);
if (!log?.length) console.log("(nenhum envio registrado)");
else for (const l of log) console.log(`[${l.created_at}] ${l.status} ${l.template_key}${l.erro ? " ERRO: " + String(l.erro).slice(0, 120) : ""}`);

console.log("\n=== ayla_messages (últimas 10) ===");
const { data: msgs } = await supabase
  .from("ayla_messages")
  .select("created_at, direcao, tipo, texto, enviada_em, recebida_em")
  .order("created_at", { ascending: false })
  .limit(10);
if (!msgs?.length) console.log("(nenhuma mensagem)");
else for (const m of msgs) console.log(`[${m.created_at}] ${m.direcao} ${m.tipo ?? ""} ${(m.texto ?? "").slice(0, 60)}`);

console.log("\n=== ayla_preferences (consentimento) ===");
const { count: total } = await supabase.from("ayla_preferences").select("family_account_id", { count: "exact", head: true });
const { count: comConsent } = await supabase.from("ayla_preferences").select("family_account_id", { count: "exact", head: true }).not("consentimento_em", "is", null);
const { count: ativas } = await supabase.from("ayla_preferences").select("family_account_id", { count: "exact", head: true }).eq("desativada", false);
console.log(`famílias com prefs: ${total} · com consentimento: ${comConsent} · não-desativadas: ${ativas}`);
