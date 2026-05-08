import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Insight Engine — PRD §12.10.
 *
 * Detecta padrões nos últimos 7-14 dias e gera mensagem proativa.
 * Padrões que precisam NLP/IA (gatilho recorrente, conquista consistente,
 * mudança positiva) ficam como TODO — entram numa sessão de IA-pattern.
 *
 * Padrões implementados aqui (SQL puro):
 *   - exaustão da mãe (≥4 dos 7 últimos checkins em cansada/ansiosa)
 *   - queda emocional sustentada (≥3 consecutivos ≤ "dificil")
 *   - queda de energia sustentada do atípico (≥3 consecutivos ≤ "cansada")
 *
 * O cron chama detectAndPersist() — engine grava em ayla_insights
 * pendente, scheduler envia depois respeitando rules.ts.
 */

export type InsightCandidato = {
  padrao: string;
  detalhe: Record<string, unknown>;
  mensagem_proposta: string;
  prioridade: number; // 0-100, maior = mais urgente
  membro_atipico_id?: string | null;
};

const ESCALA_EMOCIONAL_RUIM: ReadonlyArray<string> = ["dificil", "muito_dificil"];
const ESCALA_ENERGIA_RUIM: ReadonlyArray<string> = ["cansada", "exausta"];
const EMOCAO_MAE_RUIM: ReadonlyArray<string> = ["cansada", "ansiosa_estressada", "triste"];

export async function detectAndPersist(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<{ detectados: number; persistidos: number; pulados: number }> {
  const candidatos = await detectarTodos(supabase, familyAccountId, agora);

  // Idempotência: não criar insight do mesmo padrão se há um pendente nos
  // últimos 7 dias.
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data: recentes } = await supabase
    .from("ayla_insights")
    .select("padrao")
    .eq("family_account_id", familyAccountId)
    .gte("created_at", seteDiasAtras.toISOString());

  const padroesRecentes = new Set((recentes ?? []).map((r) => r.padrao as string));

  let persistidos = 0;
  let pulados = 0;

  for (const c of candidatos) {
    if (padroesRecentes.has(c.padrao)) {
      pulados++;
      continue;
    }
    const { error } = await supabase.from("ayla_insights").insert({
      family_account_id: familyAccountId,
      membro_atipico_id: c.membro_atipico_id ?? null,
      padrao: c.padrao,
      detalhe: c.detalhe,
      mensagem_proposta: c.mensagem_proposta,
    });
    if (!error) persistidos++;
  }

  return { detectados: candidatos.length, persistidos, pulados };
}

async function detectarTodos(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date,
): Promise<InsightCandidato[]> {
  const candidatos: InsightCandidato[] = [];
  candidatos.push(...(await detectExaustaoMae(supabase, familyAccountId, agora)));
  candidatos.push(
    ...(await detectQuedaEmocionalSustentada(supabase, familyAccountId, agora)),
  );
  candidatos.push(
    ...(await detectQuedaEnergiaSustentada(supabase, familyAccountId, agora)),
  );
  return candidatos;
}

/**
 * Exaustão da mãe — emocao_mae em (cansada, ansiosa_estressada, triste)
 * em ≥4 dos últimos 7 ayla_daily_checkins.
 */
async function detectExaustaoMae(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date,
): Promise<InsightCandidato[]> {
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { data } = await supabase
    .from("ayla_daily_checkins")
    .select("date, emocao_mae")
    .eq("family_account_id", familyAccountId)
    .gte("date", seteDiasAtras.toISOString().slice(0, 10))
    .order("date", { ascending: false });

  const checkins = data ?? [];
  if (checkins.length < 4) return [];

  const ruins = checkins.filter((c) =>
    EMOCAO_MAE_RUIM.includes(c.emocao_mae as string),
  );
  if (ruins.length < 4) return [];

  return [
    {
      padrao: "exaustao_mae",
      detalhe: { dias_ruins: ruins.length, total: checkins.length },
      mensagem_proposta:
        "Notei que a semana tem sido pesada pra você. Sem cobrança — você ter respondido já é muito. Se quiser, posso lembrar você de uma micro-pausa hoje à noite.",
      prioridade: 80,
    },
  ];
}

/**
 * Queda emocional sustentada do membro — check_ins_diarios.escala_emocional_membro
 * em (dificil, muito_dificil) em ≥3 consecutivos.
 */
async function detectQuedaEmocionalSustentada(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date,
): Promise<InsightCandidato[]> {
  const dezDiasAtras = new Date(agora.getTime() - 10 * 24 * 60 * 60 * 1000);
  const { data: checkins } = await supabase
    .from("check_ins_diarios")
    .select("data, escala_emocional_membro, membro_atipico_id, membros_atipicos(nome)")
    .eq("family_account_id", familyAccountId)
    .gte("data", dezDiasAtras.toISOString().slice(0, 10))
    .order("data", { ascending: false });

  if (!checkins || checkins.length < 3) return [];

  // Por membro
  const porMembro = new Map<string, typeof checkins>();
  for (const c of checkins) {
    if (!c.membro_atipico_id) continue;
    const arr = porMembro.get(c.membro_atipico_id) ?? [];
    arr.push(c);
    porMembro.set(c.membro_atipico_id, arr);
  }

  const out: InsightCandidato[] = [];
  for (const [membroId, lista] of porMembro) {
    let consecutivos = 0;
    for (const c of lista) {
      if (ESCALA_EMOCIONAL_RUIM.includes(c.escala_emocional_membro as string)) {
        consecutivos++;
        if (consecutivos >= 3) break;
      } else {
        break;
      }
    }
    if (consecutivos >= 3) {
      const nome = nomeFromRel(lista[0].membros_atipicos);
      out.push({
        padrao: "queda_emocional_membro_sustentada",
        membro_atipico_id: membroId,
        detalhe: { consecutivos, membro: nome },
        mensagem_proposta: `Os últimos dias do/da ${nome} estão pesados. Quer ver junto comigo o que pode estar pegando?`,
        prioridade: 70,
      });
    }
  }
  return out;
}

/**
 * Queda de energia sustentada do membro — check_ins_diarios.escala_energia_*
 * em (cansada, exausta) em ≥3 consecutivos. (PRD §12.10)
 *
 * Nota: o schema atual só tem escala_emocional_*. A escala de energia
 * é dos check_ins_semanais (PRD §7.15.4). Por ora detectamos a partir do
 * semanal — última semana com energia ≤ cansada conta.
 */
async function detectQuedaEnergiaSustentada(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date,
): Promise<InsightCandidato[]> {
  const tresSemanasAtras = new Date(agora.getTime() - 21 * 24 * 60 * 60 * 1000);
  const { data: semanais } = await supabase
    .from("check_ins_semanais")
    .select("semana_inicio, energia_membro, membro_atipico_id, membros_atipicos(nome)")
    .eq("family_account_id", familyAccountId)
    .gte("semana_inicio", tresSemanasAtras.toISOString().slice(0, 10))
    .order("semana_inicio", { ascending: false });

  if (!semanais || semanais.length < 2) return [];

  const porMembro = new Map<string, typeof semanais>();
  for (const c of semanais) {
    if (!c.membro_atipico_id) continue;
    const arr = porMembro.get(c.membro_atipico_id) ?? [];
    arr.push(c);
    porMembro.set(c.membro_atipico_id, arr);
  }

  const out: InsightCandidato[] = [];
  for (const [membroId, lista] of porMembro) {
    const ruins = lista.filter((c) =>
      ESCALA_ENERGIA_RUIM.includes(c.energia_membro as string),
    );
    if (ruins.length >= 2) {
      const nome = nomeFromRel(lista[0].membros_atipicos);
      out.push({
        padrao: "queda_energia_membro_sustentada",
        membro_atipico_id: membroId,
        detalhe: { semanas_ruins: ruins.length, membro: nome },
        mensagem_proposta: `${nome} tá vindo de duas semanas cansadas. Talvez valha rever uma rotina — quer pensar junto?`,
        prioridade: 60,
      });
    }
  }
  return out;
}

function nomeFromRel(rel: unknown): string {
  if (!rel) return "ele/ela";
  if (Array.isArray(rel)) {
    const first = rel[0] as { nome?: string } | undefined;
    return first?.nome ?? "ele/ela";
  }
  return (rel as { nome?: string }).nome ?? "ele/ela";
}
