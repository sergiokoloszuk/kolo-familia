import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: node scripts/inspect-boas-praticas-xlsx.mjs <caminho-do-xlsx>");
  process.exit(1);
}

const absPath = resolve(filePath);
const buf = readFileSync(absPath);
const wb = XLSX.read(buf, { type: "buffer" });

console.log("== Arquivo ==");
console.log("  Caminho:", absPath);
console.log("  Sheets:", wb.SheetNames);

const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

console.log(`\n== Sheet "${sheetName}" — ${rows.length} linhas (incluindo header) ==`);

if (rows.length === 0) {
  console.log("Sheet vazia.");
  process.exit(0);
}

const header = rows[0].map((h) => String(h).trim());
const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));

console.log(`  Header (${header.length} colunas):`);
header.forEach((h, i) => console.log(`    [${i}] ${JSON.stringify(h)}`));

console.log(`\n  Linhas de dados não-vazias: ${dataRows.length}`);

// === Comparação com schema esperado ===
const EXPECTED = [
  "titulo",
  "texto_original",
  "versao_curta",
  "versao_conversa",
  "passos_praticos",
  "quando_usar",
  "erros_comuns",
  "crencas_adulto",
  "atividades_praticas",
  "skills_relacionadas",
  "tags",
  "nivel",
  "faixa_etaria_min",
  "faixa_etaria_max",
  "perfis_aplicaveis",
  "status",
  "origem",
];

console.log("\n== Match com schema esperado ==");
const headerLower = header.map((h) => h.toLowerCase());
const expectedLower = EXPECTED.map((e) => e.toLowerCase());

const missing = EXPECTED.filter((e) => !headerLower.includes(e.toLowerCase()));
const extra = header.filter((h) => h && !expectedLower.includes(h.toLowerCase()));

if (missing.length === 0 && extra.length === 0) {
  console.log("  ✓ Header bate exatamente com os 17 campos esperados.");
} else {
  if (missing.length > 0) console.log(`  ✗ Faltando: ${missing.join(", ")}`);
  if (extra.length > 0) console.log(`  ⚠ Sobrando (não esperado): ${extra.join(", ")}`);
}

// === Amostra das 3 primeiras linhas ===
console.log("\n== Amostra das 3 primeiras linhas de dados ==");
dataRows.slice(0, 3).forEach((row, i) => {
  console.log(`\n  --- Linha ${i + 1} ---`);
  header.forEach((col, idx) => {
    const v = row[idx];
    const display =
      v === "" || v === undefined || v === null
        ? "(vazio)"
        : String(v).length > 120
          ? String(v).slice(0, 117) + "..."
          : String(v);
    console.log(`    ${col}: ${display}`);
  });
});

// === Detecção de formato dos campos jsonb (array) ===
const JSONB_FIELDS = [
  "passos_praticos",
  "atividades_praticas",
  "skills_relacionadas",
  "tags",
  "perfis_aplicaveis",
];

console.log("\n== Formato dos campos array (jsonb) ==");
for (const field of JSONB_FIELDS) {
  const colIdx = headerLower.indexOf(field.toLowerCase());
  if (colIdx === -1) {
    console.log(`  ${field}: COLUNA AUSENTE`);
    continue;
  }
  const samples = dataRows
    .slice(0, 20)
    .map((r) => r[colIdx])
    .filter((v) => v !== "" && v != null);
  if (samples.length === 0) {
    console.log(`  ${field}: todas as 20 primeiras linhas vazias`);
    continue;
  }
  const first = String(samples[0]);
  let formato = "DESCONHECIDO";
  if (first.startsWith("[") && first.endsWith("]")) formato = "JSON array literal";
  else if (first.includes(",")) formato = "lista separada por vírgula";
  else formato = "valor único / outro";
  console.log(`  ${field}: formato detectado = ${formato}`);
  console.log(`    amostra: ${JSON.stringify(first).slice(0, 140)}`);
}

// === Verifica skills antigas em skills_relacionadas ===
const skillsColIdx = headerLower.indexOf("skills_relacionadas");
if (skillsColIdx !== -1) {
  console.log("\n== Skills antigas em skills_relacionadas ==");
  const SKILLS_ANTIGAS = ["regulacao_emocional", "transicoes", "comportamento_e_limites"];
  const counts = Object.fromEntries(SKILLS_ANTIGAS.map((s) => [s, 0]));
  for (const r of dataRows) {
    const v = String(r[skillsColIdx] ?? "").toLowerCase();
    for (const s of SKILLS_ANTIGAS) {
      if (v.includes(s)) counts[s]++;
    }
  }
  for (const s of SKILLS_ANTIGAS) {
    if (counts[s] > 0) console.log(`  ⚠ "${s}" aparece em ${counts[s]} linhas`);
  }
  if (Object.values(counts).every((c) => c === 0)) {
    console.log("  ✓ Nenhum nome antigo encontrado.");
  }

  // Lista todas skills distintas mencionadas
  const todasSkills = new Set();
  for (const r of dataRows) {
    const v = String(r[skillsColIdx] ?? "");
    if (!v) continue;
    // Tenta parsear como JSON; fallback: split por vírgula
    let arr = null;
    try {
      arr = JSON.parse(v);
    } catch {
      arr = v.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }
    if (Array.isArray(arr)) for (const s of arr) if (s) todasSkills.add(String(s).trim());
  }
  console.log(`  Skills distintas mencionadas (${todasSkills.size}): ${[...todasSkills].sort().join(", ")}`);
}
