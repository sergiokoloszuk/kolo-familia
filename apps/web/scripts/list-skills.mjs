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

const { data, error } = await supabase
  .from("specialist_prompt_templates")
  .select("name, display_name, ativo, routing_priority, routing_keywords")
  .order("ativo", { ascending: false })
  .order("routing_priority", { ascending: false });

if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}

for (const s of data) {
  const flag = s.ativo ? "✅ ATIVA " : "⛔ rascunho";
  const kws = (s.routing_keywords ?? []).join(", ");
  console.log(`${flag} [prio ${s.routing_priority}] ${s.display_name} (${s.name})`);
  console.log(`     keywords: ${kws || "(nenhuma)"}\n`);
}
console.log(`Total: ${data.length} · ativas: ${data.filter((s) => s.ativo).length}`);
