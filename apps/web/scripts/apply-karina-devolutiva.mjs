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

// Devolutiva da Karina (2026-05-17):
// - regulacao_emocional → emocional
// - transicoes → rotina
// - comportamento_e_limites → desativar (sem skill própria; coberto por outras)
// - meu_bem_estar → routing_priority=0 (skill da mãe, nunca roteada por LLM,
//   só acessível por entrada explícita no app)

const RENAMES = [
  { from: "regulacao_emocional", to: "emocional", display_name: "Emocional" },
  { from: "transicoes", to: "rotina", display_name: "Rotina" },
];

const DEACTIVATE = ["comportamento_e_limites"];

const PRIORITY_ZERO = ["meu_bem_estar"];

async function run() {
  console.log("== Aplicando devolutiva da Karina ==\n");

  // 1) Renames
  for (const r of RENAMES) {
    const { data, error } = await supabase
      .from("specialist_prompt_templates")
      .update({ name: r.to, display_name: r.display_name })
      .eq("name", r.from)
      .select("id, name, display_name");
    if (error) {
      console.error(`✗ Rename ${r.from} → ${r.to}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.warn(`⚠ Rename ${r.from} → ${r.to}: nenhuma linha encontrada`);
      continue;
    }
    console.log(`✓ Renamed ${r.from} → ${r.to} (${data.length} row)`);
  }

  // 2) Deactivate
  for (const name of DEACTIVATE) {
    const { data, error } = await supabase
      .from("specialist_prompt_templates")
      .update({ ativo: false })
      .eq("name", name)
      .select("id, name, ativo");
    if (error) {
      console.error(`✗ Deactivate ${name}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.warn(`⚠ Deactivate ${name}: nenhuma linha encontrada`);
      continue;
    }
    console.log(`✓ Deactivated ${name}`);
  }

  // 3) Priority zero (não-roteável)
  for (const name of PRIORITY_ZERO) {
    const { data, error } = await supabase
      .from("specialist_prompt_templates")
      .update({ routing_priority: 0 })
      .eq("name", name)
      .select("id, name, routing_priority");
    if (error) {
      console.error(`✗ Priority=0 ${name}:`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.warn(`⚠ Priority=0 ${name}: nenhuma linha encontrada`);
      continue;
    }
    console.log(`✓ ${name} routing_priority=0`);
  }

  // 4) Snapshot final
  console.log("\n== Estado final ==");
  const { data: skills, error } = await supabase
    .from("specialist_prompt_templates")
    .select("name, display_name, ativo, routing_priority")
    .order("routing_priority", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    console.error("✗ Snapshot:", error.message);
    process.exit(1);
  }
  for (const s of skills ?? []) {
    const flag = s.ativo ? "✓" : "✗";
    console.log(`  ${flag} ${s.name.padEnd(28)} prio=${s.routing_priority}  ${s.display_name ?? ""}`);
  }
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
