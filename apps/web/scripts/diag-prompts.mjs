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

console.log("=== ai_prompts (todas as chaves) ===");
const { data: prompts } = await supabase.from("ai_prompts").select("key, ativo, system_text").order("key");
for (const p of prompts ?? []) console.log(`- ${p.key} (ativo=${p.ativo}, ${p.system_text?.length ?? 0} chars)`);

console.log("\n=== ayla_message_templates (chaves no banco) ===");
const { data: tpls } = await supabase.from("ayla_message_templates").select("key, ativo, variations").order("key");
for (const t of tpls ?? []) console.log(`- ${t.key} (ativo=${t.ativo}, ${Array.isArray(t.variations) ? t.variations.length : 0} variações)`);
