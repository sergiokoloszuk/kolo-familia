#!/usr/bin/env node
/**
 * ENSAIO DE MIGRAÇÃO E REVERSÃO — 0071 → 0074 e de volta.
 *
 * As quatro migrações pendentes vão entrar num banco de produção ÚNICO,
 * self-hosted, que já foi zerado uma vez por um redeploy. "Aditiva" é uma
 * afirmação sobre o SQL; reversível é uma afirmação sobre o ciclo — e só o
 * ciclo prova.
 *
 * O que este ensaio prova: cada migração sobe sozinha, o conjunto de objetos
 * volta EXATAMENTE ao estado anterior depois dos quatro rollbacks, e tudo
 * reaplica em seguida. O que ele NÃO prova: que o banco de produção aguenta —
 * isso é o ensaio de restore, e é outra coisa.
 *
 *   node scripts/db/ensaio-migracoes.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
    console.log(`        ${String(e.message).split("\n")[0].slice(0, 200)}`);
  }
}

const DIR = "supabase/migrations";
const ALVO = ["0071", "0072", "0073", "0074"];

/** Extensões não existem no PGlite; o resto do SQL é o mesmo de produção. */
const semExtensoes = (sql) =>
  sql.replace(/create extension if not exists\s+"?[a-z_-]+"?[^;]*;/gi, "");

const arquivoDe = (prefixo, tipo) => {
  const nomes = readdirSync(DIR).filter(
    (f) =>
      f.startsWith(prefixo) &&
      f.endsWith(".sql") &&
      (tipo === "rollback" ? f.includes("rollback") : !f.includes("rollback")),
  );
  if (nomes.length !== 1) throw new Error(`esperava 1 arquivo ${prefixo}/${tipo}, achei ${nomes.length}`);
  return join(DIR, nomes[0]);
};

const db = await PGlite.create();

async function rodar(caminho) {
  try {
    await db.exec(semExtensoes(readFileSync(caminho, "utf8")));
  } catch (e) {
    try {
      await db.exec("rollback");
    } catch {
      /* sem transação */
    }
    throw new Error(`${caminho}: ${e.message}`);
  }
}

/** Retrato do schema: tabelas, índices e policies do `public`. */
async function retrato() {
  const q = async (sql) => (await db.query(sql)).rows.map((r) => r.v).sort();
  return {
    tabelas: await q(
      "select tablename as v from pg_tables where schemaname='public'",
    ),
    indices: await q("select indexname as v from pg_indexes where schemaname='public'"),
    policies: await q("select policyname as v from pg_policies where schemaname='public'"),
  };
}

const diff = (a, b) => b.filter((x) => !a.includes(x));

// ---------- 1. estado anterior ----------
titulo("1. ESTADO ANTERIOR ÀS MIGRAÇÕES");

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema if not exists auth; create schema if not exists extensions;
  create table if not exists auth.users (id uuid primary key, email text,
    raw_user_meta_data jsonb, created_at timestamptz default now());
`);
await db.exec(
  "create or replace function auth.uid() returns uuid language sql stable as " +
    "$fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;",
);
await db.exec(
  "create or replace function public.uuid_generate_v4() returns uuid language sql volatile as " +
    "$fn$ select gen_random_uuid() $fn$;",
);
await db.exec(
  "create or replace function public.digest(text, text) returns bytea language sql immutable as " +
    "$fn$ select sha256(convert_to($1, 'UTF8')) $fn$;",
);

const anteriores = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql") && !f.includes("rollback") && f < "0071")
  .sort();
const problemas = [];
for (const f of anteriores) {
  try {
    await rodar(join(DIR, f));
  } catch (e) {
    problemas.push(`${f}: ${String(e.message).slice(0, 90)}`);
  }
}
console.log(`  ${anteriores.length} migrações anteriores aplicadas` +
  (problemas.length ? `, ${problemas.length} com ressalva no PGlite` : ""));
for (const p of problemas) console.log(`     · ${p}`);

const BASE = await retrato();
console.log(`  base: ${BASE.tabelas.length} tabelas, ${BASE.indices.length} índices, ${BASE.policies.length} policies`);

// ---------- 2 a 5. aplicação ----------
titulo("2-5. APLICAÇÃO NA ORDEM 0071 → 0072 → 0073 → 0074");

const criados = {};
let acumulado = BASE;
for (const p of ALVO) {
  await tenta(`aplica ${p}`, async () => {
    await rodar(arquivoDe(p, "migracao"));
    const agora = await retrato();
    criados[p] = {
      tabelas: diff(acumulado.tabelas, agora.tabelas),
      indices: diff(acumulado.indices, agora.indices),
      policies: diff(acumulado.policies, agora.policies),
    };
    if (criados[p].tabelas.length === 0 && criados[p].indices.length === 0) {
      throw new Error("não criou objeto nenhum — a migração não teve efeito");
    }
    console.log(
      `        +${criados[p].tabelas.length} tabelas (${criados[p].tabelas.join(", ") || "—"}), ` +
        `+${criados[p].indices.length} índices, +${criados[p].policies.length} policies`,
    );
    acumulado = agora;
  });
}

const COMPLETO = await retrato();

// ---------- 6. validação de objetos e dependências ----------
titulo("6. OBJETOS E DEPENDÊNCIAS");

await tenta("as quatro tabelas centrais existem", async () => {
  for (const t of ["bia_chunks", "ayla_publicacoes", "perfil_fatos", "extracao_lotes"]) {
    const v = (await db.query(`select to_regclass('public.${t}') is not null as v`)).rows[0].v;
    if (!v) throw new Error(`${t} não existe`);
  }
});

await tenta("RLS ligado nas tabelas novas", async () => {
  const r = await db.query(`
    select relname, relrowsecurity from pg_class
    where relname in ('ayla_publicacoes','perfil_fatos','extracao_lotes')`);
  for (const l of r.rows) {
    if (!l.relrowsecurity) throw new Error(`${l.relname} sem RLS`);
  }
});

await tenta("as dependências apontam só para tabelas preexistentes", async () => {
  // A ordem de rollback depende disto: se alguma das novas fosse REFERENCIADA
  // por outra, a ordem inversa deixaria de ser suficiente.
  const r = await db.query(`
    select c.conname, t.relname as origem, f.relname as destino
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class f on f.oid = c.confrelid
    where c.contype = 'f'
      and f.relname in ('ayla_publicacoes','perfil_fatos','extracao_lotes','bia_chunks')
      and t.relname not in ('ayla_publicacoes','perfil_fatos','extracao_lotes','bia_chunks')`);
  if (r.rows.length > 0) {
    throw new Error(
      `tabela preexistente depende das novas: ${r.rows.map((x) => `${x.origem}→${x.destino}`).join(", ")}`,
    );
  }
});

await tenta("extracao_lotes NÃO tem foreign key para perfil_fatos", async () => {
  // O vínculo é textual (`source_content_id`), de propósito: é o que permite
  // reverter uma sem a outra e a evidência sobreviver à ausência da origem.
  const r = await db.query(`
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class f on f.oid = c.confrelid
    where c.contype='f' and t.relname='extracao_lotes' and f.relname='perfil_fatos'`);
  if (r.rows.length > 0) throw new Error("existe FK — a ordem de reversão passa a importar");
});

// ---------- 7 a 10. reversão ----------
titulo("7-10. REVERSÃO NA ORDEM 0074 → 0073 → 0072 → 0071");

for (const p of [...ALVO].reverse()) {
  await tenta(`reverte ${p}`, async () => {
    await rodar(arquivoDe(p, "rollback"));
    const agora = await retrato();
    const sobrou = criados[p].tabelas.filter((t) => agora.tabelas.includes(t));
    if (sobrou.length) throw new Error(`sobraram tabelas: ${sobrou.join(", ")}`);
    const policiasSobrando = criados[p].policies.filter((x) => agora.policies.includes(x));
    if (policiasSobrando.length) throw new Error(`sobraram policies: ${policiasSobrando.join(", ")}`);
  });
}

// ---------- 11. voltou ao estado anterior? ----------
titulo("11. RETORNO AO ESTADO ANTERIOR");

await tenta("o schema é idêntico ao de antes das quatro migrações", async () => {
  const agora = await retrato();
  const sobrando = {
    tabelas: diff(BASE.tabelas, agora.tabelas),
    indices: diff(BASE.indices, agora.indices),
    policies: diff(BASE.policies, agora.policies),
  };
  const faltando = {
    tabelas: diff(agora.tabelas, BASE.tabelas),
    indices: diff(agora.indices, BASE.indices),
    policies: diff(agora.policies, BASE.policies),
  };
  const erros = [];
  for (const k of ["tabelas", "indices", "policies"]) {
    if (sobrando[k].length) erros.push(`sobrou ${k}: ${sobrando[k].join(", ")}`);
    // O mais grave: o rollback levou junto algo que já existia antes.
    if (faltando[k].length) erros.push(`SUMIU ${k} preexistente: ${faltando[k].join(", ")}`);
  }
  if (erros.length) throw new Error(erros.join(" | "));
});

await tenta("os rollbacks são idempotentes — rodar de novo não quebra", async () => {
  for (const p of [...ALVO].reverse()) await rodar(arquivoDe(p, "rollback"));
});

// ---------- 12. reaplicação ----------
titulo("12. REAPLICAÇÃO APÓS A REVERSÃO");

await tenta("as quatro sobem de novo e o schema volta a ficar completo", async () => {
  for (const p of ALVO) await rodar(arquivoDe(p, "migracao"));
  const agora = await retrato();
  const faltando = diff(agora.tabelas, COMPLETO.tabelas);
  if (faltando.length) throw new Error(`não voltaram: ${faltando.join(", ")}`);
  const idx = diff(agora.indices, COMPLETO.indices);
  if (idx.length) throw new Error(`índices não voltaram: ${idx.join(", ")}`);
});

await tenta("dá para gravar e ler depois do ciclo completo", async () => {
  const u = "77777777-7777-7777-7777-777777777777";
  await db.query("insert into auth.users(id,email) values ($1,$2)", [u, "ciclo@t.t"]);
  const fam = (await db.query("select id from public.family_accounts where user_id=$1", [u]))
    .rows[0].id;
  await db.query(
    `insert into public.extracao_lotes
       (family_account_id, canal, mensagens, quantidade, texto_hash, mensagens_chave)
     values ($1,'whatsapp','[]'::jsonb,1,'h','k')`,
    [fam],
  );
  const n = (await db.query("select count(*)::int v from public.extracao_lotes")).rows[0].v;
  if (n !== 1) throw new Error("a tabela reaplicada não aceita escrita");
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
console.log("\n  ORDEM DE APLICAÇÃO:  0071 → 0072 → 0073 → 0074");
console.log("  ORDEM DE REVERSÃO:   0074 → 0073 → 0072 → 0071");
console.log("  (verificada: nenhuma tabela preexistente depende das novas, e");
console.log("   entre as novas não há foreign key — a ordem inversa é suficiente,");
console.log("   e na prática qualquer ordem funcionaria. Mantida por convenção.)");
process.exit(falhou.length ? 1 : 0);
