/**
 * Backfill histórico: popula `ayla_eventos_longitudinais` a partir do que já
 * existe em `ayla_messages`, `diarios` e `check_ins_diarios`.
 *
 * Os triggers criados em supabase/migrations/0020_ayla_eventos_etl.sql só
 * pegam INSERTs futuros. Este script cuida do passado.
 *
 * Idempotente: roda quantas vezes quiser. O constraint UNIQUE (source_key)
 * descarta duplicações silenciosamente (ON CONFLICT DO NOTHING).
 *
 * Uso:
 *   node apps/web/scripts/ayla-eventos-backfill.mjs [--dry-run]
 *
 * Variáveis necessárias em apps/web/.env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Carrega .env.local manualmente (sem dotenv pra evitar dep extra).
const envPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env.local",
);
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

console.log(`\n=== Ayla Eventos — Backfill ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

// ============================================================
// Helpers
// ============================================================

/**
 * Insere uma lista de eventos em ayla_eventos_longitudinais.
 * Quando DRY_RUN, apenas conta.
 */
async function inserirEventos(eventos, label) {
  if (eventos.length === 0) return { inseridos: 0, conflitos: 0 };

  if (DRY_RUN) {
    console.log(`  [dry] seria inserir ${eventos.length} de ${label}`);
    return { inseridos: eventos.length, conflitos: 0 };
  }

  // upsert com source_key conflict → ignora duplicatas
  const { error, data } = await supabase
    .from("ayla_eventos_longitudinais")
    .upsert(eventos, {
      onConflict: "source_key",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    console.error(`  ✗ erro em ${label}:`, error.message);
    return { inseridos: 0, conflitos: 0 };
  }
  const inseridos = data?.length ?? 0;
  const conflitos = eventos.length - inseridos;
  return { inseridos, conflitos };
}

function mid(ts) {
  // 'YYYY-MM-DD' → ISO timestamptz at noon (preserva ordem cronológica)
  return new Date(`${ts}T12:00:00.000Z`).toISOString();
}

// ============================================================
// 1) Backfill de ayla_messages (só inbound)
// ============================================================

async function backfillMessages() {
  console.log("→ ayla_messages (inbound)");

  let offset = 0;
  let total = 0;
  let totalInseridos = 0;
  let totalConflitos = 0;

  while (true) {
    const { data: msgs, error } = await supabase
      .from("ayla_messages")
      .select(
        "id, family_account_id, membro_atipico_id, direcao, category, tipo, texto, recebida_em, created_at",
      )
      .eq("direcao", "inbound")
      .order("created_at", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!msgs || msgs.length === 0) break;

    // Pra cada inbound, decide se é check_in_resposta (precisa lookup das outbound recentes).
    // Pra eficiência no batch, agrupa por family e busca todas outbound proativas.
    const familias = [...new Set(msgs.map((m) => m.family_account_id))];
    const { data: outbounds } = await supabase
      .from("ayla_messages")
      .select("family_account_id, created_at")
      .in("family_account_id", familias)
      .eq("direcao", "outbound")
      .eq("category", "proativa");

    const outboundsByFamilia = new Map();
    for (const o of outbounds ?? []) {
      const arr = outboundsByFamilia.get(o.family_account_id) ?? [];
      arr.push(new Date(o.created_at).getTime());
      outboundsByFamilia.set(o.family_account_id, arr);
    }

    const eventos = msgs.map((m) => {
      const created = new Date(m.created_at).getTime();
      const outs = outboundsByFamilia.get(m.family_account_id) ?? [];
      const houveProativa24h = outs.some(
        (t) => t < created && t > created - 24 * 60 * 60 * 1000,
      );
      const tipo = houveProativa24h ? "check_in_resposta" : "conversa_turno";

      return {
        family_account_id: m.family_account_id,
        membro_atipico_id: m.membro_atipico_id,
        tipo,
        dominios: [],
        intensidade: null,
        ocorreu_em: m.recebida_em ?? m.created_at,
        texto_livre: m.texto,
        metadados: {
          source: "ayla_messages",
          source_id: m.id,
          direcao: m.direcao,
          category: m.category,
          tipo_v1: m.tipo,
        },
        source_key: `ayla_messages:${m.id}:_`,
      };
    });

    const { inseridos, conflitos } = await inserirEventos(eventos, "ayla_messages");
    totalInseridos += inseridos;
    totalConflitos += conflitos;
    total += msgs.length;

    process.stdout.write(`  · batch ${offset}-${offset + msgs.length}: +${inseridos} (${conflitos} já existiam)\r`);

    if (msgs.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`\n  ✓ ${total} mensagens lidas, ${totalInseridos} eventos criados, ${totalConflitos} já existiam.\n`);
}

// ============================================================
// 2) Backfill de diarios (1-3 eventos por linha)
// ============================================================

async function backfillDiarios() {
  console.log("→ diarios");

  let offset = 0;
  let totalLinhas = 0;
  let totalInseridos = 0;
  let totalConflitos = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("diarios")
      .select(
        "id, family_account_id, membro_atipico_id, data, conquista, desafio, observacao_livre, possivel_gatilho, origem",
      )
      .order("data", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;

    const eventos = [];
    for (const d of rows) {
      const ocorreuEm = mid(d.data);

      if (d.conquista && d.conquista.trim().length > 0) {
        eventos.push({
          family_account_id: d.family_account_id,
          membro_atipico_id: d.membro_atipico_id,
          tipo: "conquista_relatada",
          dominios: [],
          intensidade: null,
          ocorreu_em: ocorreuEm,
          texto_livre: d.conquista,
          metadados: {
            source: "diarios",
            source_id: d.id,
            campo: "conquista",
            origem_v1: d.origem,
          },
          source_key: `diarios:${d.id}:conquista`,
        });
      }
      if (d.desafio && d.desafio.trim().length > 0) {
        eventos.push({
          family_account_id: d.family_account_id,
          membro_atipico_id: d.membro_atipico_id,
          tipo: "registro_explicito",
          dominios: [],
          intensidade: null,
          ocorreu_em: ocorreuEm,
          texto_livre: d.desafio,
          metadados: {
            source: "diarios",
            source_id: d.id,
            campo: "desafio",
            possivel_gatilho: d.possivel_gatilho,
            origem_v1: d.origem,
          },
          source_key: `diarios:${d.id}:desafio`,
        });
      }
      if (d.observacao_livre && d.observacao_livre.trim().length > 0) {
        eventos.push({
          family_account_id: d.family_account_id,
          membro_atipico_id: d.membro_atipico_id,
          tipo: "registro_explicito",
          dominios: [],
          intensidade: null,
          ocorreu_em: ocorreuEm,
          texto_livre: d.observacao_livre,
          metadados: {
            source: "diarios",
            source_id: d.id,
            campo: "observacao_livre",
            origem_v1: d.origem,
          },
          source_key: `diarios:${d.id}:observacao_livre`,
        });
      }
    }

    const { inseridos, conflitos } = await inserirEventos(eventos, "diarios");
    totalInseridos += inseridos;
    totalConflitos += conflitos;
    totalLinhas += rows.length;

    process.stdout.write(`  · batch ${offset}-${offset + rows.length}: ${eventos.length} eventos, +${inseridos} novos\r`);

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`\n  ✓ ${totalLinhas} diários lidos, ${totalInseridos} eventos criados, ${totalConflitos} já existiam.\n`);
}

// ============================================================
// 3) Backfill de check_ins_diarios
// ============================================================

async function backfillCheckIns() {
  console.log("→ check_ins_diarios");

  let offset = 0;
  let totalLinhas = 0;
  let totalInseridos = 0;
  let totalConflitos = 0;

  const intensidadeDe = (escala) => {
    switch (escala) {
      case "muito_bem":
      case "bem":
        return "baixa";
      case "neutro":
        return "media";
      case "dificil":
      case "muito_dificil":
        return "alta";
      default:
        return null;
    }
  };

  while (true) {
    const { data: rows, error } = await supabase
      .from("check_ins_diarios")
      .select("id, family_account_id, data, escala_emocional_mae")
      .order("data", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;

    const eventos = rows.map((c) => ({
      family_account_id: c.family_account_id,
      membro_atipico_id: null,
      tipo: "registro_explicito",
      dominios: ["auto_cuidado_mae"],
      intensidade: intensidadeDe(c.escala_emocional_mae),
      ocorreu_em: mid(c.data),
      texto_livre: `Check-in diário (mãe): ${c.escala_emocional_mae ?? "sem escala"}`,
      metadados: {
        source: "check_ins_diarios",
        source_id: c.id,
        escala_emocional_mae: c.escala_emocional_mae,
        campo: "check_in_mae",
      },
      source_key: `check_ins_diarios:${c.id}:_`,
    }));

    const { inseridos, conflitos } = await inserirEventos(
      eventos,
      "check_ins_diarios",
    );
    totalInseridos += inseridos;
    totalConflitos += conflitos;
    totalLinhas += rows.length;

    process.stdout.write(`  · batch ${offset}-${offset + rows.length}: +${inseridos} (${conflitos} já existiam)\r`);

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`\n  ✓ ${totalLinhas} check-ins lidos, ${totalInseridos} eventos criados, ${totalConflitos} já existiam.\n`);
}

// ============================================================
// Main
// ============================================================

const inicio = Date.now();
try {
  await backfillMessages();
  await backfillDiarios();
  await backfillCheckIns();

  // Sanity check final — quantos eventos temos no total agora
  const { count } = await supabase
    .from("ayla_eventos_longitudinais")
    .select("id", { count: "exact", head: true });

  console.log(`=== Total atual em ayla_eventos_longitudinais: ${count ?? "?"} ===`);
  console.log(`Tempo total: ${((Date.now() - inicio) / 1000).toFixed(1)}s\n`);
} catch (err) {
  console.error("\n✗ Backfill abortado:", err.message);
  process.exit(1);
}
