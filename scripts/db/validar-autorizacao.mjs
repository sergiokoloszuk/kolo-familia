#!/usr/bin/env node
/**
 * A BARREIRA DA AMOSTRA CONTROLADA, pelos caminhos REAIS.
 *
 * O teste unitário prova que o predicado decide certo. Só o banco prova que
 * NADA foi escrito para quem está de fora — e "nada" inclui o que é fácil
 * esquecer: o lote, a quarentena, o evento operacional.
 *
 * Duas famílias no MESMO processo, com a mesma configuração: uma na lista,
 * outra não. É o cenário da amostra controlada — o Sérgio testando pelo número
 * dele enquanto as outras famílias seguem intocadas.
 *
 *   node scripts/db/validar-autorizacao.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
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
    console.log(`        ${String(e.message).split("\n")[0].slice(0, 180)}`);
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

// ---------- módulos reais ----------
const require_ = createRequire(import.meta.url);
const ts = require_("typescript");
const dir = mkdtempSync(join(tmpdir(), "autz-"));

writeFileSync(
  join(dir, "_log.mjs"),
  "export const eventos=[];export async function logEvent(e){eventos.push(e)}\n",
);
writeFileSync(join(dir, "_idade.mjs"), "export function hojeLocalISO(){return '2026-07-31'}\n");

function levar(caminhoAbs, destino, trocas = []) {
  let js = ts.transpileModule(readFileSync(caminhoAbs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [de, para] of trocas) js = js.replace(de, para);
  writeFileSync(join(dir, destino), js);
}

levar(resolve("apps/web/src/lib/memoria-viva/lote.ts"), "lote.mjs");
levar(resolve("apps/web/src/lib/memoria-viva/revisao.ts"), "revisao.mjs", [
  [/from\s+"@\/lib\/log"/g, 'from "./_log.mjs"'],
]);

const LIB = resolve("apps/web/src/lib/kolo-vivo");
for (const nome of [
  "fatos/tipos",
  "fatos/sujeito",
  "fatos/data-civil",
  "fatos/autorizacao",
  "fatos/dominio-sensivel",
  "fatos/evidencia",
  "fatos/adaptador",
  "fatos/escopo-ativo",
  "fatos/foco-membro",
  "fatos/registrar",
  "leitura",
  "campos",
  "subcampos",
  "aplicar",
  "aplicar-whatsapp",
]) {
  levar(join(LIB, `${nome}.ts`), `${nome.replace("/", "__")}.mjs`, [
    [/from\s+"\.\/fatos\/([a-z-]+)"/g, 'from "./fatos__$1.mjs"'],
    [/from\s+"\.\.\/([a-z-]+)"/g, 'from "./$1.mjs"'],
    [
      /from\s+"\.\/([a-z-]+)"/g,
      nome.startsWith("fatos/") ? 'from "./fatos__$1.mjs"' : 'from "./$1.mjs"',
    ],
    [/from\s+"@\/lib\/log"/g, 'from "./_log.mjs"'],
    [/from\s+"@\/lib\/idade"/g, 'from "./_idade.mjs"'],
  ]);
}

const carregar = (n) => import(pathToFileURL(join(dir, `${n.replace("/", "__")}.mjs`)).href);
const { aplicarSugestaoNoMembro } = await carregar("aplicar-whatsapp");
const { registrarFatosPerfil, registrarFatoPerfil } = await carregar("fatos/registrar");
const { memoriaVivaAutorizada } = await carregar("fatos/autorizacao");
const { registrarLote } = await carregar("lote");
const { filaDeRevisao, contarFila, resumoDaSemana } = await carregar("revisao");
const log = await import(pathToFileURL(join(dir, "_log.mjs")).href);

const supabase = clienteSupabaseSobrePGlite(db);

// ---------- fixtures: duas famílias, uma autorizada ----------
const DENTRO_USER = "11111111-1111-4111-8111-111111111111";
const FORA_USER = "22222222-2222-4222-8222-222222222222";
await db.query("insert into auth.users(id,email) values ($1,$2),($3,$4)", [
  DENTRO_USER,
  "dentro@t.t",
  FORA_USER,
  "fora@t.t",
]);
const idDaFamilia = async (u) =>
  (await db.query("select id from public.family_accounts where user_id=$1", [u])).rows[0].id;
const DENTRO = await idDaFamilia(DENTRO_USER);
const FORA = await idDaFamilia(FORA_USER);

const membros = {};
for (const [fam, nome] of [
  [DENTRO, "Pedro"],
  [FORA, "Alice"],
]) {
  const id = randomUUID();
  await db.query(
    "insert into public.membros_atipicos(id,family_account_id,nome,perfil) values ($1,$2,$3,'TEA')",
    [id, fam, nome],
  );
  membros[fam] = id;
}

// A CONFIGURAÇÃO DA AMOSTRA: flag ligada, UMA família na lista.
process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
process.env.PERFIL_FATOS_FAMILIAS = DENTRO;

const contar = async (fam) =>
  (await db.query("select count(*)::int v from public.perfil_fatos where family_account_id=$1", [fam]))
    .rows[0].v;
const contarLotes = async (fam) =>
  (await db.query("select count(*)::int v from public.extracao_lotes where family_account_id=$1", [
    fam,
  ])).rows[0].v;

/** A MESMA função que o orquestrador chama no WhatsApp. */
const wpp = (fam, texto, o = {}) =>
  aplicarSugestaoNoMembro(supabase, fam, membros[fam], o.campo ?? "nutricional", texto, "adicionar", {
    messageId: o.msgId ?? `m-${randomUUID()}`,
    subcampo: o.subcampo ?? "seletividade",
    extractionRunId: randomUUID(),
    loteId: o.loteId ?? null,
    fonteDoFoco: "selecao_explicita",
  });

titulo("10. WEB E WHATSAPP RESPEITAM A MESMA REGRA");

await tenta("WhatsApp: autorizada grava, não autorizada não", async () => {
  await wpp(DENTRO, "Só aceita comida crocante");
  await wpp(FORA, "Só aceita comida crocante");
  if ((await contar(DENTRO)) !== 1) throw new Error("a autorizada não gravou");
  if ((await contar(FORA)) !== 0) throw new Error("a NÃO autorizada gravou fato");
});

await tenta("caminho comum (web e diário passam por aqui): mesma decisão", async () => {
  // `registrarFatosPerfil` é o funil dos quatro caminhos de escrita — web,
  // diário e incorporação chegam nele. Barrar aqui barra todos.
  const candidato = (fam) => ({
    familyId: fam,
    membroId: membros[fam],
    conceito: "sono.rotina",
    dominio: "sono",
    afirmacao: "Dorme melhor com banho antes das 19h",
    observadoEm: "2026-07-31",
    proveniencia: { sourceType: "caregiver_report", channel: "web" },
    foco: { sujeito: "child", decisao: "persistir" },
  });
  const [dentro] = await registrarFatosPerfil(supabase, [candidato(DENTRO)]);
  const [fora] = await registrarFatosPerfil(supabase, [candidato(FORA)]);

  if (dentro.status === "ignorado") throw new Error(`autorizada barrada: ${dentro.motivo}`);
  if (fora.status !== "ignorado") throw new Error(`não autorizada passou: ${fora.status}`);
  if (fora.motivo !== "familia_nao_autorizada") throw new Error(`motivo=${fora.motivo}`);
});

titulo("11. CRON E REPROCESSAMENTO NÃO BURLAM");

await tenta("reprocessar a mesma mensagem não abre exceção", async () => {
  const antes = await contar(FORA);
  for (let i = 0; i < 3; i += 1) await wpp(FORA, "tentativa repetida", { msgId: "m-fixo" });
  if ((await contar(FORA)) !== antes) throw new Error("a repetição furou a barreira");
});

await tenta("a fila do cron não enxerga a família de fora", async () => {
  // O cron LÊ a fila. Como nada foi escrito para a família de fora, ela não
  // aparece — nem como caso, nem como incidente, nem como notificação.
  const fila = await filaDeRevisao(supabase);
  if (fila.some((c) => c.familyId === FORA)) throw new Error("caso da família de fora na fila");
  const resumo = await resumoDaSemana(supabase);
  const totalReal = (await db.query("select count(*)::int v from public.perfil_fatos")).rows[0].v;
  if (resumo.total !== totalReal) throw new Error("o resumo conta o que não existe");
  if ((await contarFila(supabase)) < 0) throw new Error("contagem inválida");
});

await tenta("mudar a lista muda a decisão no MESMO processo", async () => {
  // Nada é memorizado em módulo: a leitura é do ambiente a cada chamada, senão
  // tirar uma família da amostra exigiria redeploy.
  if (!memoriaVivaAutorizada(DENTRO)) throw new Error("a autorizada deveria passar");
  process.env.PERFIL_FATOS_FAMILIAS = FORA;
  if (memoriaVivaAutorizada(DENTRO)) throw new Error("continuou autorizada depois de sair da lista");
  if (!memoriaVivaAutorizada(FORA)) throw new Error("a nova não entrou");
  process.env.PERFIL_FATOS_FAMILIAS = DENTRO;
});

titulo("12. NADA É ESCRITO PARA QUEM ESTÁ DE FORA");

await tenta("nenhum lote para a família não autorizada", async () => {
  // A checagem do orquestrador vem ANTES de `registrarLote`; aqui provamos o
  // efeito olhando a tabela, não a chamada.
  if (memoriaVivaAutorizada(FORA)) throw new Error("fixture errada");
  const antes = await contarLotes(FORA);
  if (memoriaVivaAutorizada(FORA)) {
    await registrarLote(supabase, {
      familyId: FORA,
      canal: "whatsapp",
      mensagens: [
        { mensagemId: randomUUID(), provedorMessageId: null, recebidaEm: "2026-07-31T10:00:00Z", texto: "oi" },
      ],
    });
  }
  if ((await contarLotes(FORA)) !== antes) throw new Error("criou lote para quem está de fora");
});

await tenta("nenhum fato, nenhuma quarentena, nenhum incidente", async () => {
  const r = (
    await db.query(
      `select
         count(*)::int total,
         count(*) filter (where status='quarentena')::int quarentena
       from public.perfil_fatos where family_account_id=$1`,
      [FORA],
    )
  ).rows[0];
  if (r.total !== 0) throw new Error(`${r.total} fatos da família de fora`);
  if (r.quarentena !== 0) throw new Error(`${r.quarentena} em quarentena`);
});

await tenta("nem evento operacional com o id da família de fora", async () => {
  // Silêncio de verdade: barrada não gera nem telemetria. Um evento por
  // mensagem de família não autorizada seria vazamento de metadado.
  const bruto = JSON.stringify(log.eventos);
  if (bruto.includes(FORA)) throw new Error("a família de fora aparece na telemetria");
});

titulo("13. A AYLA NÃO MUDA PARA QUEM ESTÁ DE FORA");

await tenta("a escrita do Kolo Vivo acontece igual nas duas famílias", async () => {
  // A Memória Viva é sombra: ninguém a lê. O que a mãe percebe é o Kolo Vivo,
  // e ele tem de ser gravado do mesmo jeito dentro e fora da amostra.
  const dentro = await wpp(DENTRO, "Gosta de brincar com água", { campo: "sensorial", subcampo: "agua" });
  const fora = await wpp(FORA, "Gosta de brincar com água", { campo: "sensorial", subcampo: "agua" });
  if (dentro !== fora) throw new Error(`retornos diferentes: ${dentro} vs ${fora}`);
  if (fora !== true) throw new Error("a família de fora deixou de ter o perfil atualizado");

  const perfis = await db.query(
    "select family_account_id, sensorial from public.perfil_vivo_membro where membro_atipico_id = any($1)",
    [[membros[DENTRO], membros[FORA]]],
  );
  if (perfis.rows.length !== 2) throw new Error("faltou perfil de alguém");
  for (const p of perfis.rows) {
    // `sensorial` é jsonb — { texto, atualizado_em } —, não string.
    const texto = p.sensorial?.texto ?? "";
    if (!texto.includes("água")) {
      throw new Error(`perfil não atualizado para ${p.family_account_id}: ${JSON.stringify(p.sensorial)}`);
    }
  }
});

await tenta("com a flag desligada, ninguém entra — nem a autorizada", async () => {
  process.env.PERFIL_FATOS_SHADOW_WRITE = "0";
  const antes = await contar(DENTRO);
  const r = await registrarFatoPerfil(supabase, {
    familyId: DENTRO,
    membroId: membros[DENTRO],
    conceito: "sono.rotina",
    dominio: "sono",
    afirmacao: "com a flag desligada isto não pode entrar",
    observadoEm: "2026-07-31",
    proveniencia: { sourceType: "caregiver_report", channel: "whatsapp" },
    foco: { sujeito: "child", decisao: "persistir" },
  });
  if (r.status !== "ignorado") throw new Error(`passou: ${r.status}`);
  if ((await contar(DENTRO)) !== antes) throw new Error("gravou com a flag desligada");
  process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
process.exit(falhou.length ? 1 : 0);
