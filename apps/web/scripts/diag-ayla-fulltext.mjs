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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await supabase
  .from("ayla_messages")
  .select("created_at, texto")
  .eq("direcao", "outbound")
  .eq("tipo", "resposta_registro")
  .order("created_at", { ascending: false })
  .limit(4);

for (const m of data ?? []) {
  const nParag = m.texto.split("\n\n").length;
  console.log("=".repeat(60));
  console.log(`[${m.created_at}] parágrafos(\\n\\n)=${nParag}  newlines=${(m.texto.match(/\n/g)||[]).length}`);
  console.log(JSON.stringify(m.texto));
}
