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

console.log("=== sugestao_perfil_vivos (10 mais recentes) ===");
const { data: sug, error: e1 } = await supabase
  .from("sugestao_perfil_vivos")
  .select("created_at, status, camada, campo, origem, texto_sugerido, membro_atipico_id")
  .order("created_at", { ascending: false })
  .limit(10);
if (e1) console.error("erro:", e1.message);
else if (!sug.length) console.log("(nenhuma linha)");
else for (const s of sug) console.log(`[${s.created_at}] ${s.status} ${s.camada}/${s.campo} (${s.origem}): ${s.texto_sugerido?.slice(0, 70)}`);

console.log("\n=== diarios (10 mais recentes) ===");
const { data: di, error: e2 } = await supabase
  .from("diarios")
  .select("created_at, data, origem, conquista, desafio, membro_atipico_id")
  .order("created_at", { ascending: false })
  .limit(10);
if (e2) console.error("erro:", e2.message);
else if (!di.length) console.log("(nenhuma linha)");
else for (const d of di) console.log(`[${d.created_at}] ${d.data} (${d.origem}) conq:${d.conquista?.slice(0,40) ?? "-"} | desaf:${d.desafio?.slice(0,40) ?? "-"}`);
