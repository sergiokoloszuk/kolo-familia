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

console.log("=== OPENAI key (local .env.local) ===");
const key = process.env.OPENAI_API_KEY;
console.log("OPENAI_API_KEY presente:", key ? `sim (${key.slice(0, 8)}…)` : "NÃO");
if (key) {
  // GET /v1/models é grátis — só valida a chave/billing/auth.
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  console.log("GET /v1/models →", r.status, r.statusText);
  if (!r.ok) console.log("corpo:", (await r.text()).slice(0, 300));
  else {
    const j = await r.json();
    const temDalle = (j.data ?? []).some((m) => m.id?.includes("dall-e-3"));
    console.log("dall-e-3 disponível na conta:", temDalle);
  }
}

console.log("\n=== avatares no banco (prod) ===");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: av, error } = await admin
  .from("avatares_membros_atipicos")
  .select("membro_atipico_id, estilo, imagem_url, descricao_textual, prompt_canonico");
if (error) console.log("erro lendo avatares:", error.message);
else if (!av?.length) console.log("(nenhum avatar salvo ainda)");
else {
  const { data: membros } = await admin.from("membros_atipicos").select("id, nome");
  const nomePorId = new Map((membros ?? []).map((m) => [m.id, m.nome]));
  for (const a of av) {
    console.log(`${(nomePorId.get(a.membro_atipico_id) ?? "?").padEnd(12)} estilo=${a.estilo} imagem=${a.imagem_url ? "sim" : "não"} desc=${a.descricao_textual ? "sim" : "não"}`);
  }
}
