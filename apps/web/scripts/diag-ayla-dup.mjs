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

console.log("=== ayla_messages (últimas 20, com ms) ===");
const { data: msgs } = await supabase
  .from("ayla_messages")
  .select("created_at, direcao, tipo, texto, recebida_em")
  .order("created_at", { ascending: false })
  .limit(20);
for (const m of (msgs ?? []).reverse()) {
  console.log(`[${m.created_at}] ${m.direcao.padEnd(8)} ${(m.tipo ?? "-").padEnd(22)} ${(m.texto ?? "").replace(/\n/g, " ").slice(0, 55)}`);
}

console.log("\n=== ayla_send_log (últimos 12) ===");
const { data: log } = await supabase
  .from("ayla_send_log")
  .select("created_at, template_key, status, erro")
  .order("created_at", { ascending: false })
  .limit(12);
for (const l of (log ?? []).reverse()) console.log(`[${l.created_at}] ${l.status.padEnd(8)} ${l.template_key}${l.erro ? " ERRO:" + String(l.erro).slice(0, 80) : ""}`);

console.log("\n=== ayla_daily_checkins (últimos 5) ===");
const { data: checkins } = await supabase
  .from("ayla_daily_checkins")
  .select("created_at, date, confianca_parser, desafio_extraido")
  .order("created_at", { ascending: false })
  .limit(5);
if (!checkins?.length) console.log("(nenhum check-in)");
else for (const c of checkins) console.log(`[${c.created_at}] date=${c.date} conf=${c.confianca_parser} desafio=${JSON.stringify(c.desafio_extraido)}`);
