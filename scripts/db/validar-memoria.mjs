#!/usr/bin/env node
/**
 * VALIDAÇÃO DA MEMÓRIA VIVA CONTRA UM POSTGRES DE VERDADE.
 *
 * PGlite é o Postgres compilado para WASM, rodando dentro do Node. Sem Docker,
 * sem WSL, sem privilégio de administrador, sem servidor. Não substitui um
 * Postgres de produção — as ressalvas estão no fim deste arquivo —, mas executa
 * SQL de verdade: DDL, constraints, índices, ON CONFLICT e RLS.
 *
 * Existe porque a revisão estática deixou passar um defeito que teria impedido
 * metade da coleta (a policy de INSERT ausente). Contrato não substitui banco.
 *
 *   node scripts/db/validar-memoria.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const ok = [];
const falhou = [];

const titulo = (t) => console.log(`\n${"=".repeat(64)}\n${t}\n${"=".repeat(64)}`);

async function tenta(nome, fn) {
  try {
    await fn();
    ok.push(nome);
    console.log(`  OK    ${nome}`);
  } catch (e) {
    falhou.push([nome, e.message]);
    console.log(`  FALHA ${nome}`);
    console.log(`        ${String(e.message).split("\n")[0].slice(0, 150)}`);
  }
}

titulo("1. AMBIENTE");
const db = await PGlite.create();
console.log("  " + (await db.query("select version()")).rows[0].version.split(",")[0]);

// Roles e schema que o Supabase fornece e o Postgres puro não tem.
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema if not exists auth;
  create schema if not exists extensions;
  create table if not exists auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz default now()
  );
`);
await db.exec(
  "create or replace function auth.uid() returns uuid language sql stable as " +
    "$fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;",
);
await db.exec(
  "create or replace function auth.role() returns text language sql stable as " +
    "$fn$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $fn$;",
);
// O WASM so traz plpgsql. `uuid-ossp` e `pgcrypto` existem no Supabase e nao
// aqui, entao entram como SHIM: `gen_random_uuid()` e nativo desde o PG13, e
// `digest()` so precisa existir para a 0065 aplicar.
await db.exec(
  "create or replace function public.uuid_generate_v4() returns uuid language sql volatile as " +
    "$fn$ select gen_random_uuid() $fn$;",
);
await db.exec("create schema if not exists pgcrypto_shim;");
await db.exec(
  "create or replace function public.digest(text, text) returns bytea language sql immutable as " +
    "$fn$ select sha256(convert_to($1, 'UTF8')) $fn$;",
);
console.log("  roles, schema auth e shims de extensao criados");

titulo("2. MIGRAÇÕES");
const arquivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql") && !f.includes("rollback"))
  .sort();
let aplicadas = 0;
const paradas = [];
for (const f of arquivos) {
  try {
    // `create extension` de coisas que o WASM nao tem vira no-op: o shim
    // acima ja fornece as funcoes. Nao mascara erro de SQL nosso - so a
    // ausencia da extensao, que em producao existe.
    const sqlM = readFileSync(join(DIR, f), "utf8").replace(
      /create extension if not exists\s+"?[a-z_-]+"?[^;]*;/gi,
      "",
    );
    await db.exec(sqlM);
    aplicadas += 1;
  } catch (e) {
    paradas.push([f, String(e.message).split("\n")[0].slice(0, 130)]);
  }
}
console.log(`  aplicadas: ${aplicadas}/${arquivos.length}`);
if (paradas.length) {
  console.log("  NAO aplicadas (as 3 primeiras sao as que importam):");
  for (const [f, m] of paradas) console.log(`    - ${f}: ${m}`);
}

const contar = async (q, p = []) => (await db.query(q, p)).rows[0].v;

titulo("3. ESTRUTURA DO FACT STORE");
const temTabela = await contar(
  "select count(*)::int v from information_schema.tables where table_schema='public' and table_name='perfil_fatos'",
);
if (!temTabela) {
  console.log("  perfil_fatos NÃO existe — a 0073 não aplicou. Abortando.");
  process.exit(1);
}
console.log(
  `  colunas: ${await contar("select count(*)::int v from information_schema.columns where table_name='perfil_fatos'")}`,
);
const idx = (
  await db.query("select indexname from pg_indexes where tablename='perfil_fatos' order by 1")
).rows.map((r) => r.indexname);
console.log(`  índices (${idx.length}): ${idx.join(", ")}`);
const pol = (
  await db.query(
    "select polname, polcmd from pg_policy where polrelid='public.perfil_fatos'::regclass order by 1",
  )
).rows.map((r) => `${r.polname}(${r.polcmd})`);
console.log(`  policies: ${pol.join(", ")}`);
console.log(
  `  RLS: ${(await db.query("select relrowsecurity from pg_class where relname='perfil_fatos'")).rows[0].relrowsecurity}`,
);

titulo("4. INSERÇÃO E CONSTRAINTS");
const USER = "33333333-3333-3333-3333-333333333333";
// A familia NAO e inserida a mao: o trigger `handle_new_user` da 0001 cria uma
// ao inserir em auth.users. Usar a que ele criou testa o caminho real.
let FAM = null;
const MEM = "22222222-2222-2222-2222-222222222222";

/** Preenche as colunas NOT NULL sem default com um valor de teste. */
async function inserirDependencia(tabela, fixos) {
  const cols = (
    await db.query(
      `select column_name, is_nullable, column_default, data_type
         from information_schema.columns where table_name=$1`,
      [tabela],
    )
  ).rows;
  const obrig = cols.filter(
    (c) => c.is_nullable === "NO" && !c.column_default && !(c.column_name in fixos),
  );
  const valores = { ...fixos };
  for (const c of obrig) {
    valores[c.column_name] = /uuid/.test(c.data_type)
      ? crypto.randomUUID()
      : /timestamp|date/.test(c.data_type)
        ? "2026-01-01"
        : /bool/.test(c.data_type)
          ? false
          : /int|numeric|double/.test(c.data_type)
            ? 0
            : /json/.test(c.data_type)
              ? "{}"
              : "teste";
  }
  const k = Object.keys(valores);
  await db.query(
    `insert into public.${tabela}(${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")})`,
    k.map((x) => valores[x]),
  );
}

await tenta("trigger handle_new_user cria a familia", async () => {
  await db.query("insert into auth.users(id, email) values ($1, $2)", [USER, "t@t.t"]);
  const r = await db.query("select id from public.family_accounts where user_id = $1", [USER]);
  if (r.rows.length !== 1) throw new Error(`trigger criou ${r.rows.length} familias, esperado 1`);
  FAM = r.rows[0].id;
});

await tenta("membro de teste", () =>
  // `perfil` tem CHECK: "teste" nao passa. Valor real do dominio.
  inserirDependencia("membros_atipicos", {
    id: MEM,
    family_account_id: FAM,
    perfil: "TEA",
  }),
);

const BASE = () => ({
  family_account_id: FAM,
  membro_atipico_id: MEM,
  conceito: "sensorial.hipersensibilidade_auditiva",
  dominio: "sensorial",
  afirmacao: "Tapa os ouvidos com o liquidificador",
  observado_em: "2026-07-31",
  source_type: "caregiver_report",
  extractor_version: "kv-blob-v2",
  idempotency_key: "chave-1",
});

function inserir(over = {}) {
  const v = { ...BASE(), ...over };
  const k = Object.keys(v);
  return db.query(
    `insert into public.perfil_fatos(${k.join(",")}) values (${k.map((_, i) => `$${i + 1}`).join(",")}) returning id`,
    k.map((x) => v[x]),
  );
}

const esperaErro = async (padrao, fn) => {
  try {
    await fn();
  } catch (e) {
    if (padrao.test(e.message)) return;
    throw e;
  }
  throw new Error("o banco ACEITOU o que deveria rejeitar");
};

await tenta("insert mínimo funciona", () => inserir());

await tenta("defaults corretos", async () => {
  const r = (
    await db.query(
      "select fact_kind,escopo_tipo,status,temporal_status,verification_status from perfil_fatos limit 1",
    )
  ).rows[0];
  const esperado = {
    fact_kind: "statement",
    escopo_tipo: "sempre",
    status: "ativo",
    temporal_status: "current",
    verification_status: "reported",
  };
  for (const [k, v] of Object.entries(esperado)) {
    if (r[k] !== v) throw new Error(`${k}=${r[k]}, esperado ${v}`);
  }
});

await tenta("UNIQUE de idempotência rejeita duplicata", () =>
  esperaErro(/duplicate key|unique/i, () => inserir()),
);

await tenta("ON CONFLICT DO NOTHING devolve ZERO linhas", async () => {
  const r = await db.query(
    `insert into public.perfil_fatos
       (family_account_id,membro_atipico_id,conceito,dominio,afirmacao,observado_em,source_type,extractor_version,idempotency_key)
     values ($1,$2,'a.b','a','x','2026-07-31','caregiver_report','kv-blob-v2','chave-1')
     on conflict (idempotency_key) do nothing
     returning id`,
    [FAM, MEM],
  );
  if (r.rows.length !== 0) throw new Error(`devolveu ${r.rows.length} linhas, esperado 0`);
});

for (const [col, mau] of [
  ["fact_kind", "observation"],
  ["source_type", "mae"],
  ["status", "arquivado"],
  ["verification_status", "validado"],
  ["escopo_tipo", "campanha"],
  ["sujeito_classificado", "crianca"],
  ["relacao_origem", "chute"],
]) {
  await tenta(`CHECK de ${col} rejeita "${mau}"`, () =>
    esperaErro(/check constraint|invalid input/i, () =>
      inserir({ idempotency_key: `k-${col}`, [col]: mau }),
    ),
  );
}

await tenta("NOT NULL de afirmacao é respeitado", () =>
  esperaErro(/null value|not-null/i, () => inserir({ idempotency_key: "k-nn", afirmacao: null })),
);

await tenta("FK de membro inexistente é rejeitada", () =>
  esperaErro(/foreign key/i, () =>
    inserir({
      idempotency_key: "k-fk",
      membro_atipico_id: "44444444-4444-4444-4444-444444444444",
    }),
  ),
);

titulo("5. QUARENTENA E RELAÇÕES");
await tenta("fato em quarentena é gravado", () =>
  inserir({
    idempotency_key: "k-quarentena",
    status: "quarentena",
    quarentena_motivo: "foco_fragil",
    sujeito_classificado: "multiple_or_ambiguous",
  }),
);

await tenta("quarentena fica FORA da leitura de fatos ativos", async () => {
  const ativos = await contar("select count(*)::int v from perfil_fatos where status='ativo'");
  const quar = await contar("select count(*)::int v from perfil_fatos where status='quarentena'");
  if (quar < 1) throw new Error("quarentena não gravou");
  const lidos = await contar(
    "select count(*)::int v from perfil_fatos where temporal_status='current' and status='ativo'",
  );
  if (lidos !== ativos) throw new Error("leitura de ativos não bate");
  console.log(`        ativos=${ativos} quarentena=${quar} lidos=${lidos}`);
});

await tenta("supersessão entre fatos grava com FK e motivo", async () => {
  const antigo = (
    await inserir({ idempotency_key: "k-rel-a", afirmacao: "Não fala nenhuma palavra" })
  ).rows[0].id;
  await inserir({
    idempotency_key: "k-rel-b",
    afirmacao: "Agora fala mamãe e papai",
    supersedes_fact_id: antigo,
    relacao_motivo: "mudanca",
    relacao_origem: "sistema",
    relacao_em: "2026-09-01",
  });
  const n = await contar(
    "select count(*)::int v from perfil_fatos where supersedes_fact_id is not null",
  );
  if (n !== 1) throw new Error("relação não gravou");
});

await tenta("linhagem aceita source_content_id e extraction_run_id", () =>
  inserir({
    idempotency_key: "k-linhagem",
    source_content_id: "diario:2026-07-31:item-3",
    extraction_run_id: "55555555-5555-5555-5555-555555555555",
  }),
);

titulo("6. RLS");
await tenta("existe policy de INSERT para authenticated", async () => {
  const n = await contar(
    "select count(*)::int v from pg_policy where polrelid='public.perfil_fatos'::regclass and polcmd='a'",
  );
  if (n < 1) throw new Error("sem policy de INSERT: diário e web manual falhariam");
});

await tenta("RLS esconde fatos de outra família", async () => {
  await db.exec(
    "grant usage on schema public to authenticated; grant select, insert on public.perfil_fatos to authenticated;",
  );
  await db.exec("set role authenticated;");
  await db.exec("select set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',false);");
  const n = await contar("select count(*)::int v from public.perfil_fatos");
  await db.exec("reset role;");
  if (n !== 0) throw new Error(`usuário sem vínculo enxergou ${n} fatos`);
});

titulo("7. CONSULTAS DE AUDITORIA");
for (const [nome, q] of [
  ["total", "select count(*)::int v from perfil_fatos"],
  ["ativos", "select count(*)::int v from perfil_fatos where status='ativo'"],
  ["quarentena", "select count(*)::int v from perfil_fatos where status='quarentena'"],
  [
    "ai_inference fora de inferred (deve ser 0)",
    "select count(*)::int v from perfil_fatos where source_type='ai_inference' and verification_status<>'inferred'",
  ],
  [
    "confirmed (deve ser 0)",
    "select count(*)::int v from perfil_fatos where verification_status='confirmed'",
  ],
  [
    "escopo fora do padrão (deve ser 0)",
    "select count(*)::int v from perfil_fatos where escopo_tipo<>'sempre'",
  ],
  [
    "sem proveniência",
    "select count(*)::int v from perfil_fatos where source_message_id is null and source_actor_id is null and source_actor_label is null",
  ],
  ["conceito = domínio", "select count(*)::int v from perfil_fatos where conceito=dominio"],
  [
    "chaves duplicadas (deve ser 0)",
    "select count(*)::int v from (select idempotency_key from perfil_fatos group by 1 having count(*)>1) t",
  ],
]) {
  console.log(`  ${nome}: ${await contar(q)}`);
}

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);

/**
 * RESSALVAS — o que ISTO NÃO prova:
 *  - PGlite é Postgres 18 e a produção é self-hosted (provável 15). DDL e
 *    constraints são estáveis entre as duas, mas planos de consulta não;
 *  - não há PostgREST, então a semântica de `.upsert(ignoreDuplicates)` do
 *    supabase-js continua não verificada — só o ON CONFLICT do SQL puro;
 *  - roles e `auth` são stubs; o RLS aqui é o mecanismo, não a configuração
 *    de produção;
 *  - sem concorrência real: nada aqui testa duas conexões simultâneas.
 */
process.exit(falhou.length ? 1 : 0);
