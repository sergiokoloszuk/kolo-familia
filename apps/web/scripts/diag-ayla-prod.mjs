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

console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL, "\n");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

console.log("=== ai_prompts: parser_ayla ===");
const { data: prompt } = await supabase
  .from("ai_prompts")
  .select("key, ativo, system_text")
  .eq("key", "parser_ayla");
if (!prompt?.length) console.log("(nenhum prompt parser_ayla no DB → usa fallback hardcoded)");
else for (const p of prompt) console.log(`ativo=${p.ativo} len=${p.system_text?.length ?? 0}\n--- system_text ---\n${(p.system_text ?? "").slice(0, 1500)}\n--- fim ---`);

console.log("\n=== membros_atipicos ativos por família ===");
const { data: membros } = await supabase
  .from("membros_atipicos")
  .select("family_account_id, nome, ativo")
  .eq("ativo", true);
const porFamilia = {};
for (const m of membros ?? []) (porFamilia[m.family_account_id] ??= []).push(m.nome);
for (const [fid, nomes] of Object.entries(porFamilia)) console.log(`${fid.slice(0, 8)}… → [${nomes.join(", ")}] (${nomes.length})`);

console.log("\n=== ayla_messages (últimas 12, ordem cronológica) ===");
const { data: msgs } = await supabase
  .from("ayla_messages")
  .select("created_at, direcao, tipo, texto")
  .order("created_at", { ascending: false })
  .limit(12);
for (const m of (msgs ?? []).reverse()) console.log(`[${m.created_at?.slice(11, 19)}] ${m.direcao.padEnd(8)} ${(m.tipo ?? "-").padEnd(22)} ${(m.texto ?? "").replace(/\n/g, " ").slice(0, 70)}`);

console.log("\n=== ayla_daily_checkins (últimos 5) ===");
const { data: checkins } = await supabase
  .from("ayla_daily_checkins")
  .select("date, confianca_parser, conquista_extraida, desafio_extraido, respondeu")
  .order("created_at", { ascending: false })
  .limit(5);
if (!checkins?.length) console.log("(nenhum check-in)");
else for (const c of checkins) console.log(`[${c.date}] conf=${c.confianca_parser} desafio=${JSON.stringify(c.desafio_extraido)} conquista=${JSON.stringify(c.conquista_extraida)}`);
