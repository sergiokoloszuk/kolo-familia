#!/usr/bin/env node
/**
 * OS QUATRO BOTÕES CONTRA POSTGRES DE VERDADE.
 *
 * Teste unitário prova que a função monta o `update` certo. Só o banco prova
 * que o CHECK aceita o valor, que a linha muda, e que o segundo clique não faz
 * nada. É a diferença entre "o botão chamou a função" e "o botão produziu o
 * estado certo".
 *
 *   node scripts/db/validar-revisao.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { clienteSupabaseSobrePGlite } from "./pglite-supabase.mjs";

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
    console.log(`        ${String(e.message).split("\n")[0].slice(0, 160)}`);
  }
}

// ---------- banco ----------
const db = await PGlite.create();
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

const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql") && !x.includes("rollback")).sort()) {
  try {
    await db.exec(
      readFileSync(join(DIR, f), "utf8").replace(
        /create extension if not exists\s+"?[a-z_-]+"?[^;]*;/gi,
        "",
      ),
    );
  } catch {
    try {
      await db.exec("rollback");
    } catch {
      /* sem transação */
    }
  }
}

// ---------- módulo real ----------
const require_ = createRequire(import.meta.url);
const ts = require_("typescript");
const dir = mkdtempSync(join(tmpdir(), "rev-"));
writeFileSync(
  join(dir, "_log.mjs"),
  "export const eventos=[];export async function logEvent(e){eventos.push(e)}\n",
);
const js = ts.transpileModule(
  readFileSync(resolve("apps/web/src/lib/memoria-viva/revisao.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
writeFileSync(join(dir, "revisao.mjs"), js.replace(/from\s+"@\/lib\/log"/g, 'from "./_log.mjs"'));
const { decidirCaso, filaDeRevisao, casosEmDuvida, contarFila, resumoDaSemana } = await import(
  pathToFileURL(join(dir, "revisao.mjs")).href
);
const log = await import(pathToFileURL(join(dir, "_log.mjs")).href);

const supabase = clienteSupabaseSobrePGlite(db);

// ---------- fixtures ----------
const USER = "33333333-3333-3333-3333-333333333333";
await db.query("insert into auth.users(id,email) values ($1,$2)", [USER, "t@t.t"]);
const FAM = (await db.query("select id from public.family_accounts where user_id=$1", [USER]))
  .rows[0].id;
const PEDRO = "22222222-2222-2222-2222-222222222222";
await db.query(
  "insert into public.membros_atipicos(id,family_account_id,nome,perfil) values ($1,$2,'Pedro','TEA')",
  [PEDRO, FAM],
);

let seq = 0;
async function novoCaso(motivo = "foco_fragil") {
  seq += 1;
  const r = await db.query(
    `insert into public.perfil_fatos
       (family_account_id, membro_atipico_id, conceito, dominio, afirmacao, observado_em,
        source_type, source_channel, extractor_version, idempotency_key,
        status, quarentena_motivo, sujeito_classificado, source_content_id)
     values ($1,$2,'nutricional.seletividade','nutricional','SEGREDO CLINICO ${seq}','2026-07-31',
             'caregiver_report','whatsapp','kv-blob-v2','k-${seq}',
             'quarentena',$3,'multiple_or_ambiguous','whatsapp_turn:m-${seq}')
     returning id`,
    [FAM, PEDRO, motivo],
  );
  return r.rows[0].id;
}

const lerFato = async (id) =>
  (await db.query("select * from public.perfil_fatos where id=$1", [id])).rows[0];

titulo("QUATRO BOTÕES — ESTADO NO BANCO");

await tenta("APROVAR: quarentena → ativo, com resolução e revisor", async () => {
  const id = await novoCaso();
  const r = await decidirCaso(supabase, { fatoId: id, decisao: "aprovar", revisorId: USER });
  if (!r.ok || r.jaResolvido) throw new Error(JSON.stringify(r));
  const f = await lerFato(id);
  if (f.status !== "ativo") throw new Error(`status=${f.status}`);
  if (f.quarentena_resolucao !== "liberado") throw new Error(f.quarentena_resolucao);
  if (f.quarentena_resolvido_por !== USER) throw new Error("sem revisor");
  if (!f.quarentena_resolvido_em) throw new Error("sem data");
  if (f.relacao_origem !== "revisao_humana") throw new Error(f.relacao_origem);
});

await tenta("PERFIL ERRADO: invalida, marca motivo e NÃO troca o membro", async () => {
  const id = await novoCaso("conflito_de_nome");
  await decidirCaso(supabase, { fatoId: id, decisao: "pessoa_errada", revisorId: USER });
  const f = await lerFato(id);
  if (f.status !== "invalidado") throw new Error(`status=${f.status}`);
  if (f.relacao_motivo !== "pessoa_errada") throw new Error(f.relacao_motivo);
  if (f.membro_atipico_id !== PEDRO) throw new Error("o membro foi alterado");
  // A evidência e a linhagem continuam.
  if (!f.source_content_id) throw new Error("perdeu a evidência");
  if (!f.afirmacao) throw new Error("perdeu a afirmação");
});

await tenta("DESCARTAR: invalida com motivo distinto", async () => {
  const id = await novoCaso();
  await decidirCaso(supabase, { fatoId: id, decisao: "descartar", revisorId: USER });
  const f = await lerFato(id);
  if (f.status !== "invalidado") throw new Error(f.status);
  if (f.relacao_motivo !== "descartado") throw new Error(f.relacao_motivo);
});

await tenta("NÃO SEI DIZER: segue em quarentena, sem decisão, marcado como olhado", async () => {
  const id = await novoCaso();
  await decidirCaso(supabase, { fatoId: id, decisao: "em_duvida", revisorId: USER });
  const f = await lerFato(id);
  if (f.status !== "quarentena") throw new Error(f.status);
  if (f.quarentena_resolucao !== null) throw new Error("marcou decisão que não houve");
  if (!f.quarentena_resolvido_em) throw new Error("não marcou que foi olhado");
});

titulo("FILA");

await tenta("o que foi decidido sai da fila; o 'não sei' também", async () => {
  await db.query("delete from public.perfil_fatos");
  const a = await novoCaso();
  const b = await novoCaso();
  const c = await novoCaso();

  if ((await contarFila(supabase)) !== 3) throw new Error("fila inicial errada");

  await decidirCaso(supabase, { fatoId: a, decisao: "aprovar", revisorId: USER });
  await decidirCaso(supabase, { fatoId: b, decisao: "em_duvida", revisorId: USER });

  const fila = await filaDeRevisao(supabase);
  if (fila.length !== 1) throw new Error(`fila com ${fila.length}, esperado 1`);
  if (fila[0].id !== c) throw new Error("sobrou o caso errado");
});

await tenta("o 'não sei' aparece na lista semanal", async () => {
  const duvidas = await casosEmDuvida(supabase);
  if (duvidas.length !== 1) throw new Error(`${duvidas.length} em dúvida, esperado 1`);
});

await tenta("a fila traz o nome do membro, não só o id", async () => {
  const fila = await filaDeRevisao(supabase);
  if (fila[0].membroNome !== "Pedro") throw new Error(`nome=${fila[0].membroNome}`);
});

titulo("IDEMPOTÊNCIA E SEGURANÇA");

await tenta("clique duplo altera uma vez só", async () => {
  const id = await novoCaso();
  const p1 = await decidirCaso(supabase, { fatoId: id, decisao: "descartar", revisorId: USER });
  const p2 = await decidirCaso(supabase, { fatoId: id, decisao: "aprovar", revisorId: USER });
  if (p1.jaResolvido) throw new Error("o primeiro deveria valer");
  if (!p2.jaResolvido) throw new Error("o segundo deveria ser ignorado");
  const f = await lerFato(id);
  // O segundo clique era 'aprovar': se tivesse passado, o fato estaria ativo.
  if (f.status !== "invalidado") throw new Error("o segundo clique sobrescreveu");
});

await tenta("nenhum fato é apagado — todos continuam no banco", async () => {
  const n = (await db.query("select count(*)::int v from public.perfil_fatos")).rows[0].v;
  if (n < 4) throw new Error(`só ${n} fatos; algo foi apagado`);
});

await tenta("os CHECK do Postgres aceitam todos os valores das quatro decisões", async () => {
  for (const d of ["aprovar", "pessoa_errada", "descartar", "em_duvida"]) {
    const id = await novoCaso();
    const r = await decidirCaso(supabase, { fatoId: id, decisao: d, revisorId: USER });
    if (!r.ok) throw new Error(`${d}: ${r.erro}`);
  }
});

await tenta("a telemetria não carrega a afirmação", async () => {
  const bruto = JSON.stringify(log.eventos);
  if (bruto.includes("SEGREDO CLINICO")) throw new Error("vazou o texto do fato");
  if (!bruto.includes("antes")) throw new Error("não registrou estado anterior");
});

titulo("RESUMO SEMANAL");

await tenta("os números batem com o banco", async () => {
  const r = await resumoDaSemana(supabase);
  const real = (await db.query(`select
      count(*)::int total,
      count(*) filter (where status='ativo')::int ativos,
      count(*) filter (where relacao_motivo='pessoa_errada')::int pessoa_errada,
      count(*) filter (where relacao_motivo='em_duvida')::int em_duvida
    from public.perfil_fatos`)).rows[0];
  if (r.total !== real.total) throw new Error(`total ${r.total} != ${real.total}`);
  if (r.ativos !== real.ativos) throw new Error(`ativos ${r.ativos} != ${real.ativos}`);
  if (r.pessoaErrada !== real.pessoa_errada) throw new Error("pessoa errada não bate");
  if (r.emDuvida !== real.em_duvida) throw new Error("em dúvida não bate");
  console.log(
    `        total=${r.total} ativos=${r.ativos} quarentena=${r.quarentena} ` +
      `perfil_errado=${r.pessoaErrada} sem_decisao=${r.emDuvida}`,
  );
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
process.exit(falhou.length ? 1 : 0);
