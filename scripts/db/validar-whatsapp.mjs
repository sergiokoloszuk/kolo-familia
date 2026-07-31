#!/usr/bin/env node
/**
 * WHATSAPP PONTA A PONTA — pela fronteira REAL, contra Postgres.
 *
 * O caminho de maior volume da Memória Viva só tinha sido validado por
 * componentes isolados. Aqui a entrada é `aplicarSugestaoNoMembro` — a MESMA
 * função que `ayla/orchestrator.ts` chama —, executando contra PGlite, sem
 * persistência mockada.
 *
 * O risco que estes cenários existem para cercar: o `membroId` que chega ali
 * vem de `ctx.membros[0]` no orquestrador. O primeiro filho do array, não um
 * foco. Numa família com dois filhos, o comportamento errado seria gravar tudo
 * em quem estiver em primeiro, para sempre, sem sinal nenhum.
 *
 *   node scripts/db/validar-whatsapp.mjs
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

// ---------- módulos reais ----------
const require_ = createRequire(import.meta.url);
const ts = require_("typescript");
const LIB = resolve("apps/web/src/lib/kolo-vivo");
const dir = mkdtempSync(join(tmpdir(), "wpp-"));

writeFileSync(
  join(dir, "_log.mjs"),
  "export const eventos=[];export async function logEvent(e){eventos.push(e)}\n",
);
writeFileSync(join(dir, "_idade.mjs"), "export function hojeLocalISO(){return '2026-07-31'}\n");

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
  const js = ts.transpileModule(readFileSync(join(LIB, `${nome}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  writeFileSync(
    join(dir, `${nome.replace("/", "__")}.mjs`),
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
const { aplicarSugestaoNoMembro } = await carregar("aplicar-whatsapp");
const { resolverEvidenciaOriginal } = await carregar("fatos/evidencia");
const log = await import(pathToFileURL(join(dir, "_log.mjs")).href);

// A flag sozinha nao autoriza mais ninguem: a barreira da amostra controlada
// exige a familia na lista. `PERFIL_FATOS_FAMILIAS` e definida logo abaixo,
// depois que a fixture cria a familia — ver fatos/autorizacao.ts.
process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
const supabase = clienteSupabaseSobrePGlite(db);

// ---------- fixtures ----------
const USER = "33333333-3333-3333-3333-333333333333";
await db.query("insert into auth.users(id,email) values ($1,$2)", [USER, "t@t.t"]);
const FAM = (await db.query("select id from public.family_accounts where user_id=$1", [USER]))
  .rows[0].id;
// AUTORIZA A FAMÍLIA DA FIXTURE. Sem isto a barreira da amostra controlada
// bloqueia tudo — que é o comportamento correto, e é o que estes validadores
// deixariam de exercitar. A prova de que a barreira BLOQUEIA quem está de fora
// fica em scripts/db/validar-autorizacao.mjs.
process.env.PERFIL_FATOS_FAMILIAS = FAM;
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

const fatos = async () =>
  (
    await db.query(
      "select *, observado_em::text as data_txt from public.perfil_fatos order by created_at",
    )
  ).rows;
const limpar = () => db.query("delete from public.perfil_fatos");

/** Chama a MESMA função que o orquestrador chama. */
const wpp = (texto, o = {}) =>
  aplicarSugestaoNoMembro(
    o.db ?? supabase,
    FAM,
    o.membroId ?? PEDRO,
    o.campo ?? "nutricional",
    texto,
    "adicionar",
    {
      messageId: o.msgId ?? "m-x",
      subcampo: o.subcampo ?? null,
      extractionRunId: o.run ?? crypto.randomUUID(),
      fonteDoFoco: o.fonte,
    },
  );

titulo("WHATSAPP — FRONTEIRA REAL");

await tenta("1. mensagem normal grava fato ativo com linhagem", async () => {
  await limpar();
  // Foco EXPLICITO: representa a mae que selecionou a crianca. Sem isso, com
  // dois filhos, quarentena seria o comportamento correto - e e o cenario 6.
  await wpp("Nao quis comer no almoco", {
    msgId: "m-1",
    subcampo: "seletividade",
    fonte: "selecao_explicita",
  });
  const f = (await fatos())[0];
  if (!f) throw new Error("nada gravado");
  if (f.status !== "ativo") throw new Error(`status=${f.status}`);
  if (f.membro_atipico_id !== PEDRO) throw new Error("membro errado");
  if (f.family_account_id !== FAM) throw new Error("família errada");
  if (f.source_channel !== "whatsapp") throw new Error(f.source_channel);
  if (f.source_message_id !== "m-1") throw new Error("sem mensagem");
  if (f.source_content_id !== "whatsapp_turn:m-1")
    throw new Error(`evidência=${f.source_content_id}`);
  if (!f.extraction_run_id) throw new Error("sem execução");
  if (f.conceito !== "nutricional.seletividade") throw new Error(f.conceito);
  if (f.fact_kind !== "statement") throw new Error(f.fact_kind);
});

await tenta("2. duplicata: mesma mensagem duas vezes, um fato só", async () => {
  await limpar();
  const dup = { msgId: "m-2", campo: "corpo_rotina", subcampo: "sono", fonte: "selecao_explicita" };
  await wpp("Dormiu a noite toda", dup);
  await wpp("Dormiu a noite toda", dup);
  const n = (await fatos()).length;
  if (n !== 1) throw new Error(`gravou ${n}`);
  const nDup = log.eventos.filter((e) => e.kind === "perfil_fato_duplicado").length;
  if (nDup < 1) throw new Error("sem telemetria de duplicata");
});

await tenta("3. cuidadora falando de si NÃO vira fato da criança", async () => {
  await limpar();
  await wpp("Estou exausta e nao sei mais o que fazer", { msgId: "m-3", campo: "essencial" });
  const fs = await fatos();
  if (fs.length !== 0) throw new Error(`gravou ${fs.length} (status ${fs[0]?.status})`);
});

await tenta("4. outra pessoa NÃO vira fato da criança", async () => {
  await limpar();
  await wpp("A professora perdeu a paciencia", { msgId: "m-4", campo: "escola" });
  if ((await fatos()).length !== 0) throw new Error("gravou fato de outra pessoa");
});

await tenta("5. duas crianças na mesma mensagem → quarentena", async () => {
  await limpar();
  await wpp("O Pedro come bem, mas a irma recusa tudo", { msgId: "m-5" });
  const f = (await fatos())[0];
  if (!f) throw new Error("nada gravado");
  if (f.status !== "quarentena") throw new Error(`status=${f.status}`);
  if (f.sujeito_classificado !== "multiple_or_ambiguous")
    throw new Error(f.sujeito_classificado);
  const ativos = (await fatos()).filter((x) => x.status === "ativo");
  if (ativos.length) throw new Error("quarentena vazou para os ativos");
});

await tenta("6. foco frágil: NÃO grava silenciosamente em membros[0]", async () => {
  await limpar();
  // Sem `fonteDoFoco`, a fronteira não sabe de onde veio o membro. O que se
  // exige aqui é que ela NÃO produza fato ativo às cegas quando a família tem
  // mais de um filho e o texto não diz de quem se trata.
  await wpp("Nao quis comer hoje", { msgId: "m-6" });
  const f = (await fatos())[0];
  if (f && f.status === "ativo") {
    console.log(`        ⚠ gravou ATIVO em ${f.membro_atipico_id === PEDRO ? "Pedro" : "outro"}`);
    throw new Error("gravou ativo sem foco confiável — membros[0] silencioso");
  }
});

await tenta("7. troca de criança no turno: não fica presa ao foco anterior", async () => {
  await limpar();
  await wpp("A Ana tambem comecou a tapar os ouvidos", { msgId: "m-7", campo: "sensorial" });
  const f = (await fatos())[0];
  if (f && f.status === "ativo" && f.membro_atipico_id === PEDRO) {
    throw new Error("gravou silenciosamente no Pedro");
  }
});

await tenta("8. falha de persistência não quebra o turno", async () => {
  const quebrado = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: () => ({
        select: async () => ({ data: null, error: { message: "banco fora" } }),
      }),
    }),
  };
  const antes = log.eventos.length;
  const r = await wpp("Comeu bem no jantar", { msgId: "m-8", db: quebrado });
  if (r !== false && r !== true) throw new Error("a fronteira lançou em vez de devolver");
  const novos = log.eventos.slice(antes);
  console.log(`        devolveu ${r}; eventos novos: ${novos.map((e) => e.kind).join(", ") || "nenhum"}`);
});

await tenta("9. telemetria distingue os estados, sem vazar afirmação", () => {
  const kinds = new Set(log.eventos.map((e) => e.kind));
  for (const k of ["perfil_fato_gravado", "perfil_fato_duplicado", "perfil_fato_rejeitado", "perfil_fato_quarentena"]) {
    if (!kinds.has(k)) throw new Error(`evento ausente: ${k}`);
  }
  const bruto = JSON.stringify(log.eventos);
  for (const t of ["Estou exausta", "professora perdeu", "Nao quis comer"]) {
    if (bruto.includes(t)) throw new Error(`vazou no log: "${t}"`);
  }
});

await tenta("10. linhagem: evidência recuperável e run por execução", async () => {
  await limpar();
  await db.query(
    "insert into public.ayla_messages(family_account_id,direcao,texto,zaap_message_id) values ($1,'inbound','x','m-10')",
    [FAM],
  );
  const run = crypto.randomUUID();
  await wpp("Tapa os ouvidos com barulho alto", {
    msgId: "m-10",
    campo: "sensorial",
    subcampo: "hipersensibilidade_auditiva",
    run,
    fonte: "selecao_explicita",
  });
  const f = (await fatos())[0];
  if (!f) throw new Error("nada gravado");
  if (f.extraction_run_id !== run) throw new Error("run não propagado");

  const ev = await resolverEvidenciaOriginal(supabase, f.source_content_id);
  if (ev?.situacao !== "existente") throw new Error(`evidência ${ev?.situacao}`);
  console.log(`        ${ev.tipo}:${ev.id} → ${ev.situacao} em ${ev.tabela}`);

  const sumida = await resolverEvidenciaOriginal(supabase, "whatsapp_turn:nao-existe");
  if (sumida?.situacao !== "apagada") throw new Error("origem sumida não sinalizada");
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
process.exit(falhou.length ? 1 : 0);
