#!/usr/bin/env node
/**
 * ayla-apply-migrations.mjs
 *
 * Aplica migrations SQL no banco Postgres em ordem, com transação por
 * arquivo. Idempotente quando a migration usa CREATE IF NOT EXISTS /
 * ON CONFLICT — caso contrário, segunda execução falha (esperado).
 *
 * --------------------------------------------------------------------
 *  Conexão
 * --------------------------------------------------------------------
 *  Tenta DATABASE_URL primeiro. Se ausente, monta a partir de:
 *
 *    PGHOST      ← derivado de NEXT_PUBLIC_SUPABASE_URL (sem https://, com port custom)
 *                  ex: api-supabase.4oydba.easypanel.host → mesma máquina
 *                  port: PGPORT (default 5432)
 *    PGPORT      ← env ou 5432
 *    PGUSER      ← env ou 'postgres'
 *    PGPASSWORD  ← env ou POSTGRES_PASSWORD
 *    PGDATABASE  ← env ou 'postgres'
 *
 *  Em Supabase auto-hospedado (Easypanel/Coolify/Docker) o Postgres
 *  geralmente NÃO está exposto na mesma porta da API REST. Configure
 *  DATABASE_URL diretamente no .env.local pra evitar adivinhação.
 *
 * --------------------------------------------------------------------
 *  Uso
 * --------------------------------------------------------------------
 *  Aplicar todas as migrations pendentes do bloco Ayla v2 (0019-0022):
 *    node apps/web/scripts/ayla-apply-migrations.mjs
 *
 *  Dry-run (lê os SQLs, valida conexão, NÃO executa):
 *    node apps/web/scripts/ayla-apply-migrations.mjs --dry-run
 *
 *  Aplicar uma específica:
 *    node apps/web/scripts/ayla-apply-migrations.mjs --only=0019
 *
 *  Aplicar lista custom:
 *    node apps/web/scripts/ayla-apply-migrations.mjs \
 *      --files=0019_ayla_manual_v2_foundation.sql,0020_ayla_eventos_etl.sql
 *
 * --------------------------------------------------------------------
 *  Garantias
 * --------------------------------------------------------------------
 *  - Cada arquivo roda em UMA transação. Erro → ROLLBACK desse arquivo.
 *    Arquivos anteriores que já commitaram NÃO são revertidos (executar
 *    novamente é seguro pra migrations idempotentes).
 *  - Logs verbosos: cada arquivo mostra início/fim/duração + erro se houver.
 *  - Exit code 0 quando todas aplicadas com sucesso, 1 em qualquer erro.
 *
 *  Sem rollback global multi-arquivo — cada migration é independente.
 *  Se você precisa de atomicidade entre 2+ migrations, junte os SQLs.
 * --------------------------------------------------------------------
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

// ============================================================
// Configuração
// ============================================================

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
const ENV_PATH = resolve(SCRIPT_DIR, "..", ".env.local");

// Lista default: bloco Ayla v2 longitudinal pendente
const DEFAULT_FILES = [
  "0019_ayla_manual_v2_foundation.sql",
  "0020_ayla_eventos_etl.sql",
  "0021_ayla_tipos_eventos_extra.sql",
  "0022_ayla_padroes_rastreabilidade.sql",
];

// ============================================================
// Carrega .env.local sem dotenv (mesma técnica dos outros scripts)
// ============================================================

if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ============================================================
// Parse de flags
// ============================================================

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");

let filesArg = null;
for (const a of argv) {
  if (a.startsWith("--files=")) filesArg = a.slice("--files=".length);
  if (a.startsWith("--only=")) filesArg = `${a.slice("--only=".length)}*`;
}

let migrationsToApply;
if (filesArg) {
  if (filesArg.endsWith("*")) {
    // --only=0019 → casa qualquer arquivo que comece com "0019"
    const prefix = filesArg.slice(0, -1);
    migrationsToApply = DEFAULT_FILES.filter((f) => f.startsWith(prefix));
    if (migrationsToApply.length === 0) {
      // procura na pasta inteira
      const fs = await import("node:fs");
      const all = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
      migrationsToApply = all.filter((f) => f.startsWith(prefix));
    }
  } else {
    migrationsToApply = filesArg.split(",").map((s) => s.trim()).filter(Boolean);
  }
} else {
  migrationsToApply = DEFAULT_FILES;
}

if (migrationsToApply.length === 0) {
  console.error("✗ Nenhuma migration selecionada.");
  process.exit(1);
}

// ============================================================
// Monta conexão
// ============================================================

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
  }

  // Fallback: monta a partir de partes
  let host = process.env.PGHOST;
  if (!host && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // ex: https://api-supabase.4oydba.easypanel.host → api-supabase.4oydba.easypanel.host
    host = process.env.NEXT_PUBLIC_SUPABASE_URL
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .split(":")[0];
  }
  const port = parseInt(process.env.PGPORT || "5432", 10);
  const user = process.env.PGUSER || "postgres";
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE || "postgres";

  if (!host || !password) {
    throw new Error(
      "Conexão incompleta. Defina DATABASE_URL no .env.local OU forneça PGHOST + POSTGRES_PASSWORD/PGPASSWORD.",
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    // Postgres self-hosted em Easypanel pode ter cert custom; permitir
    // conexão sem validar cert é OK pra script administrativo.
  };
}

// ============================================================
// Execução
// ============================================================

function pad(s, n) {
  return String(s).padEnd(n);
}

function ms(t) {
  return `${Date.now() - t}ms`;
}

async function main() {
  console.log("\n=== Ayla — Apply Migrations ===\n");
  console.log(
    `${DRY_RUN ? "[DRY RUN] " : ""}Aplicando ${migrationsToApply.length} migration(s):`,
  );
  for (const f of migrationsToApply) console.log(`  · ${f}`);
  console.log();

  // Valida que todos os arquivos existem antes de conectar
  for (const f of migrationsToApply) {
    const path = join(MIGRATIONS_DIR, f);
    if (!existsSync(path)) {
      console.error(`✗ Arquivo não encontrado: ${path}`);
      process.exit(1);
    }
  }

  const config = buildConnectionConfig();
  const hostLabel = config.host || (config.connectionString || "").split("@")[1] || "?";
  console.log(`Host: ${hostLabel}`);
  console.log(`Modo: ${DRY_RUN ? "DRY RUN (sem executar)" : "EXECUTAR"}\n`);

  const client = new Client(config);
  const connStart = Date.now();
  try {
    await client.connect();
    console.log(`✓ Conectado (${ms(connStart)})\n`);
  } catch (err) {
    console.error(`✗ Falha ao conectar: ${err.message}`);
    console.error(
      "\nDicas:\n" +
        " · DATABASE_URL é o caminho mais seguro — peça ao admin do Easypanel.\n" +
        " · Em self-hosted, Postgres geralmente fica em port custom (não 5432).\n" +
        " · Verifique se o IP da máquina que está rodando o script tem acesso ao DB.",
    );
    process.exit(1);
  }

  let okCount = 0;
  let errorCount = 0;

  for (const fileName of migrationsToApply) {
    const path = join(MIGRATIONS_DIR, fileName);
    const sql = readFileSync(path, "utf8");
    const bytes = Buffer.byteLength(sql, "utf8");

    console.log(`→ ${pad(fileName, 50)} (${bytes} bytes)`);

    if (DRY_RUN) {
      console.log(`  [dry] parsed OK, NÃO executado`);
      okCount++;
      continue;
    }

    const t = Date.now();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`  ✓ commit OK (${ms(t)})`);
      okCount++;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignora — provavelmente já rollbackado
      }
      console.error(`  ✗ falhou: ${err.message}`);
      if (err.position) console.error(`    posição: char ${err.position}`);
      if (err.detail) console.error(`    detail: ${err.detail}`);
      if (err.hint) console.error(`    hint: ${err.hint}`);
      errorCount++;
      // Decisão: continuar com próximas migrations? Por segurança, PARA.
      console.error(
        `\n✗ Parando — corrija o erro e re-execute (migrations restantes não foram aplicadas).`,
      );
      break;
    }
  }

  await client.end();

  console.log(
    `\n========================================\n` +
      `Resumo: ${okCount} aplicada(s), ${errorCount} falha(s)\n` +
      `========================================\n`,
  );

  process.exit(errorCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n✗ Erro fatal:", err.message);
  process.exit(1);
});
