#!/usr/bin/env node
/**
 * VALIDAÇÃO PONTA A PONTA DOS CAMINHOS DE ESCRITA.
 *
 * A validação anterior provou que o SCHEMA funciona. Esta prova que a
 * APLICAÇÃO grava o que o schema promete — as funções reais
 * (`aplicarPropostaNoPerfil`, `aplicarItensNoMembro`) rodando contra Postgres
 * de verdade, sem persistência mockada.
 *
 * O que é mockado: nada da persistência. Só o log, para inspeção, e o relógio.
 *
 *   node scripts/db/validar-pipeline.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { clienteSupabaseSobrePGlite, CONTRATO_POSTGREST } from "./pglite-supabase.mjs";

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

// ============================================================
// Banco
// ============================================================
titulo("1. BANCO");
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
let aplicadas = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql") && !x.includes("rollback")).sort()) {
  try {
    await db.exec(
      readFileSync(join(DIR, f), "utf8").replace(
        /create extension if not exists\s+"?[a-z_-]+"?[^;]*;/gi,
        "",
      ),
    );
    aplicadas += 1;
  } catch {
    try {
      await db.exec("rollback");
    } catch {
      /* sem transação */
    }
  }
}
console.log(`  migrações aplicadas: ${aplicadas}`);

// ============================================================
// Módulos REAIS da aplicação
// ============================================================
titulo("2. MÓDULOS DA APLICAÇÃO");
const require_ = createRequire(import.meta.url);
const ts = require_("typescript");
const LIB = resolve("apps/web/src/lib/kolo-vivo");
const dir = mkdtempSync(join(tmpdir(), "pipe-"));

const eventos = [];
writeFileSync(
  join(dir, "_log.mjs"),
  "export const eventos=[];export async function logEvent(e){eventos.push(e)}\n",
);
writeFileSync(join(dir, "_idade.mjs"), "export function hojeLocalISO(){return '2026-07-31'}\n");

const modulos = [
  ["fatos/tipos", "fatos"],
  ["fatos/sujeito", "fatos"],
  ["fatos/adaptador", "fatos"],
  ["fatos/escopo-ativo", "fatos"],
  ["fatos/foco-membro", "fatos"],
  ["fatos/registrar", "fatos"],
  ["campos", "."],
  ["subcampos", "."],
  ["aplicar", "."],
  ["incorporar", "."],
];
for (const [nome] of modulos) {
  const js = ts.transpileModule(readFileSync(join(LIB, `${nome}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const plano = nome.replace("/", "__");
  writeFileSync(
    join(dir, `${plano}.mjs`),
    js
      .replace(/from\s+"\.\/fatos\/([a-z-]+)"/g, 'from "./fatos__$1.mjs"')
      .replace(/from\s+"\.\.\/([a-z-]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"\.\/([a-z-]+)"/g, (_m, p) =>
        nome.startsWith("fatos/") ? `from "./fatos__${p}.mjs"` : `from "./${p}.mjs"`,
      )
      .replace(/from\s+"@\/lib\/log"/g, 'from "./_log.mjs"')
      .replace(/from\s+"@\/lib\/idade"/g, 'from "./_idade.mjs"'),
  );
}
const carregar = (n) => import(pathToFileURL(join(dir, `${n.replace("/", "__")}.mjs`)).href);
const { aplicarPropostaNoPerfil } = await carregar("aplicar");
const { aplicarItensNoMembro } = await carregar("incorporar");
const { registrarFatoPerfil } = await carregar("fatos/registrar");
const { candidatoDeItemKoloVivo } = await carregar("fatos/adaptador");
const { resolverMembro } = await carregar("fatos/foco-membro");
const log = await import(pathToFileURL(join(dir, "_log.mjs")).href);
console.log("  carregados: aplicar, incorporar, registrar, adaptador, foco-membro");

process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
const registroSql = [];
const supabase = clienteSupabaseSobrePGlite(db, registroSql);

// ============================================================
// Família de teste — pelo caminho real (trigger)
// ============================================================
titulo("3. FIXTURES");
const USER = "33333333-3333-3333-3333-333333333333";
await db.query("insert into auth.users(id, email) values ($1,$2)", [USER, "t@t.t"]);
const FAM = (await db.query("select id from public.family_accounts where user_id=$1", [USER]))
  .rows[0].id;
const PEDRO = "22222222-2222-2222-2222-222222222222";
const ANA = "44444444-4444-4444-4444-444444444444";
for (const [id, nome] of [
  [PEDRO, "Pedro"],
  [ANA, "Ana"],
]) {
  await db.query(
    "insert into public.membros_atipicos(id,family_account_id,nome,perfil) values ($1,$2,$3,'TEA')",
    [id, FAM, nome],
  );
}
console.log(`  família ${FAM.slice(0, 8)}… com Pedro e Ana`);

// `observado_em::text` de proposito: o driver converte `date` em Date na
// meia-noite UTC, e em Brasilia (UTC-3) isso EXIBE o dia anterior. O banco
// guarda certo; quem desloca e o JavaScript. Ler como texto mostra o que
// realmente esta armazenado.
const fatosDe = async (where = "") =>
  (
    await db.query(
      `select *, observado_em::text as observado_em_txt from public.perfil_fatos ${where} order by created_at`,
    )
  ).rows;
const limpar = () => db.query("delete from public.perfil_fatos");

const item = (over = {}) => ({
  camada: "camada1",
  campo: "nutricional",
  subcampo: "seletividade",
  texto: "Não quis comer no almoço",
  operacao: "adicionar",
  ...over,
});

// ============================================================
// CAMINHO 1 e 2 — web manual e web automático
// ============================================================
titulo("4. CAMINHO WEB (manual e automático)");

await tenta("A. fato legítimo grava com origem, membro e linhagem", async () => {
  await limpar();
  await aplicarPropostaNoPerfil(supabase, {
    familyId: FAM,
    membroId: PEDRO,
    itens: [item()],
    fatos: {
      proveniencia: {
        sourceType: "caregiver_report",
        channel: "web",
        conversationId: "55555555-5555-5555-5555-555555555555",
      },
      verificationStatus: "reported",
    },
  });
  const f = (await fatosDe())[0];
  if (!f) throw new Error("nenhum fato gravado");
  if (f.membro_atipico_id !== PEDRO) throw new Error("membro errado");
  if (f.family_account_id !== FAM) throw new Error("família errada");
  if (f.conceito !== "nutricional.seletividade") throw new Error(`conceito=${f.conceito}`);
  if (f.dominio !== "nutricional") throw new Error("domínio errado");
  if (f.source_channel !== "web") throw new Error("canal errado");
  if (f.verification_status !== "reported") throw new Error(`status=${f.verification_status}`);
  if (f.fact_kind !== "statement") throw new Error("natureza errada");
  if (f.status !== "ativo") throw new Error("status errado");
  if (!f.extractor_version) throw new Error("sem versão do extrator");
  if (f.observado_em_txt !== "2026-07-31") throw new Error(`data=${f.observado_em_txt}`);
});

await tenta("B. repetição idêntica NÃO duplica (idempotência real)", async () => {
  await limpar();
  const chamada = () =>
    aplicarPropostaNoPerfil(supabase, {
      familyId: FAM,
      membroId: PEDRO,
      itens: [item()],
      fatos: {
        proveniencia: { sourceType: "caregiver_report", channel: "web" },
        verificationStatus: "reported",
        observadoEm: "2026-07-31",
      },
    });
  await chamada();
  await chamada();
  const n = (await fatosDe()).length;
  if (n !== 1) throw new Error(`gravou ${n} fatos, esperado 1`);
});

await tenta("C. cuidadora falando de si NÃO vira fato da criança", async () => {
  await limpar();
  await aplicarPropostaNoPerfil(supabase, {
    familyId: FAM,
    membroId: PEDRO,
    itens: [item({ campo: "essencial", subcampo: null, texto: "Estou exausta hoje" })],
    fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
  });
  const fs = await fatosDe();
  if (fs.length !== 0) throw new Error(`gravou ${fs.length} fatos (status ${fs[0]?.status})`);
});

await tenta("D. outra pessoa NÃO vira fato da criança", async () => {
  await limpar();
  await aplicarPropostaNoPerfil(supabase, {
    familyId: FAM,
    membroId: PEDRO,
    itens: [item({ campo: "escola", subcampo: null, texto: "A professora ficou nervosa" })],
    fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
  });
  if ((await fatosDe()).length !== 0) throw new Error("gravou fato de outra pessoa");
});

await tenta("E. duas crianças → quarentena, nunca atribuição silenciosa", async () => {
  await limpar();
  const cand = candidatoDeItemKoloVivo({
    familyId: FAM,
    membroId: PEDRO,
    campo: "socializacao",
    texto: "O Pedro brinca, mas a irmã não interage",
    proveniencia: { sourceType: "caregiver_report", channel: "web" },
  });
  const foco = resolverMembro({
    membroId: PEDRO,
    fonte: "vinculo_da_conversa",
    texto: cand.afirmacao,
    nomesDaFamilia: [
      { id: PEDRO, nome: "Pedro" },
      { id: ANA, nome: "Ana" },
    ],
  });
  await registrarFatoPerfil(supabase, { ...cand, foco });
  const fs = await fatosDe();
  if (fs.length !== 1) throw new Error(`esperava 1 linha em quarentena, veio ${fs.length}`);
  if (fs[0].status !== "quarentena") throw new Error(`status=${fs[0].status}`);
  if (!fs[0].quarentena_motivo) throw new Error("sem motivo de quarentena");
  if (fs[0].sujeito_classificado !== "multiple_or_ambiguous")
    throw new Error(`sujeito=${fs[0].sujeito_classificado}`);
  const ativos = await fatosDe("where status='ativo'");
  if (ativos.length !== 0) throw new Error("quarentena vazou para os ativos");
});

await tenta("F. foco frágil com dois membros vai para quarentena", async () => {
  await limpar();
  const cand = candidatoDeItemKoloVivo({
    familyId: FAM,
    membroId: PEDRO,
    campo: "corpo_rotina",
    subcampo: "sono",
    texto: "Dormiu bem essa noite",
    proveniencia: { sourceType: "caregiver_report", channel: "whatsapp", messageId: "m-1" },
  });
  const foco = resolverMembro({
    membroId: PEDRO,
    fonte: "primeiro_da_familia",
    texto: cand.afirmacao,
    nomesDaFamilia: [
      { id: PEDRO, nome: "Pedro" },
      { id: ANA, nome: "Ana" },
    ],
  });
  await registrarFatoPerfil(supabase, { ...cand, foco });
  const fs = await fatosDe();
  if (fs[0]?.status !== "quarentena") throw new Error(`status=${fs[0]?.status}`);
  if (fs[0].quarentena_motivo !== "foco_fragil") throw new Error(fs[0].quarentena_motivo);
});

// ============================================================
// CAMINHO 3 — diário
// ============================================================
titulo("5. CAMINHO DIÁRIO");

await tenta("A. grava com entrada manual, canal diário e autor", async () => {
  await limpar();
  await aplicarItensNoMembro(supabase, FAM, PEDRO, [item()], {
    proveniencia: {
      sourceType: "manual_entry",
      channel: "diario",
      actorId: USER,
    },
    verificationStatus: "reported",
    observadoEm: "2026-07-30",
  });
  const f = (await fatosDe())[0];
  if (!f) throw new Error("nenhum fato gravado");
  if (f.source_type !== "manual_entry") throw new Error(f.source_type);
  if (f.source_channel !== "diario") throw new Error(f.source_channel);
  if (f.source_actor_id !== USER) throw new Error("autor não gravado");
  if (f.source_message_id !== null) throw new Error("inventou messageId");
  if (f.observado_em_txt !== "2026-07-30") throw new Error(`observado_em=${f.observado_em_txt}`);
});

await tenta("B. salvar o mesmo diário duas vezes não duplica", async () => {
  await limpar();
  const origem = {
    proveniencia: { sourceType: "manual_entry", channel: "diario", actorId: USER },
    observadoEm: "2026-07-30",
  };
  await aplicarItensNoMembro(supabase, FAM, PEDRO, [item()], origem);
  await aplicarItensNoMembro(supabase, FAM, PEDRO, [item()], origem);
  const n = (await fatosDe()).length;
  if (n !== 1) throw new Error(`gravou ${n}`);
});

await tenta("B2. o mesmo item em OUTRO dia é evidência nova", async () => {
  await aplicarItensNoMembro(supabase, FAM, PEDRO, [item()], {
    proveniencia: { sourceType: "manual_entry", channel: "diario", actorId: USER },
    observadoEm: "2026-08-05",
  });
  const n = (await fatosDe()).length;
  if (n !== 2) throw new Error(`esperava 2 evidências, veio ${n}`);
});

// ============================================================
// Temporalidade e linhagem
// ============================================================
titulo("6. TEMPORALIDADE E LINHAGEM");

await tenta("observado_em NÃO é truncado silenciosamente de um ISO com hora", async () => {
  await limpar();
  await aplicarItensNoMembro(supabase, FAM, PEDRO, [item({ texto: "Comeu bem no jantar" })], {
    proveniencia: { sourceType: "manual_entry", channel: "diario", actorId: USER },
    observadoEm: "2026-08-10T23:45:00Z",
  });
  const f = (await fatosDe())[0];
  if (!f) throw new Error("não gravou");
  const d = f.observado_em_txt;
  console.log(`        ISO "2026-08-10T23:45:00Z" -> observado_em armazenado = ${d}`);
  // O Postgres ACEITA um ISO com hora numa coluna `date` e TRUNCA em silencio.
  // Nao e erro de banco: e informacao perdida sem aviso. Se algum chamador
  // passar um timestamp, a hora some e ninguem percebe.
  if (d !== "2026-08-10") throw new Error(`truncou para ${d}, esperado 2026-08-10`);

  // E o alerta que vale para TODO consumidor futuro (Retrato, relatorios):
  // ler a coluna como Date e formatar em horario local desloca um dia no
  // Brasil. Registrado aqui para a decisao ser consciente.
  const comoDate = new Date(f.observado_em).toISOString().slice(0, 10);
  const localBR = new Date(f.observado_em).toLocaleDateString("pt-BR");
  console.log(`        como Date -> ISO ${comoDate} | local BR ${localBR}`);
});

await tenta("linhagem: source_content_id e extraction_run_id persistem", async () => {
  await limpar();
  const runId = "66666666-6666-6666-6666-666666666666";
  await registrarFatoPerfil(supabase, {
    ...candidatoDeItemKoloVivo({
      familyId: FAM,
      membroId: PEDRO,
      campo: "sensorial",
      subcampo: "hipersensibilidade_auditiva",
      texto: "Tapa os ouvidos com barulho alto",
      proveniencia: { sourceType: "caregiver_report", channel: "diario", actorId: USER },
    }),
    linhagem: { sourceContentId: "diarios:abc-123", extractionRunId: runId },
  });
  const f = (await fatosDe())[0];
  if (f.source_content_id !== "diarios:abc-123") throw new Error("sem conteúdo de origem");
  if (f.extraction_run_id !== runId) throw new Error("sem execução de extração");
});

// ============================================================
// Falha de banco
// ============================================================
titulo("7. FALHA DE PERSISTÊNCIA");

await tenta("J. falha do banco não quebra o fluxo principal", async () => {
  const quebrado = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: () => ({ select: async () => ({ data: null, error: { message: "banco fora" } }) }),
    }),
  };
  const antes = log.eventos.length;
  const r = await aplicarPropostaNoPerfil(quebrado, {
    familyId: FAM,
    membroId: PEDRO,
    itens: [item()],
    fatos: { proveniencia: { sourceType: "caregiver_report", channel: "web" } },
  });
  if (r.erro) throw new Error("a falha da sombra derrubou o caminho principal");
  const novos = log.eventos.slice(antes);
  if (!novos.some((e) => e.kind === "perfil_fato_falhou")) {
    throw new Error("a falha não ficou observável");
  }
});

// ============================================================
// Telemetria
// ============================================================
titulo("8. TELEMETRIA");
const kinds = new Map();
for (const e of log.eventos) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
for (const [k, v] of [...kinds].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

await tenta("os eventos distinguem gravado, duplicado, rejeitado, quarentena e falha", () => {
  const precisa = [
    "perfil_fato_gravado",
    "perfil_fato_duplicado",
    "perfil_fato_rejeitado",
    "perfil_fato_quarentena",
    "perfil_fato_falhou",
  ];
  const faltando = precisa.filter((k) => !kinds.has(k));
  if (faltando.length) throw new Error(`eventos ausentes: ${faltando.join(", ")}`);
});

await tenta("nenhuma afirmação aparece na telemetria", () => {
  const bruto = JSON.stringify(log.eventos);
  for (const t of ["Não quis comer", "Estou exausta", "professora ficou nervosa"]) {
    if (bruto.includes(t)) throw new Error(`vazou: "${t}"`);
  }
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
console.log(
  `\n  CONTRATO POSTGREST: ${CONTRATO_POSTGREST.verificado ? "verificado" : "NÃO VERIFICADO"}`,
);
console.log(`  menor experimento: ${CONTRATO_POSTGREST.menorExperimento}`);
process.exit(falhou.length ? 1 : 0);
