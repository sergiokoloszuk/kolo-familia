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

const ERRADA = "2099-12-31"; // placeholder; substituído abaixo
const DE = "2026-05-24";
const PARA = "2026-05-23";
void ERRADA;

// Hoje é 23/05 no Brasil — qualquer registro em 24/05 é artefato do bug de fuso.
for (const tabela of ["diarios", "check_ins_diarios"]) {
  const { data: antes } = await supabase.from(tabela).select("id").eq("data", DE);
  const n = antes?.length ?? 0;
  if (n === 0) {
    console.log(`${tabela}: nada em ${DE}.`);
    continue;
  }
  const { error } = await supabase.from(tabela).update({ data: PARA }).eq("data", DE);
  console.log(error ? `${tabela}: ERRO ${error.message}` : `${tabela}: ${n} registro(s) ${DE} → ${PARA}.`);
}
