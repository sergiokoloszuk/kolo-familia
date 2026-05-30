import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Uso: node scripts/inspect-boas-praticas-deep.mjs <caminho-do-xlsx>");
  process.exit(1);
}

const wb = XLSX.read(readFileSync(resolve(filePath)), { type: "buffer" });

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (rows.length === 0) {
    console.log(`\n========== "${sheetName}" — VAZIA ==========`);
    continue;
  }
  const header = rows[0].map((h) => String(h).trim());
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));

  console.log(`\n========== "${sheetName}" — ${data.length} linhas de dados ==========`);
  console.log(`Header (${header.length}):`);
  header.forEach((h, i) => console.log(`  [${i}] ${h}`));

  // Para a sheet principal de BPs, faça análise detalhada
  if (header.includes("Skill principal") || header.includes("Skill")) {
    const skillIdx = header.indexOf("Skill principal") !== -1
      ? header.indexOf("Skill principal")
      : header.indexOf("Skill");
    const skillsSecIdx = header.indexOf("Skills secundárias");
    const faixaIdx = header.indexOf("Faixa etária");
    const versaoPassosIdx = header.indexOf("Versão passos");
    const atividadesIdx = header.indexOf("Atividades");
    const tagsIdx = header.indexOf("Tags");
    const perfisIdx = header.indexOf("Perfis aplicáveis");
    const origemIdx = header.indexOf("Origem");
    const statusIdx = header.indexOf("Status revisão Karina");
    const coerenciaIdx = header.indexOf("Coerência filosófica");

    // Skills distintas
    if (skillIdx !== -1) {
      const skills = new Set();
      for (const r of data) {
        const v = String(r[skillIdx] ?? "").trim();
        if (v) skills.add(v);
      }
      console.log(`\nSkill principal — ${skills.size} valores distintos:`);
      [...skills].sort().forEach((s) => console.log(`  - ${JSON.stringify(s)}`));
    }

    // Skills secundárias — formato
    if (skillsSecIdx !== -1) {
      const samples = data
        .map((r) => String(r[skillsSecIdx] ?? "").trim())
        .filter((v) => v !== "")
        .slice(0, 5);
      console.log(`\nSkills secundárias — ${samples.length > 0 ? "amostras:" : "todas vazias nas primeiras linhas"}`);
      samples.forEach((s) => console.log(`  - ${JSON.stringify(s)}`));
    }

    // Faixa etária
    if (faixaIdx !== -1) {
      const faixas = new Set();
      for (const r of data) {
        const v = String(r[faixaIdx] ?? "").trim();
        if (v) faixas.add(v);
      }
      console.log(`\nFaixa etária — ${faixas.size} valores distintos:`);
      [...faixas].sort().forEach((f) => console.log(`  - ${JSON.stringify(f)}`));
    }

    // Perfis aplicáveis
    if (perfisIdx !== -1) {
      const perfis = new Set();
      for (const r of data) {
        const v = String(r[perfisIdx] ?? "").trim();
        if (v) perfis.add(v);
      }
      console.log(`\nPerfis aplicáveis — ${perfis.size} valores distintos:`);
      [...perfis].sort().forEach((p) => console.log(`  - ${JSON.stringify(p)}`));
    }

    // Status revisão
    if (statusIdx !== -1) {
      const statuses = new Set();
      for (const r of data) {
        const v = String(r[statusIdx] ?? "").trim();
        if (v) statuses.add(v);
      }
      console.log(`\nStatus revisão Karina — ${statuses.size} valores distintos:`);
      [...statuses].sort().forEach((s) => console.log(`  - ${JSON.stringify(s)}`));
    }

    // Coerência filosófica
    if (coerenciaIdx !== -1) {
      const coes = new Set();
      for (const r of data) {
        const v = String(r[coerenciaIdx] ?? "").trim();
        if (v) coes.add(v);
      }
      console.log(`\nCoerência filosófica — ${coes.size} valores distintos:`);
      [...coes].sort().forEach((c) => console.log(`  - ${JSON.stringify(c)}`));
    }

    // Origem
    if (origemIdx !== -1) {
      const origens = new Set();
      for (const r of data) {
        const v = String(r[origemIdx] ?? "").trim();
        if (v) origens.add(v);
      }
      console.log(`\nOrigem — ${origens.size} valores distintos:`);
      [...origens].sort().forEach((o) => console.log(`  - ${JSON.stringify(o)}`));
    }

    // Tags — formato
    if (tagsIdx !== -1) {
      const samples = data
        .map((r) => String(r[tagsIdx] ?? "").trim())
        .filter((v) => v !== "")
        .slice(0, 5);
      console.log(`\nTags — amostras:`);
      samples.forEach((s) => console.log(`  - ${JSON.stringify(s)}`));
    }

    // Versão passos — formato (1 amostra completa)
    if (versaoPassosIdx !== -1) {
      const sample = data.find((r) => String(r[versaoPassosIdx] ?? "").trim() !== "");
      if (sample) {
        console.log(`\nVersão passos — amostra completa (1 linha):`);
        console.log("```");
        console.log(String(sample[versaoPassosIdx]));
        console.log("```");
      }
    }

    // Atividades — formato (1 amostra completa)
    if (atividadesIdx !== -1) {
      const sample = data.find((r) => String(r[atividadesIdx] ?? "").trim() !== "");
      if (sample) {
        console.log(`\nAtividades — amostra completa (1 linha):`);
        console.log("```");
        console.log(String(sample[atividadesIdx]));
        console.log("```");
      }
    }
  }
}
