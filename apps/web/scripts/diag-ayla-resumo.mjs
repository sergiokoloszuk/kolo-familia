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
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// réplica do resumoCampoKV novo
function resumoCampoKV(o) {
  if (!o || typeof o !== "object") return "";
  const partes = [];
  if (typeof o.texto === "string" && o.texto.trim()) partes.push(o.texto.trim());
  for (const k of ["interesses", "desafios_iniciais"]) {
    const v = o[k];
    if (Array.isArray(v)) {
      const itens = v.filter((x) => typeof x === "string" && x.trim());
      if (itens.length) partes.push(itens.join(", "));
    }
  }
  if (typeof o.conquista_inicial === "string" && o.conquista_inicial.trim()) partes.push(o.conquista_inicial.trim());
  return partes.join(" · ");
}

const labels = {
  essencial: "O essencial",
  como_e: "Como é / interesses",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios e regulação",
  sensorial: "Sensorial",
};

const { data: membros } = await admin.from("membros_atipicos").select("id, nome");
const { data: kv } = await admin
  .from("perfil_vivo_membro")
  .select("membro_atipico_id, essencial, como_e, corpo_rotina, desafios_regulacao, sensorial");
const nome = new Map((membros ?? []).map((m) => [m.id, m.nome]));

for (const r of kv ?? []) {
  const linhas = [];
  for (const [campo, label] of Object.entries(labels)) {
    const resumo = resumoCampoKV(r[campo]);
    if (resumo) linhas.push(`  ${label}: ${resumo}`);
  }
  console.log(`\n=== ${nome.get(r.membro_atipico_id) ?? "?"} — o que a Ayla agora enxerga ===`);
  console.log(linhas.length ? linhas.join("\n") : "  (ainda vazio)");
}
