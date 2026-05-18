/**
 * Relatório de qualidade pós-backfill (e contínuo) de `ayla_eventos_longitudinais`.
 *
 * Resposta ao pedido da Karina:
 *   - quantidade de eventos gerados
 *   - categorias
 *   - períodos cobertos
 *   - falhas (eventos com source mas sem dados consistentes)
 *   - duplicidades evitadas (eventos com mesmo source_key — não deveria ter)
 *
 * Uso:
 *   node apps/web/scripts/ayla-eventos-stats.mjs [--json]
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env.local",
);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const JSON_OUT = process.argv.includes("--json");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const log = JSON_OUT ? () => {} : console.log;
const out = {};

log("\n=== Ayla Eventos Longitudinais — Stats ===\n");

// 1. Volume total
const { count: total } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("id", { count: "exact", head: true });
out.total_eventos = total ?? 0;
log(`Total de eventos: ${out.total_eventos}`);

// 2. Eventos por source
const { data: porSource } = await supabase.rpc("ayla_eventos_stats_source", {});
// fallback (se RPC não existir): agregação manual
if (!porSource) {
  const { data: sample } = await supabase
    .from("ayla_eventos_longitudinais")
    .select("metadados")
    .not("source_key", "is", null)
    .limit(10000);
  const contagem = {};
  for (const row of sample ?? []) {
    const src = row.metadados?.source ?? "(sem source)";
    contagem[src] = (contagem[src] ?? 0) + 1;
  }
  out.por_source = contagem;
} else {
  out.por_source = Object.fromEntries(
    (porSource ?? []).map((r) => [r.source, r.count]),
  );
}
log("\nPor source (origem):");
for (const [src, n] of Object.entries(out.por_source).sort(
  (a, b) => b[1] - a[1],
)) {
  log(`  ${src.padEnd(25)} ${n}`);
}

// 3. Eventos por tipo
const tipos = [
  "conversa_turno",
  "check_in_resposta",
  "crise_relatada",
  "meltdown_relatado",
  "shutdown_relatado",
  "conquista_relatada",
  "melhora_relatada",
  "regressao_observada",
  "sensibilidade_evidenciada",
  "hiperfoco_evidenciado",
  "preferencia_revelada",
  "mudanca_observada",
  "mudanca_fase",
  "estrategia_testada",
  "follow_up_resposta",
  "registro_explicito",
];
out.por_tipo = {};
log("\nPor tipo:");
for (const tipo of tipos) {
  const { count } = await supabase
    .from("ayla_eventos_longitudinais")
    .select("id", { count: "exact", head: true })
    .eq("tipo", tipo);
  if ((count ?? 0) > 0) {
    out.por_tipo[tipo] = count;
    log(`  ${tipo.padEnd(28)} ${count}`);
  }
}

// 4. Eventos por dominio (precisa expandir array)
const { data: sampleDom } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("dominios")
  .limit(20000);
const contagemDom = {};
for (const row of sampleDom ?? []) {
  for (const dom of row.dominios ?? []) {
    contagemDom[dom] = (contagemDom[dom] ?? 0) + 1;
  }
}
out.por_dominio = contagemDom;
log("\nPor domínio (entre os primeiros 20k eventos):");
for (const [dom, n] of Object.entries(contagemDom).sort(
  (a, b) => b[1] - a[1],
)) {
  log(`  ${dom.padEnd(28)} ${n}`);
}

// 5. Janelas temporais
const agora = new Date();
const janelas = [
  { nome: "ultimos_7d", offset_dias: 7 },
  { nome: "ultimos_30d", offset_dias: 30 },
  { nome: "ultimos_90d", offset_dias: 90 },
  { nome: "ultimos_6m", offset_dias: 180 },
  { nome: "ultimos_12m", offset_dias: 365 },
];
out.por_janela = {};
log("\nVolume por janela temporal:");
for (const j of janelas) {
  const ini = new Date(agora);
  ini.setDate(ini.getDate() - j.offset_dias);
  const { count } = await supabase
    .from("ayla_eventos_longitudinais")
    .select("id", { count: "exact", head: true })
    .gte("ocorreu_em", ini.toISOString());
  out.por_janela[j.nome] = count ?? 0;
  log(`  ${j.nome.padEnd(20)} ${count}`);
}

// 6. Período coberto (data do mais antigo e mais recente)
const { data: maisAntigo } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("ocorreu_em")
  .order("ocorreu_em", { ascending: true })
  .limit(1)
  .maybeSingle();
const { data: maisRecente } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("ocorreu_em")
  .order("ocorreu_em", { ascending: false })
  .limit(1)
  .maybeSingle();
out.periodo_coberto = {
  mais_antigo: maisAntigo?.ocorreu_em ?? null,
  mais_recente: maisRecente?.ocorreu_em ?? null,
};
log(
  `\nPeríodo coberto: ${out.periodo_coberto.mais_antigo ?? "—"}  →  ${out.periodo_coberto.mais_recente ?? "—"}`,
);

// 7. Falhas e duplicidades — sanity checks
// 7a. Eventos com source mas sem source_id (ETL malformado)
const { count: malformados } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("id", { count: "exact", head: true })
  .not("metadados->>source", "is", null)
  .is("metadados->>source_id", null);
out.malformados = malformados ?? 0;

// 7b. Eventos sem texto_livre E sem domínios (registro vazio)
const { count: vazios } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("id", { count: "exact", head: true })
  .is("texto_livre", null)
  .eq("dominios", "{}");
out.eventos_vazios = vazios ?? 0;

log("\nSanity checks:");
log(`  malformados (source sem source_id): ${out.malformados}`);
log(`  eventos sem texto e sem domínio:    ${out.eventos_vazios}`);

// 7c. Duplicidades: source_key UNIQUE constraint deveria garantir 0
// Verificação adicional contando duplicate por (source, source_id, campo)
const { data: dupSample } = await supabase
  .from("ayla_eventos_longitudinais")
  .select("source_key")
  .not("source_key", "is", null)
  .limit(10000);
const seen = new Map();
let duplicados = 0;
for (const row of dupSample ?? []) {
  const c = (seen.get(row.source_key) ?? 0) + 1;
  if (c > 1) duplicados++;
  seen.set(row.source_key, c);
}
out.duplicidades_detectadas = duplicados;
log(`  duplicidades em source_key:          ${duplicados} (esperado: 0)`);

log("\n========================================");

if (JSON_OUT) {
  console.log(JSON.stringify(out, null, 2));
}
