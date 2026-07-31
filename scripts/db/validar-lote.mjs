#!/usr/bin/env node
/**
 * LOTE DE EXTRAÇÃO — a proveniência da rajada, contra Postgres de verdade.
 *
 * O defeito que estes casos cercam: `lote-inbound.ts` entrega ao extrator o
 * texto de TRÊS mensagens, e o fato guardava o ponteiro de UMA. Quem
 * reconstruísse o caso depois recuperaria um terço da entrada e concluiria que
 * o extrator errou — todo caso capturado de produção nasceria com o insumo
 * errado.
 *
 * Teste unitário prova que a função monta o objeto certo. Só o banco prova que
 * o índice único segura o reprocessamento e que a reconstrução bate.
 *
 *   node scripts/db/validar-lote.mjs
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

// A 0074 tem de estar de pé; sem ela o resto deste arquivo mede nada.
const existe = (
  await db.query("select to_regclass('public.extracao_lotes') is not null as v")
).rows[0].v;
if (!existe) {
  console.log("\n  A migração 0074 não subiu no PGlite — nada a validar.");
  process.exit(1);
}

// ---------- módulos reais ----------
const require_ = createRequire(import.meta.url);
const ts = require_("typescript");
const dir = mkdtempSync(join(tmpdir(), "lote-"));

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

// `aplicar-whatsapp` e sua árvore: é por ela que o fato recebe a linhagem.
const LIB = resolve("apps/web/src/lib/kolo-vivo");
for (const nome of [
  "fatos/tipos",
  "fatos/sujeito",
  "fatos/data-civil",
  "fatos/dominio-sensivel",
  "fatos/evidencia",
  "fatos/adaptador",
  "fatos/escopo-ativo",
  "fatos/foco-membro",
  "fatos/registrar",
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
const { registrarLote, reconstruirTextoDoLote, consolidarTextos, chaveDeMensagens } =
  await carregar("lote");
const { aplicarSugestaoNoMembro } = await carregar("aplicar-whatsapp");
const { resolverEvidenciaOriginal } = await carregar("fatos/evidencia");

process.env.PERFIL_FATOS_SHADOW_WRITE = "1";
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

let relogio = 0;
/** Grava uma inbound como o orquestrador grava, e devolve a forma do lote. */
async function mensagem(texto, zaapId = null) {
  relogio += 1;
  const quando = new Date(Date.UTC(2026, 6, 31, 10, relogio)).toISOString();
  const r = await db.query(
    `insert into public.ayla_messages
       (family_account_id, direcao, texto, recebida_em, created_at, zaap_message_id)
     values ($1,'inbound',$2,$3,$3,$4) returning id, created_at`,
    [FAM, texto, quando, zaapId],
  );
  return {
    mensagemId: r.rows[0].id,
    provedorMessageId: zaapId,
    recebidaEm: quando,
    texto,
  };
}

const contarLotes = async () =>
  (await db.query("select count(*)::int v from public.extracao_lotes")).rows[0].v;

titulo("O LOTE REPRESENTA O INSUMO");

await tenta("1. uma mensagem gera lote reproduzível", async () => {
  const m = await mensagem("Ele não quis almoçar hoje", "zap-1");
  const lote = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: [m] });
  if (!lote) throw new Error("lote não registrado");
  if (lote.quantidade !== 1) throw new Error(`quantidade=${lote.quantidade}`);
  if (lote.jaExistia) throw new Error("nasceu marcado como repetido");

  const r = await reconstruirTextoDoLote(supabase, lote.id);
  if (!r) throw new Error("não reconstruiu");
  if (!r.confere) throw new Error("hash não bate");
  if (r.texto !== lote.texto) throw new Error("texto reconstruído difere");
});

await tenta("2. rajada de três fica no mesmo lote e na ordem certa", async () => {
  const a = await mensagem("oi", "z-a");
  const b = await mensagem("queria te contar uma coisa", "z-b");
  const c = await mensagem("ele dormiu a noite toda ontem", "z-c");
  // Fora de ordem de propósito: a ordem é a da chegada, não a do array.
  const lote = await registrarLote(supabase, {
    familyId: FAM,
    canal: "whatsapp",
    mensagens: [c, a, b],
  });
  if (lote.quantidade !== 3) throw new Error(`quantidade=${lote.quantidade}`);

  const linha = (
    await db.query("select mensagens from public.extracao_lotes where id=$1", [lote.id])
  ).rows[0];
  const refs = linha.mensagens;
  if (refs.length !== 3) throw new Error(`${refs.length} refs`);
  if (refs[0].mensagem_id !== a.mensagemId) throw new Error("primeira fora de ordem");
  if (refs[2].mensagem_id !== c.mensagemId) throw new Error("última fora de ordem");
  if (refs.map((r) => r.ordem).join(",") !== "0,1,2") throw new Error("ordem não sequencial");

  // O que importa de verdade: o texto é a fala inteira, não um terço dela.
  if (lote.texto !== "oi\nqueria te contar uma coisa\nele dormiu a noite toda ontem") {
    throw new Error(`texto=${JSON.stringify(lote.texto)}`);
  }
});

await tenta("3. o texto reconstruído é igual ao entregue ao extrator", async () => {
  const ms = [
    await mensagem("ontem foi difícil", "z-d1"),
    await mensagem("ele chorou na porta da escola", "z-d2"),
  ];
  // O que o orquestrador entrega ao extrator sai desta função.
  const entregue = consolidarTextos(ms.map((m) => m.texto));
  const lote = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: ms });

  const r = await reconstruirTextoDoLote(supabase, lote.id);
  if (r.texto !== entregue) throw new Error("reconstrução != entrega");
  if (!r.confere) throw new Error("hash não confirma");
  if (r.ausentes.length) throw new Error("acusou ausência inexistente");
});

await tenta("3b. adulterar a origem faz a reconstrução acusar, não mentir", async () => {
  const ms = [await mensagem("dorme melhor com banho antes das 19h", "z-e1")];
  const lote = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: ms });
  await db.query("update public.ayla_messages set texto=$1 where id=$2", [
    "outra coisa completamente",
    ms[0].mensagemId,
  ]);
  const r = await reconstruirTextoDoLote(supabase, lote.id);
  if (r.confere) throw new Error("disse que confere depois de adulterada");
});

titulo("O FATO APONTA PARA O LOTE");

await tenta("4. o fato gravado carrega a evidência do lote, não de uma mensagem", async () => {
  await db.query("delete from public.perfil_fatos");
  const ms = [
    await mensagem("ele só come coisa crocante", "z-f1"),
    await mensagem("nada de textura mole", "z-f2"),
  ];
  const lote = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: ms });

  await aplicarSugestaoNoMembro(
    supabase,
    FAM,
    PEDRO,
    "nutricional",
    "Só aceita alimentos crocantes; recusa textura mole",
    "adicionar",
    {
      messageId: "z-f2",
      subcampo: "seletividade",
      extractionRunId: randomUUID(),
      loteId: lote.id,
      fonteDoFoco: "selecao_explicita",
    },
  );

  const f = (await db.query("select * from public.perfil_fatos")).rows[0];
  if (!f) throw new Error("nada gravado");
  if (f.source_content_id !== `extracao_lote:${lote.id}`) {
    throw new Error(`evidência=${f.source_content_id}`);
  }
  // O id da mensagem NÃO se perde — deixa de ser a evidência, continua sendo
  // proveniência. São coisas diferentes e as duas importam.
  if (f.source_message_id !== "z-f2") throw new Error("perdeu a mensagem");

  const ev = await resolverEvidenciaOriginal(supabase, f.source_content_id);
  if (!ev) throw new Error("evidência não resolve");
  if (ev.tipo !== "extracao_lote") throw new Error(ev.tipo);
  if (ev.situacao !== "existente") throw new Error(`situação=${ev.situacao}`);
  if (ev.familyId !== FAM) throw new Error("família errada na evidência");
});

await tenta("4b. sem lote, a linhagem cai para o ponteiro antigo em vez de sumir", async () => {
  await db.query("delete from public.perfil_fatos");
  await aplicarSugestaoNoMembro(
    supabase,
    FAM,
    PEDRO,
    "corpo_rotina",
    "Dormiu a noite toda",
    "adicionar",
    {
      messageId: "z-g1",
      subcampo: "sono",
      extractionRunId: randomUUID(),
      loteId: null,
      fonteDoFoco: "selecao_explicita",
    },
  );
  const f = (await db.query("select * from public.perfil_fatos")).rows[0];
  if (f.source_content_id !== "whatsapp_turn:z-g1") throw new Error(f.source_content_id);
});

titulo("REPROCESSAMENTO E REPETIÇÃO LEGÍTIMA");

await tenta("5. reprocessar as mesmas mensagens não cria lote novo", async () => {
  const ms = [await mensagem("teve crise na troca de sala", "z-h1")];
  const antes = await contarLotes();
  const p = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: ms });
  const meio = await contarLotes();
  const s = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: ms });
  const depois = await contarLotes();

  if (meio !== antes + 1) throw new Error("primeira passada não criou");
  if (depois !== meio) throw new Error("reprocessamento criou lote duplicado");
  if (s.id !== p.id) throw new Error("reprocessamento devolveu outro lote");
  if (!s.jaExistia) throw new Error("não sinalizou que já existia");
  if (p.jaExistia) throw new Error("a primeira se disse repetida");
});

await tenta("5b. a mãe repetir a MESMA frase amanhã é lote novo, não duplicata", async () => {
  const frase = "ele não come nada de textura mole";
  const hoje = [await mensagem(frase, "z-i1")];
  const amanha = [await mensagem(frase, "z-i2")];
  const a = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: hoje });
  const b = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: amanha });

  if (a.id === b.id) throw new Error("repetição legítima virou reprocessamento");
  // O texto é o mesmo, e é por isso que a chave NÃO pode ser o texto.
  if (a.texto !== b.texto) throw new Error("os textos deveriam ser iguais");
  if (chaveDeMensagens(hoje.map((m) => m.mensagemId)) ===
      chaveDeMensagens(amanha.map((m) => m.mensagemId))) {
    throw new Error("chaves colidiram");
  }
});

titulo("MENSAGEM SEM ID DO PROVEDOR");

await tenta("6. sem messageId, a evidência interna continua recuperável", async () => {
  const m = await mensagem("mandou áudio e a transcrição veio sem id", null);
  const lote = await registrarLote(supabase, { familyId: FAM, canal: "whatsapp", mensagens: [m] });
  if (!lote) throw new Error("não registrou lote sem id externo");

  const refs = (
    await db.query("select mensagens from public.extracao_lotes where id=$1", [lote.id])
  ).rows[0].mensagens;
  // Ausência EXPLÍCITA. Um id externo inventado faria a evidência parecer
  // recuperável fora daqui, e ela não é.
  if (refs[0].provedor_message_id !== null) throw new Error("inventou id do provedor");
  if (!refs[0].mensagem_id) throw new Error("perdeu o id interno");

  const r = await reconstruirTextoDoLote(supabase, lote.id);
  if (!r.confere) throw new Error("não reconstruiu sem id do provedor");
  if (r.texto !== m.texto) throw new Error("texto errado");
});

titulo("COMPATIBILIDADE E PRESERVAÇÃO");

await tenta("7. fato com evidência antiga (whatsapp_turn) continua legível", async () => {
  const m = await mensagem("registro de antes da 0074", "z-legado");
  const ev = await resolverEvidenciaOriginal(supabase, `whatsapp_turn:z-legado`);
  if (!ev) throw new Error("não resolveu o formato antigo");
  if (ev.tipo !== "whatsapp_turn") throw new Error(ev.tipo);
  if (ev.situacao !== "existente") throw new Error(`situação=${ev.situacao}`);
  if (!m.mensagemId) throw new Error("fixture inválida");
});

await tenta("7b. evidência de lote que sumiu vira 'apagada', não erro", async () => {
  const ev = await resolverEvidenciaOriginal(
    supabase,
    "extracao_lote:00000000-0000-0000-0000-000000000000",
  );
  if (!ev) throw new Error("devolveu nulo em vez de situação");
  if (ev.situacao !== "apagada") throw new Error(`situação=${ev.situacao}`);
});

await tenta("8. nada é apagado — mensagens e fatos continuam no banco", async () => {
  const msgs = (await db.query("select count(*)::int v from public.ayla_messages")).rows[0].v;
  if (msgs < 12) throw new Error(`só ${msgs} mensagens; algo sumiu`);
  const lotes = await contarLotes();
  if (lotes < 8) throw new Error(`só ${lotes} lotes`);
  // Nenhuma mensagem ficou órfã do seu lote.
  const orfaos = (
    await db.query(`
      select count(*)::int v from public.extracao_lotes l,
        lateral jsonb_array_elements(l.mensagens) r
      where not exists (
        select 1 from public.ayla_messages m
        where m.id = (r->>'mensagem_id')::uuid
      )`)
  ).rows[0].v;
  if (orfaos > 0) throw new Error(`${orfaos} referências órfãs`);
});

titulo("REVERSÃO");

await tenta("9. o rollback da 0074 desfaz sem tocar em fato nenhum", async () => {
  const fatosAntes = (await db.query("select count(*)::int v from public.perfil_fatos")).rows[0].v;
  const msgsAntes = (await db.query("select count(*)::int v from public.ayla_messages")).rows[0].v;

  await db.exec(readFileSync(join(DIR, "0074_rollback.sql"), "utf8"));

  const aindaExiste = (
    await db.query("select to_regclass('public.extracao_lotes') is not null as v")
  ).rows[0].v;
  if (aindaExiste) throw new Error("a tabela sobreviveu ao rollback");

  const fatosDepois = (await db.query("select count(*)::int v from public.perfil_fatos")).rows[0].v;
  const msgsDepois = (await db.query("select count(*)::int v from public.ayla_messages")).rows[0].v;
  if (fatosDepois !== fatosAntes) throw new Error("o rollback levou fatos junto");
  if (msgsDepois !== msgsAntes) throw new Error("o rollback levou mensagens junto");

  // A evidência do lote deixa de resolver — e o certo é dizer isso, não fingir.
  const f = (
    await db.query(
      "select source_content_id from public.perfil_fatos where source_content_id like 'extracao_lote:%' limit 1",
    )
  ).rows[0];
  if (f) {
    const ev = await resolverEvidenciaOriginal(supabase, f.source_content_id);
    if (ev?.situacao !== "inacessivel" && ev?.situacao !== "apagada") {
      throw new Error(`evidência órfã devolveu ${ev?.situacao}`);
    }
  }

  // E a migração reaplica sobre o banco já sem ela.
  await db.exec(
    readFileSync(join(DIR, "0074_extracao_lotes.sql"), "utf8").replace(
      /create extension if not exists\s+"?[a-z_-]+"?[^;]*;/gi,
      "",
    ),
  );
  const voltou = (
    await db.query("select to_regclass('public.extracao_lotes') is not null as v")
  ).rows[0].v;
  if (!voltou) throw new Error("não reaplicou depois do rollback");
});

titulo("RESULTADO");
console.log(`  passou: ${ok.length}   falhou: ${falhou.length}`);
for (const [n, m] of falhou) console.log(`  X ${n}\n     ${m}`);
process.exit(falhou.length ? 1 : 0);
