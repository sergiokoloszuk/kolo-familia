/**
 * Roda `avaliarPadroesReal()` pra todos os membros ativos.
 *
 * Sem LLM. Heurísticas determinísticas. Popula `ayla_padroes` em estado
 * 'hipotese' (ou promove pra 'observado' se ≥6 evidências). NÃO afeta
 * comportamento ativo da Ayla v1 — hipóteses ficam visíveis SÓ no painel
 * admin pra revisão da Karina.
 *
 * Uso:
 *   node apps/web/scripts/ayla-avaliar-padroes.mjs [--membro=<uuid>] [--dry-run]
 *
 * Sem `--membro`: roda pra todos os membros ativos.
 * Com `--membro`: roda só pro membro indicado.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const membroArg = process.argv.find((a) => a.startsWith("--membro="));
const membroAlvo = membroArg ? membroArg.split("=")[1] : null;

console.log(`\n=== Avaliar padrões ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// O motor TypeScript é executado via tsx em outra invocação. Aqui replicamos
// a lógica essencial em JS pra rodar standalone (evita dep de bundler).
// Mantém paridade com lib/ayla/manual/avaliar-padroes.ts — não divergir!

const LIMITES = {
  recorrencia: { min_evidencias: 3, saturacao: 8 },
  co_ocorrencia: { min_dias_co_ocorrencia: 3, saturacao: 10 },
};

const VERBOS_PROIBIDOS = [
  "é",
  "tem",
  "sofre de",
  "apresenta",
  "manifesta",
  "transtorno",
  "comorbidade",
  "patologia",
  "patológic",
  "sindrome",
  "síndrome",
  "diagnóstico",
  "diagnostic",
  "déficit",
  "deficit",
  "disfunção",
  "deficiencia",
  "deficiência",
  "anormal",
  "causa",
  "provoca",
  "resulta de",
  "decorre de",
  "deve-se a",
  "por causa",
  "supera",
  "vence",
];

const DOMINIO_LABEL = {
  sono: "sono",
  alimentacao: "alimentação",
  comunicacao: "comunicação",
  socializacao: "socialização",
  sensorial: "perfil sensorial",
  regulacao_emocional: "regulação",
  hiperfocos: "hiperfocos",
  rotina: "rotina",
  transicoes: "transições",
  autonomia: "autonomia",
  auto_cuidado_mae: "auto-cuidado da mãe",
  familia: "família",
  escola: "escola",
  saude: "saúde",
};

const TIPO_EVENTO_LABEL = {
  crise_relatada: "momentos difíceis",
  meltdown_relatado: "crises externalizadas",
  shutdown_relatado: "momentos de desligamento",
  conquista_relatada: "conquistas",
  melhora_relatada: "melhoras",
  regressao_observada: "perdas de capacidade",
  sensibilidade_evidenciada: "sensibilidades",
  hiperfoco_evidenciado: "interesses intensos",
  preferencia_revelada: "preferências",
  mudanca_observada: "mudanças",
  mudanca_fase: "transições estruturais",
  estrategia_testada: "estratégias aplicadas",
  conversa_turno: "conversas",
  check_in_resposta: "respostas de check-in",
  follow_up_resposta: "respostas de follow-up",
  registro_explicito: "registros",
};

const JANELA_LABEL = {
  "30d": "30 dias",
  "90d": "3 meses",
  "6m": "6 meses",
  todo_periodo: "todo o histórico",
};

function verificarTom(descricao) {
  const lower = descricao.toLowerCase();
  for (const proibido of VERBOS_PROIBIDOS) {
    const padrao = new RegExp(
      `(^|[\\s,;:.!?])${proibido}([\\s,;:.!?]|$)`,
      "i",
    );
    if (padrao.test(lower)) return false;
  }
  return true;
}

function janelaInicio(janela, agora = new Date()) {
  const ini = new Date(agora);
  if (janela === "30d") ini.setDate(ini.getDate() - 30);
  else if (janela === "90d") ini.setDate(ini.getDate() - 90);
  else if (janela === "6m") ini.setMonth(ini.getMonth() - 6);
  else if (janela === "todo_periodo") ini.setFullYear(2000, 0, 1);
  return ini;
}

function detectarRecorrencia(eventos, janela) {
  const grupos = new Map();
  for (const e of eventos) {
    if (!e.dominios || e.dominios.length === 0) continue;
    for (const dom of e.dominios) {
      const chave = `${e.tipo}__${dom}`;
      const lista = grupos.get(chave) ?? [];
      lista.push(e);
      grupos.set(chave, lista);
    }
  }

  const candidatos = [];
  for (const [chave, lista] of grupos.entries()) {
    if (lista.length < LIMITES.recorrencia.min_evidencias) continue;
    const [tipo, dominio] = chave.split("__");
    const desc = `${(TIPO_EVENTO_LABEL[tipo] ?? tipo).charAt(0).toUpperCase()}${(TIPO_EVENTO_LABEL[tipo] ?? tipo).slice(1)} em ${DOMINIO_LABEL[dominio] ?? dominio} tem aparecido com mais frequência nas últimas ${JANELA_LABEL[janela] ?? janela}.`;
    if (!verificarTom(desc)) continue;

    const sortedByDate = lista
      .slice()
      .sort((a, b) => a.ocorreu_em.localeCompare(b.ocorreu_em));

    candidatos.push({
      padrao_key: `recorrencia:${tipo}:${dominio}:${janela}`,
      descricao: desc,
      confianca: Math.min(1, lista.length / LIMITES.recorrencia.saturacao),
      sinais_correlacionados: [
        `${lista.length} ocorrências em ${JANELA_LABEL[janela] ?? janela}`,
        `mesmo tipo: ${TIPO_EVENTO_LABEL[tipo] ?? tipo}`,
        `mesmo domínio: ${DOMINIO_LABEL[dominio] ?? dominio}`,
      ],
      motivo_hipotese: "recorrencia_temporal",
      janela_analisada: janela,
      evidencias_evento_ids: lista.map((e) => e.id),
      primeira_evidencia: sortedByDate[0].ocorreu_em,
      ultima_evidencia: sortedByDate[sortedByDate.length - 1].ocorreu_em,
    });
  }
  return candidatos;
}

function detectarCoOcorrencia(eventos, janela) {
  const eventosPorDia = new Map();
  const eventosPorChave = new Map();
  for (const e of eventos) {
    if (!e.dominios || e.dominios.length === 0) continue;
    const dia = e.ocorreu_em.slice(0, 10);
    const set = eventosPorDia.get(dia) ?? new Set();
    for (const dom of e.dominios) set.add(dom);
    eventosPorDia.set(dia, set);
    for (const dom of e.dominios) {
      const chave = `${dia}__${dom}`;
      const lista = eventosPorChave.get(chave) ?? [];
      lista.push(e);
      eventosPorChave.set(chave, lista);
    }
  }

  const pares = new Map();
  for (const [dia, doms] of eventosPorDia.entries()) {
    const arr = Array.from(doms).sort();
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const chave = `${arr[i]}__${arr[j]}`;
        const entry = pares.get(chave) ?? { count: 0, eventoIds: new Set() };
        entry.count++;
        for (const ev of eventosPorChave.get(`${dia}__${arr[i]}`) ?? []) {
          entry.eventoIds.add(ev.id);
        }
        for (const ev of eventosPorChave.get(`${dia}__${arr[j]}`) ?? []) {
          entry.eventoIds.add(ev.id);
        }
        pares.set(chave, entry);
      }
    }
  }

  const candidatos = [];
  for (const [chave, { count, eventoIds }] of pares.entries()) {
    if (count < LIMITES.co_ocorrencia.min_dias_co_ocorrencia) continue;
    const [domA, domB] = chave.split("__");
    const desc = `Eventos em ${DOMINIO_LABEL[domA] ?? domA} aparecem junto com eventos em ${DOMINIO_LABEL[domB] ?? domB} em parte significativa das ocorrências.`;
    if (!verificarTom(desc)) continue;
    const ids = Array.from(eventoIds);
    const eventosOrdenados = eventos
      .filter((e) => eventoIds.has(e.id))
      .sort((a, b) => a.ocorreu_em.localeCompare(b.ocorreu_em));
    candidatos.push({
      padrao_key: `co_ocorrencia:${domA}:${domB}:${janela}`,
      descricao: desc,
      confianca: Math.min(1, count / LIMITES.co_ocorrencia.saturacao),
      sinais_correlacionados: [
        `${count} dias com ambos domínios ativos`,
        `domínio A: ${DOMINIO_LABEL[domA] ?? domA}`,
        `domínio B: ${DOMINIO_LABEL[domB] ?? domB}`,
      ],
      motivo_hipotese: "co_ocorrencia_dominios",
      janela_analisada: janela,
      evidencias_evento_ids: ids,
      primeira_evidencia: eventosOrdenados[0]?.ocorreu_em ?? "",
      ultima_evidencia:
        eventosOrdenados[eventosOrdenados.length - 1]?.ocorreu_em ?? "",
    });
  }
  return candidatos;
}

async function avaliarMembro(membroId, agora = new Date()) {
  const { data: membro } = await supabase
    .from("membros_atipicos")
    .select("family_account_id, nome")
    .eq("id", membroId)
    .maybeSingle();
  if (!membro) return null;

  const resumo = {
    membro_id: membroId,
    nome: membro.nome,
    total_eventos: 0,
    candidatos: 0,
    criados: 0,
    atualizados: 0,
  };

  for (const janela of ["30d", "90d"]) {
    const ini = janelaInicio(janela, agora);
    const { data: eventos } = await supabase
      .from("ayla_eventos_longitudinais")
      .select("id, tipo, dominios, intensidade, ocorreu_em")
      .eq("membro_atipico_id", membroId)
      .gte("ocorreu_em", ini.toISOString())
      .order("ocorreu_em", { ascending: true });

    if (!eventos || eventos.length < LIMITES.recorrencia.min_evidencias)
      continue;
    resumo.total_eventos += eventos.length;

    const candidatos = [
      ...detectarRecorrencia(eventos, janela),
      ...detectarCoOcorrencia(eventos, janela),
    ];
    resumo.candidatos += candidatos.length;

    if (DRY_RUN) continue;

    for (const c of candidatos) {
      const { data: existente } = await supabase
        .from("ayla_padroes")
        .select("id, evidencias_count, estado")
        .eq("membro_atipico_id", membroId)
        .eq("padrao_key", c.padrao_key)
        .maybeSingle();

      if (existente) {
        await supabase
          .from("ayla_padroes")
          .update({
            descricao: c.descricao,
            evidencias_count: c.evidencias_evento_ids.length,
            confianca: c.confianca,
            ultima_evidencia: c.ultima_evidencia,
            evidencias_evento_ids: c.evidencias_evento_ids,
            motivo_hipotese: c.motivo_hipotese,
            sinais_correlacionados: c.sinais_correlacionados,
            janela_analisada: c.janela_analisada,
            estado:
              existente.estado === "hipotese" &&
              c.evidencias_evento_ids.length >= 6
                ? "observado"
                : existente.estado,
          })
          .eq("id", existente.id);
        resumo.atualizados++;
      } else {
        await supabase.from("ayla_padroes").insert({
          family_account_id: membro.family_account_id,
          membro_atipico_id: membroId,
          padrao_key: c.padrao_key,
          descricao: c.descricao,
          evidencias_count: c.evidencias_evento_ids.length,
          confianca: c.confianca,
          estado: "hipotese",
          primeira_evidencia: c.primeira_evidencia,
          ultima_evidencia: c.ultima_evidencia,
          evidencias_evento_ids: c.evidencias_evento_ids,
          motivo_hipotese: c.motivo_hipotese,
          sinais_correlacionados: c.sinais_correlacionados,
          janela_analisada: c.janela_analisada,
        });
        resumo.criados++;
      }
    }
  }
  return resumo;
}

// Main
let membros;
if (membroAlvo) {
  membros = [{ id: membroAlvo }];
} else {
  const { data } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("ativo", true);
  membros = data ?? [];
}

console.log(`Membros a avaliar: ${membros.length}\n`);
const inicio = Date.now();
const totais = { eventos: 0, candidatos: 0, criados: 0, atualizados: 0 };

for (const m of membros) {
  const r = await avaliarMembro(m.id);
  if (!r) continue;
  console.log(
    `  ${r.nome ?? m.id}: ${r.total_eventos} eventos → ${r.candidatos} candidatos (${r.criados} novos, ${r.atualizados} atualizados)`,
  );
  totais.eventos += r.total_eventos;
  totais.candidatos += r.candidatos;
  totais.criados += r.criados;
  totais.atualizados += r.atualizados;
}

console.log(`\n=== Totais ===`);
console.log(`  eventos analisados:       ${totais.eventos}`);
console.log(`  candidatos gerados:       ${totais.candidatos}`);
console.log(`  hipóteses criadas:        ${totais.criados}`);
console.log(`  hipóteses atualizadas:    ${totais.atualizados}`);
console.log(`  tempo total:              ${((Date.now() - inicio) / 1000).toFixed(1)}s\n`);
