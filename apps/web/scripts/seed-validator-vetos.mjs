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

// Porta dos vetos hardcoded de validators.ts. Padrões idempotentes — se rodar
// 2x, não duplica (matching por padrao+categoria).
const VETOS = [
  // Performar empatia
  { categoria: "performar empatia", padrao: "\\bquerida m[ãa]e\\b", descricao: "Abertura genérica que poderia ser dada a qualquer mãe." },
  { categoria: "performar empatia", padrao: "\\bcompreendo perfeitamente\\b" },
  { categoria: "performar empatia", padrao: "\\bque situa[çc][ãa]o delicada\\b" },
  { categoria: "performar empatia", padrao: "\\bentendo perfeitamente sua (ang[úu]stia|dor|preocupa[çc][ãa]o)\\b" },
  // Clichês de maternidade
  { categoria: "clichê de maternidade", padrao: "\\bguerreira\\b" },
  { categoria: "clichê de maternidade", padrao: "\\bsuperm[ãa]e\\b" },
  { categoria: "clichê de maternidade", padrao: "\\bm[ãa]e (especial|top|incr[íi]vel)\\b" },
  { categoria: "clichê de maternidade", padrao: "\\b(mommy|mamis)\\b" },
  { categoria: "clichê de maternidade", padrao: "\\b(sua|minha) tribo\\b" },
  { categoria: "clichê de maternidade", padrao: "\\bsororidade\\b" },
  { categoria: "clichê de maternidade", padrao: "\\bvamos juntas\\b" },
  { categoria: "clichê de maternidade", padrao: "\\bjornada da maternidade\\b" },
  // Clichês corporativos
  { categoria: "clichê corporativo", padrao: "\\btransforma[çc][ãa]o\\b" },
  { categoria: "clichê corporativo", padrao: "\\brevolu[çc][ãa]o\\b" },
  { categoria: "clichê corporativo", padrao: "\\bdisruptiv[oa]\\b" },
  { categoria: "clichê corporativo", padrao: "\\bdestrave\\b" },
  { categoria: "clichê corporativo", padrao: "\\bdesbloqueie\\b" },
  // Palavrão
  { categoria: "palavrão", padrao: "\\bputa\\b" },
  { categoria: "palavrão", padrao: "\\bfoda\\b" },
  { categoria: "palavrão", padrao: "\\bporra\\b" },
  { categoria: "palavrão", padrao: "\\bcaralho\\b" },
  { categoria: "palavrão", padrao: "\\bcacete\\b" },
  // Nomes de método (case-sensitive nos siglas)
  { categoria: "nome de método", padrao: "\\bPNL\\b", flags: "", descricao: "Sigla de Programação Neurolinguística — não citar pra mãe." },
  { categoria: "nome de método", padrao: "\\bprograma[çc][ãa]o neurolingu[íi]stica\\b" },
  { categoria: "nome de método", padrao: "\\bjoe dispenza\\b" },
  { categoria: "nome de método", padrao: "\\bREAC\\b", flags: "" },
  // Autores de neurodivergência (lista em 1 regex pra eficiência)
  { categoria: "autor de neurodivergência", padrao: "\\b(siegel|bryson|greene|delahooke|prizant|grandin|shanker|barkley)\\b", descricao: "Autores não devem ser nomeados pra mãe; técnica entra dissolvida." },
];

console.log(`Seedando ${VETOS.length} vetos...\n`);

let ok = 0;
let skip = 0;
let erro = 0;

for (const v of VETOS) {
  // Verifica se já existe (idempotência)
  const { data: existing } = await supabase
    .from("ai_validator_vetos")
    .select("id")
    .eq("padrao", v.padrao)
    .eq("categoria", v.categoria)
    .maybeSingle();

  if (existing) {
    console.log(`⊙  já existe: [${v.categoria}] ${v.padrao}`);
    skip++;
    continue;
  }

  const { error } = await supabase.from("ai_validator_vetos").insert({
    categoria: v.categoria,
    padrao: v.padrao,
    flags: v.flags ?? "i",
    descricao: v.descricao ?? null,
    sugestao: "Reescreva sem essa expressão. O acolhimento mora na precisão da informação.",
    ativo: true,
    origem: "sistema",
  });

  if (error) {
    console.log(`❌  [${v.categoria}] ${v.padrao}: ${error.message}`);
    erro++;
  } else {
    console.log(`✅  [${v.categoria.padEnd(28)}] ${v.padrao}`);
    ok++;
  }
}

const { count } = await supabase
  .from("ai_validator_vetos")
  .select("id", { count: "exact", head: true });
console.log(`\nInseridos: ${ok}, já existiam: ${skip}, erros: ${erro}`);
console.log(`Total no DB: ${count}`);
