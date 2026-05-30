// ============================================================
// Importer das Boas Práticas curadas pela Karina (Fase 3).
//
// Lê um XLSX com 2 sheets ("BPs por skill" e "BPs transversais"),
// normaliza cada linha contra o schema atual de public.boas_praticas
// (após migrations 0017+0018) e faz UPSERT por codigo_externo.
//
// Uso:
//   node scripts/import-boas-praticas.mjs <caminho-xlsx> [--dry-run]
//
// --dry-run: parseia tudo, valida, imprime amostra e estatísticas,
//            mas NÃO escreve no banco. Use para iterar até zerar warnings.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// --- env loader (mesmo padrão dos outros scripts) ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const filePath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!filePath) {
  console.error("Uso: node scripts/import-boas-praticas.mjs <caminho-xlsx> [--dry-run]");
  process.exit(1);
}

// ============================================================
// Constantes — domínio
// ============================================================

const SKILL_DISPLAY_TO_TECH = {
  aprendizado: "aprendizado",
  autonomia: "autonomia",
  comunicacao: "comunicacao",
  "comunicação": "comunicacao",
  emocional: "emocional",
  foco: "foco",
  imitacao: "imitacao",
  "imitação": "imitacao",
  motor: "motor",
  nutricional: "nutricional",
  rotina: "rotina",
  sensorial: "sensorial",
  socializacao: "socializacao",
  "socialização": "socializacao",
  sono: "sono",
  "meu bem-estar": "meu_bem_estar",
  meu_bem_estar: "meu_bem_estar",
};

const SKILLS_VALIDAS = new Set([
  "sensorial", "emocional", "comunicacao", "rotina", "sono", "meu_bem_estar",
  "socializacao", "imitacao", "motor", "autonomia", "aprendizado", "foco", "nutricional",
]);

const PERFIS_VALIDOS = new Set(["TEA", "TDAH", "dislexia", "AHSD"]);

// Vetos absolutos óbvios — apenas como warning, não bloqueia
const VETOS_REGEX = [
  /\bquerida m[ãa]e\b/i,
  /\bjornada da maternidade\b/i,
  /\bsupermãe\b/i,
  /\bguerreira\b/i,
  /\bPNL\b/,
  /\bJoe Dispenza\b/i,
  /\bSiegel\b/,
  /\bBryson\b/,
  /\bGreene\b/,
  /\bDelahooke\b/,
  /\bPrizant\b/,
];

const VETO_FIELDS = ["texto_original", "versao_curta", "versao_conversa", "crencas_adulto", "erros_comuns"];

// ============================================================
// Normalizadores
// ============================================================

function normalizarSkill(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return SKILL_DISPLAY_TO_TECH[key] ?? null;
}

function parsearSkillsRelacionadas(skillPrincipal, skillsSecundarias) {
  const principal = normalizarSkill(skillPrincipal);
  const arr = principal ? [principal] : [];
  if (skillsSecundarias) {
    for (const s of String(skillsSecundarias).split(";")) {
      const norm = normalizarSkill(s);
      if (norm && !arr.includes(norm)) arr.push(norm);
    }
  }
  return arr;
}

// Faixa etária: extrai TODOS os intervalos e retorna {min, max}.
//   "0-12 meses (bebês)" → {min: 0, max: 1}
//   "1-3 anos (primeira infância)" → {min: 1, max: 3}
//   "4-6 anos; 7-12 anos" → {min: 4, max: 12}
function parsearFaixaEtaria(raw) {
  if (!raw) return { min: null, max: null };
  const text = String(raw);
  const min = [];
  const max = [];

  // padrão "X-Y meses" → meses convertidos pra anos (max 1)
  for (const m of text.matchAll(/(\d+)\s*-\s*(\d+)\s*meses/gi)) {
    min.push(Math.floor(Number(m[1]) / 12));
    max.push(Math.max(1, Math.ceil(Number(m[2]) / 12)));
  }
  // padrão "X-Y anos"
  for (const m of text.matchAll(/(\d+)\s*-\s*(\d+)\s*anos/gi)) {
    min.push(Number(m[1]));
    max.push(Number(m[2]));
  }

  if (min.length === 0) return { min: null, max: null };
  return { min: Math.min(...min), max: Math.max(...max) };
}

function parsearPerfis(raw) {
  if (!raw) return ["todos"];
  const items = String(raw).split(";").map((s) => s.trim()).filter(Boolean);
  // Se aparecer "qualquer perfil" ou "geral", já vira universal
  if (items.some((i) => /^(qualquer perfil|geral)$/i.test(i))) return ["todos"];

  const validos = [];
  for (const item of items) {
    // tenta match exato (case-insensitive) com PERFIS_VALIDOS
    for (const p of PERFIS_VALIDOS) {
      if (item.toLowerCase() === p.toLowerCase()) {
        if (!validos.includes(p)) validos.push(p);
      }
    }
  }
  return validos.length === 0 ? ["todos"] : validos;
}

function parsearTags(raw) {
  if (!raw) return [];
  return String(raw)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsearAtividades(raw) {
  if (!raw) return [];
  // Preferir split por "; " quando há semicolons; senão, frase única vira array de 1.
  const text = String(raw).trim();
  if (text === "") return [];
  if (text.includes(";")) {
    return text.split(";").map((s) => s.trim()).filter(Boolean);
  }
  return [text];
}

function parsearPassos(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*\d+[.)\]]?\s*/, "").trim())
    .filter(Boolean);
}

function gerarTitulo(versaoCurta) {
  if (!versaoCurta) return null;
  const palavras = String(versaoCurta).trim().split(/\s+/);
  if (palavras.length <= 10) return palavras.join(" ");
  return palavras.slice(0, 10).join(" ") + "…";
}

function detectarVetos(row) {
  const hits = [];
  for (const f of VETO_FIELDS) {
    const v = row[f];
    if (!v) continue;
    const text = String(v);
    for (const rx of VETOS_REGEX) {
      if (rx.test(text)) {
        hits.push({ field: f, pattern: rx.source });
      }
    }
  }
  return hits;
}

// ============================================================
// Leitura do XLSX
// ============================================================

const absPath = resolve(filePath);
console.log(`\n== Lendo XLSX: ${absPath} ==\n`);
const wb = XLSX.read(readFileSync(absPath), { type: "buffer" });

const SHEETS_BPS = ["BPs por skill", "BPs transversais"];
const COL = {
  ID: "ID",
  SKILL_PRINCIPAL: "Skill principal",
  SKILLS_SEC: "Skills secundárias",
  FAIXA: "Faixa etária",
  ORIENTACAO: "Orientação",
  QUANDO: "Quando usar",
  ERROS: "Erros comuns",
  CRENCAS: "Crenças do adulto",
  ATIV: "Atividades",
  ORIGEM: "Origem",
  VCURTA: "Versão curta",
  VCONVERSA: "Versão conversa",
  VPASSOS: "Versão passos",
  PERFIS: "Perfis aplicáveis",
  TAGS: "Tags",
};

function pickColumns(header) {
  const map = {};
  for (const [k, name] of Object.entries(COL)) {
    map[k] = header.indexOf(name);
  }
  return map;
}

const allRows = [];
const warnings = [];

for (const sheetName of SHEETS_BPS) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`⚠ Sheet "${sheetName}" não encontrada — pulando.`);
    continue;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) continue;
  const header = rows[0].map((h) => String(h).trim());
  const idx = pickColumns(header);

  // Confere colunas mínimas
  const missing = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
  if (missing.length > 0) {
    console.warn(`⚠ Sheet "${sheetName}": colunas faltando: ${missing.join(", ")}`);
  }

  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const get = (col) => (idx[col] === -1 ? "" : String(r[idx[col]] ?? "").trim());

    const codigo = get("ID");
    const skillPrincipal = get("SKILL_PRINCIPAL");
    const skillsSec = get("SKILLS_SEC");
    const orientacao = get("ORIENTACAO");
    const versaoCurta = get("VCURTA");

    if (!codigo) {
      warnings.push({ sheet: sheetName, row: i + 2, msg: "ID vazio — linha pulada" });
      continue;
    }

    const skills = parsearSkillsRelacionadas(skillPrincipal, skillsSec);
    if (skills.length === 0) {
      warnings.push({ sheet: sheetName, row: i + 2, codigo, msg: `Skill principal "${skillPrincipal}" não mapeia para nenhuma skill técnica` });
    } else {
      const invalidas = skills.filter((s) => !SKILLS_VALIDAS.has(s));
      if (invalidas.length > 0) {
        warnings.push({ sheet: sheetName, row: i + 2, codigo, msg: `Skills inválidas: ${invalidas.join(", ")}` });
      }
    }

    const { min, max } = parsearFaixaEtaria(get("FAIXA"));

    const bp = {
      codigo_externo: codigo,
      titulo: gerarTitulo(versaoCurta) ?? gerarTitulo(orientacao),
      texto_original: orientacao || versaoCurta || null,
      versao_curta: versaoCurta || null,
      versao_conversa: get("VCONVERSA") || null,
      passos_praticos: parsearPassos(get("VPASSOS")),
      quando_usar: get("QUANDO") || null,
      erros_comuns: get("ERROS") || null,
      crencas_adulto: get("CRENCAS") || null,
      atividades_praticas: parsearAtividades(get("ATIV")),
      skills_relacionadas: skills,
      tags: parsearTags(get("TAGS")),
      nivel: null,
      faixa_etaria_min: min,
      faixa_etaria_max: max,
      perfis_aplicaveis: parsearPerfis(get("PERFIS")),
      status: "rascunho",
      origem: "admin",
      referencia_bibliografica: get("ORIGEM") || null,
    };

    // Vetos absolutos
    const vetoHits = detectarVetos(bp);
    if (vetoHits.length > 0) {
      warnings.push({
        sheet: sheetName,
        row: i + 2,
        codigo,
        msg: `Veto absoluto bate em ${vetoHits.length} campo(s): ${vetoHits.map((h) => `${h.field}(${h.pattern})`).join("; ")}`,
      });
    }

    allRows.push({ _sheet: sheetName, _row: i + 2, ...bp });
  }
}

// ============================================================
// Sanity check: codigos duplicados na própria planilha
// ============================================================
const codigoCount = new Map();
for (const r of allRows) {
  codigoCount.set(r.codigo_externo, (codigoCount.get(r.codigo_externo) ?? 0) + 1);
}
const duplicados = [...codigoCount.entries()].filter(([, c]) => c > 1);
if (duplicados.length > 0) {
  for (const [codigo, count] of duplicados) {
    warnings.push({ msg: `Código duplicado na planilha: "${codigo}" aparece ${count} vezes` });
  }
}

// ============================================================
// Relatório
// ============================================================
console.log(`== Estatísticas ==`);
console.log(`  Total parseado: ${allRows.length} BPs`);

const porSkill = {};
for (const r of allRows) {
  const principal = r.skills_relacionadas[0] ?? "(sem skill)";
  porSkill[principal] = (porSkill[principal] ?? 0) + 1;
}
console.log(`  Por skill principal:`);
for (const [s, c] of Object.entries(porSkill).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${s.padEnd(18)} ${c}`);
}

const semFaixa = allRows.filter((r) => r.faixa_etaria_min === null).length;
const semVersaoConversa = allRows.filter((r) => !r.versao_conversa).length;
const semPassos = allRows.filter((r) => r.passos_praticos.length === 0).length;
console.log(`\n  Sem faixa etária parseável: ${semFaixa}`);
console.log(`  Sem versao_conversa: ${semVersaoConversa}`);
console.log(`  Sem passos_praticos: ${semPassos}`);

console.log(`\n== Warnings: ${warnings.length} ==`);
for (const w of warnings.slice(0, 20)) {
  const loc = w.codigo ? `[${w.codigo}@${w.sheet}:${w.row}]` : "[geral]";
  console.log(`  ${loc} ${w.msg}`);
}
if (warnings.length > 20) console.log(`  ... e mais ${warnings.length - 20} warnings`);

console.log(`\n== Amostra (2 BPs parseadas) ==`);
for (const r of allRows.slice(0, 2)) {
  const { _sheet, _row, ...clean } = r;
  console.log(`\n--- ${clean.codigo_externo} (sheet "${_sheet}", linha ${_row}) ---`);
  console.log(JSON.stringify(clean, null, 2));
}

// Grava relatório completo em arquivo
const reportsDir = resolve(__dirname, "reports");
mkdirSync(reportsDir, { recursive: true });
const reportPath = resolve(reportsDir, `import-${Date.now()}-${dryRun ? "dryrun" : "live"}.json`);
writeFileSync(reportPath, JSON.stringify({
  source: absPath,
  total: allRows.length,
  warnings,
  porSkill,
  rows: allRows.map(({ _sheet, _row, ...rest }) => rest),
}, null, 2));
console.log(`\nRelatório completo gravado em: ${reportPath}`);

// ============================================================
// Persistência (apenas se NÃO for dry-run)
// ============================================================
if (dryRun) {
  console.log(`\n== DRY-RUN — nenhuma escrita no DB. ==`);
  process.exit(0);
}

console.log(`\n== Escrevendo no DB (upsert por codigo_externo) ==`);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CHUNK = 50;
let inserted = 0;
let errors = 0;
const payload = allRows.map(({ _sheet, _row, ...rest }) => rest);

for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const { data, error } = await supabase
    .from("boas_praticas")
    .upsert(chunk, { onConflict: "codigo_externo" })
    .select("id, codigo_externo");
  if (error) {
    errors += chunk.length;
    console.error(`  ✗ Chunk ${i}-${i + chunk.length - 1}: ${error.message}`);
    continue;
  }
  inserted += data?.length ?? 0;
  process.stdout.write(`\r  ${inserted}/${payload.length} processadas...`);
}
console.log(`\n\n✓ Importadas: ${inserted}`);
console.log(`✗ Erros: ${errors}`);
console.log(`Status: todas entram como 'rascunho'. Karina revisa em /admin/boas-praticas.`);
