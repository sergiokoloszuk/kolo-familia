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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log("URL:", url);
console.log("anon key:", anon ? anon.slice(0, 12) + "…" : "(FALTANDO)", "\n");

// Cliente ANÔNIMO (sem sessão) — simula um estranho/outra família sem login.
// Com RLS ligado, as políticas são "to authenticated" com escopo por família,
// então o role anon NÃO deve ver NENHUMA linha das tabelas sensíveis.
const anonClient = createClient(url, anon, { auth: { persistSession: false } });

// Service role (bypassa RLS) — só pra saber QUANTAS linhas existem de verdade,
// e assim provar que o anon ver 0 é RLS funcionando (não tabela vazia).
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TABELAS = [
  "family_accounts",
  "family_profiles",
  "membros_atipicos",
  "perfil_vivo_membro",
  "perfil_vivo_familia",
  "diarios",
  "ayla_messages",
  "ayla_daily_checkins",
  "conversas",
  "mensagens_skill",
  "dass21_aplicacoes",
];

console.log("tabela".padEnd(24), "anon vê".padStart(9), "  existem(real)", "  veredito");
console.log("-".repeat(70));
let vazamentos = 0;
for (const t of TABELAS) {
  const a = await anonClient.from(t).select("*", { count: "exact" }).limit(5);
  const s = await admin.from(t).select("*", { count: "exact", head: true });
  const anonRows = a.error ? `ERRO` : (a.count ?? a.data?.length ?? 0);
  const realRows = s.count ?? "?";
  let veredito;
  if (a.error) {
    veredito = `🔒 bloqueado (${a.error.code ?? a.error.message?.slice(0, 30)})`;
  } else if ((a.count ?? a.data?.length ?? 0) > 0) {
    veredito = "🚨 VAZAMENTO — anon leu dados!";
    vazamentos++;
  } else {
    veredito = "✅ ok (0 linhas pro anon)";
  }
  console.log(String(t).padEnd(24), String(anonRows).padStart(9), String(realRows).padStart(14), " ", veredito);
}
console.log("-".repeat(70));
console.log(vazamentos === 0 ? "\n✅ Nenhum vazamento pelo anon: RLS está protegendo as tabelas." : `\n🚨 ${vazamentos} tabela(s) VAZANDO pro anon — RLS desligado ou sem policy!`);
