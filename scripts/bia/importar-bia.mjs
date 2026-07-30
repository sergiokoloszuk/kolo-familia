#!/usr/bin/env node
/**
 * IMPORTER DA BIA — .docx → chunks → SQL.
 *
 * Esta etapa é INFRAESTRUTURA: o importer prepara o conteúdo, nada mais. Nenhum
 * prompt, resposta, plano ou PDF é tocado. A tabela `bia_chunks` (migração
 * 0071) existe para ser preenchida e ficar esperando.
 *
 * POR QUE ELE GERA SQL EM VEZ DE ESCREVER NO BANCO:
 * 1. É assim que migração chega em produção aqui — SQL revisável, aplicado por
 *    fora, nunca por um script que abre conexão sozinho. O Supabase é
 *    self-hosted e já teve incidente de perda de dados; escrita automática num
 *    banco assim é risco desnecessário.
 * 2. Zero dependência: este script não precisa do @supabase/supabase-js, não
 *    mexe em package.json e roda com o Node puro do ambiente.
 * 3. O SQL é auditável ANTES de rodar — dá pra ler o que vai entrar.
 *
 * USO
 *   node scripts/bia/importar-bia.mjs --arquivo "C:/.../BIA.docx" --versao 2026-07-30
 *       → modo seco: extrai, fatia, imprime estatísticas. NÃO escreve nada.
 *
 *   node scripts/bia/importar-bia.mjs --arquivo "..." --versao 2026-07-30 --json out.json
 *       → grava os chunks em JSON pra inspeção/revisão.
 *
 *   node scripts/bia/importar-bia.mjs --arquivo "..." --versao 2026-07-30 --sql out.sql
 *       → gera o INSERT idempotente (ON CONFLICT (hash) DO NOTHING).
 *
 *   --texto arquivo.txt   usa um .txt já extraído em vez do .docx
 *   --limite N            só os N primeiros chunks (pra inspecionar rápido)
 */

import { writeFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { lerDocx } from "./docx.mjs";
import { chunkificar, estatisticas } from "./chunker.mjs";

// ============================================================
// Argumentos
// ============================================================

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const chave = a.slice(2);
    const valor = argv[i + 1];
    if (valor && !valor.startsWith("--")) {
      out[chave] = valor;
      i++;
    } else {
      out[chave] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (!args.arquivo && !args.texto) {
  console.error(
    [
      "Falta a entrada.",
      "",
      '  node scripts/bia/importar-bia.mjs --arquivo "C:/caminho/BIA.docx" --versao 2026-07-30',
      "",
      "Opcionais: --json saida.json | --sql saida.sql | --texto ja-extraido.txt | --limite 50",
    ].join("\n"),
  );
  process.exit(1);
}

const versao = typeof args.versao === "string" ? args.versao : new Date().toISOString().slice(0, 10);

// ============================================================
// 1. Entrada
// ============================================================

let texto;
let documento;

if (args.texto) {
  documento = basename(String(args.texto));
  texto = readFileSync(String(args.texto), "utf8");
  console.log(`Texto lido de ${documento} — ${texto.length.toLocaleString("pt-BR")} caracteres`);
} else {
  documento = basename(String(args.arquivo));
  texto = lerDocx(String(args.arquivo));
  console.log(`Docx lido: ${documento} — ${texto.length.toLocaleString("pt-BR")} caracteres`);
}

// ============================================================
// 2. Chunking
// ============================================================

let chunks = chunkificar(texto, {
  documento_origem: documento,
  versao_documento: versao,
});

if (args.limite) {
  chunks = chunks.slice(0, Number(args.limite));
}

// ============================================================
// 3. Relatório
// ============================================================

const stats = estatisticas(chunks);

console.log("\n" + "=".repeat(58));
console.log("  BIA — relatório da importação");
console.log("=".repeat(58));
console.log(`  documento .......... ${documento}`);
console.log(`  versão ............. ${versao}`);
console.log(`  chunks ............. ${stats.total}`);
console.log(`  hashes duplicados .. ${stats.duplicados}`);
console.log(`  revisão pendente ... ${stats.revisao_pendente}`);
console.log(`  com faixa etária ... ${stats.com_faixa_etaria}`);
console.log(`  palavras (média) ... ${stats.palavras_media}`);

console.log("\n  Por núcleo:");
for (const [k, v] of Object.entries(stats.por_nucleo)) {
  console.log(`    ${String(v).padStart(5)}  ${k}`);
}
console.log("\n  Por tipo de conhecimento:");
for (const [k, v] of Object.entries(stats.por_tipo)) {
  console.log(`    ${String(v).padStart(5)}  ${k}`);
}
console.log("\n  Por nível de cautela:");
for (const [k, v] of Object.entries(stats.por_cautela)) {
  console.log(`    ${String(v).padStart(5)}  ${k}`);
}

// Avisos — o que merece olho humano antes de virar conhecimento ativo.
const avisos = [];
if (stats.revisao_pendente > 0) {
  avisos.push(
    `${stats.revisao_pendente} chunk(s) com revisao_pendente=true. Não devem chegar a nenhum prompt sem revisão.`,
  );
}
if (stats.duplicados > 0) {
  avisos.push(`${stats.duplicados} hash(es) repetido(s) — o ON CONFLICT vai ignorar as repetições.`);
}
const semFaixa = stats.total - stats.com_faixa_etaria;
if (semFaixa > 0) {
  avisos.push(`${semFaixa} chunk(s) sem faixa etária — servem para qualquer idade na recuperação.`);
}
if (avisos.length > 0) {
  console.log("\n  Avisos:");
  for (const a of avisos) console.log(`    • ${a}`);
}
console.log("=".repeat(58) + "\n");

// ============================================================
// 4. Saídas
// ============================================================

if (args.json) {
  writeFileSync(String(args.json), JSON.stringify(chunks, null, 2), "utf8");
  console.log(`JSON gravado em ${args.json}`);
}

if (args.sql) {
  writeFileSync(String(args.sql), gerarSql(chunks, { documento, versao, stats }), "utf8");
  console.log(`SQL gravado em ${args.sql}`);
  console.log("Revise o arquivo ANTES de aplicar. Nada foi escrito em banco nenhum.");
}

if (!args.json && !args.sql) {
  console.log("Modo seco: nada gravado. Use --json e/ou --sql para produzir saída.");
}

// ============================================================
// Geração do SQL
// ============================================================

/** Escapa uma string para literal SQL. */
function s(v) {
  if (v == null) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Escapa um array de texto para literal SQL. */
function arr(v) {
  if (!Array.isArray(v) || v.length === 0) return "'{}'";
  const itens = v.map((x) => `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `'{${itens.join(",")}}'`;
}

function n(v) {
  return v == null ? "null" : String(Number(v));
}

function b(v) {
  return v == null ? "null" : v ? "true" : "false";
}

function gerarSql(chunks, meta) {
  const cols = [
    "documento_origem",
    "versao_documento",
    "pagina_origem",
    "ordem",
    "titulo",
    "nucleo",
    "subnucleo",
    "secao",
    "tipo_conhecimento",
    "faixa_etaria_min_meses",
    "faixa_etaria_max_meses",
    "faixa_rotulo",
    "publico",
    "situacoes_relacionadas",
    "habilidades_relacionadas",
    "diagnosticos_relacionados",
    "nucleos_relacionados",
    "perguntas_investigativas",
    "hipoteses",
    "estrategias",
    "o_que_evitar",
    "quando_encaminhar",
    "nivel_de_cautela",
    "muda_conduta",
    "texto_original",
    "hash",
    "revisao_pendente",
    "revisao_motivo",
  ];

  const linhas = chunks.map((c) =>
    "  (" +
    [
      s(c.documento_origem),
      s(c.versao_documento),
      n(c.pagina_origem),
      n(c.ordem),
      s(c.titulo),
      s(c.nucleo),
      s(c.subnucleo),
      s(c.secao),
      s(c.tipo_conhecimento),
      n(c.faixa_etaria_min_meses),
      n(c.faixa_etaria_max_meses),
      s(c.faixa_rotulo),
      arr(c.publico),
      arr(c.situacoes_relacionadas),
      arr(c.habilidades_relacionadas),
      arr(c.diagnosticos_relacionados),
      arr(c.nucleos_relacionados),
      arr(c.perguntas_investigativas),
      arr(c.hipoteses),
      arr(c.estrategias),
      arr(c.o_que_evitar),
      s(c.quando_encaminhar),
      s(c.nivel_de_cautela),
      b(c.muda_conduta),
      s(c.texto_original),
      s(c.hash),
      b(c.revisao_pendente),
      s(c.revisao_motivo),
    ].join(", ") +
    ")",
  );

  return `-- ============================================================
-- BIA — carga de conteúdo (gerada por scripts/bia/importar-bia.mjs)
--
--   documento : ${meta.documento}
--   versão    : ${meta.versao}
--   chunks    : ${meta.stats.total}
--   revisão   : ${meta.stats.revisao_pendente} pendente(s)
--
-- Pré-requisito: migração 0071_bia.sql aplicada.
--
-- Idempotente: o índice único em \`hash\` + ON CONFLICT DO NOTHING fazem
-- reimportar o mesmo documento ser um no-op. Para trocar de VERSÃO do
-- documento, desative a anterior antes:
--   update public.bia_chunks set ativo = false
--    where documento_origem = ${s(meta.documento)} and versao_documento <> ${s(meta.versao)};
--
-- Este arquivo NÃO integra a BIA a nada. Só popula a tabela.
-- ============================================================

begin;

insert into public.bia_chunks (${cols.join(", ")})
values
${linhas.join(",\n")}
on conflict (hash) do nothing;

-- Conferência (rode e compare com o relatório do importer):
--   select nucleo, tipo_conhecimento, count(*)
--     from public.bia_chunks
--    where documento_origem = ${s(meta.documento)}
--      and versao_documento = ${s(meta.versao)}
--    group by 1, 2 order by 3 desc;

commit;
`;
}
