import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * KPIs próprios da Ayla — PRD §12.11.
 *
 * Métricas computadas no momento da consulta. Para volume alto, mover
 * pra materialized view + refresh periódico (out of scope desta versão).
 *
 * Janela default: últimos 30 dias.
 */

export type AylaKPIs = {
  janelaDias: number;
  taxaRespostaDiaria: number; // 0-1
  tempoMedianoRespostaMinutos: number | null;
  streakMedio: number; // dias
  familiasAtivasSemanais: number;
  conversaoChecksinDiario: number; // 0-1
  conversaoSugestaoAprovada: number; // 0-1
  taxaPausasOuDesativacoes: number; // 0-1
  totalProativasEnviadas: number;
  totalReativasEnviadas: number;
};

export async function computeKPIs(
  supabase: SupabaseClient,
  janelaDias = 30,
): Promise<AylaKPIs> {
  const agora = new Date();
  const inicio = new Date(agora.getTime() - janelaDias * 24 * 60 * 60 * 1000);
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioIso = inicio.toISOString();
  const seteDiasIso = seteDiasAtras.toISOString();

  const [
    proativasEnviadas,
    reativasEnviadas,
    inboundsTotais,
    checkinsCriados,
    checkinsRespondidos,
    sugestoesCriadas,
    sugestoesAprovadas,
    familiasAtivas,
    pausadas,
    desativadas,
    totalFamilias,
  ] = await Promise.all([
    countMessages(supabase, "proativa", "outbound", inicioIso),
    countMessages(supabase, "reativa", "outbound", inicioIso),
    countInbound(supabase, inicioIso),
    countCheckinsCreated(supabase, inicioIso),
    countCheckinsRespondidos(supabase, inicioIso),
    countSugestoes(supabase, "ayla", inicioIso),
    countSugestoesAprovadas(supabase, "ayla", inicioIso),
    countFamiliasAtivasSemanais(supabase, seteDiasIso),
    countAylaStatus(supabase, "pausada"),
    countAylaStatus(supabase, "desativada"),
    countTotalFamilias(supabase),
  ]);

  const taxaRespostaDiaria = proativasEnviadas > 0 ? inboundsTotais / proativasEnviadas : 0;
  const conversaoChecksinDiario =
    checkinsRespondidos > 0 ? checkinsCriados / checkinsRespondidos : 0;
  const conversaoSugestaoAprovada =
    sugestoesCriadas > 0 ? sugestoesAprovadas / sugestoesCriadas : 0;
  const taxaPausasOuDesativacoes =
    totalFamilias > 0 ? (pausadas + desativadas) / totalFamilias : 0;

  const tempoMedianoRespostaMinutos = await medianResponseTime(supabase, inicioIso);
  const streakMedio = await averageStreak(supabase, inicioIso);

  return {
    janelaDias,
    taxaRespostaDiaria,
    tempoMedianoRespostaMinutos,
    streakMedio,
    familiasAtivasSemanais: familiasAtivas,
    conversaoChecksinDiario,
    conversaoSugestaoAprovada,
    taxaPausasOuDesativacoes,
    totalProativasEnviadas: proativasEnviadas,
    totalReativasEnviadas: reativasEnviadas,
  };
}

// ---------- helpers ----------

async function countMessages(
  supabase: SupabaseClient,
  category: "proativa" | "reativa",
  direcao: "outbound" | "inbound",
  desde: string,
): Promise<number> {
  const { count } = await supabase
    .from("ayla_messages")
    .select("id", { count: "exact", head: true })
    .eq("category", category)
    .eq("direcao", direcao)
    .gte("created_at", desde);
  return count ?? 0;
}

async function countInbound(supabase: SupabaseClient, desde: string): Promise<number> {
  const { count } = await supabase
    .from("ayla_messages")
    .select("id", { count: "exact", head: true })
    .eq("direcao", "inbound")
    .gte("created_at", desde);
  return count ?? 0;
}

async function countCheckinsCreated(
  supabase: SupabaseClient,
  desde: string,
): Promise<number> {
  const { count } = await supabase
    .from("ayla_daily_checkins")
    .select("id", { count: "exact", head: true })
    .gte("created_at", desde);
  return count ?? 0;
}

async function countCheckinsRespondidos(
  supabase: SupabaseClient,
  desde: string,
): Promise<number> {
  const { count } = await supabase
    .from("ayla_daily_checkins")
    .select("id", { count: "exact", head: true })
    .eq("respondeu", true)
    .gte("created_at", desde);
  return count ?? 0;
}

async function countSugestoes(
  supabase: SupabaseClient,
  origem: string,
  desde: string,
): Promise<number> {
  const { count } = await supabase
    .from("sugestao_perfil_vivos")
    .select("id", { count: "exact", head: true })
    .eq("origem", origem)
    .gte("created_at", desde);
  return count ?? 0;
}

async function countSugestoesAprovadas(
  supabase: SupabaseClient,
  origem: string,
  desde: string,
): Promise<number> {
  const { count } = await supabase
    .from("sugestao_perfil_vivos")
    .select("id", { count: "exact", head: true })
    .eq("origem", origem)
    .eq("status", "aprovada")
    .gte("created_at", desde);
  return count ?? 0;
}

async function countFamiliasAtivasSemanais(
  supabase: SupabaseClient,
  seteDiasIso: string,
): Promise<number> {
  const { data } = await supabase
    .from("ayla_messages")
    .select("family_account_id")
    .eq("direcao", "inbound")
    .gte("created_at", seteDiasIso);
  const set = new Set((data ?? []).map((d) => d.family_account_id as string));
  return set.size;
}

async function countAylaStatus(
  supabase: SupabaseClient,
  status: "pausada" | "desativada",
): Promise<number> {
  if (status === "desativada") {
    const { count } = await supabase
      .from("ayla_preferences")
      .select("family_account_id", { count: "exact", head: true })
      .eq("desativada", true);
    return count ?? 0;
  } else {
    const hoje = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("ayla_preferences")
      .select("family_account_id", { count: "exact", head: true })
      .gte("pausada_ate", hoje);
    return count ?? 0;
  }
}

async function countTotalFamilias(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("family_accounts")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Tempo mediano de resposta: diferença entre proativa enviada e
 * resposta da mãe na mesma janela. Cálculo simples sem percentile_cont
 * (que daria true median via SQL); em JS calculamos a mediana sobre
 * pares (proativa, próxima inbound da mesma família).
 */
async function medianResponseTime(
  supabase: SupabaseClient,
  desde: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("ayla_messages")
    .select("family_account_id, direcao, created_at")
    .gte("created_at", desde)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return null;

  // Agrupa por família, percorre, mede tempo até próxima inbound após cada outbound
  const porFamilia = new Map<string, typeof data>();
  for (const m of data) {
    const arr = porFamilia.get(m.family_account_id as string) ?? [];
    arr.push(m);
    porFamilia.set(m.family_account_id as string, arr);
  }

  const minutos: number[] = [];
  for (const lista of porFamilia.values()) {
    let lastOutbound: Date | null = null;
    for (const m of lista) {
      if (m.direcao === "outbound") {
        lastOutbound = new Date(m.created_at as string);
      } else if (m.direcao === "inbound" && lastOutbound) {
        const dt = new Date(m.created_at as string);
        const diff = (dt.getTime() - lastOutbound.getTime()) / 60000;
        if (diff > 0 && diff < 60 * 24 * 7) minutos.push(diff);
        lastOutbound = null; // só o primeiro inbound após cada outbound conta
      }
    }
  }

  if (minutos.length === 0) return null;
  minutos.sort((a, b) => a - b);
  const mid = Math.floor(minutos.length / 2);
  return minutos.length % 2 === 0
    ? Math.round((minutos[mid - 1] + minutos[mid]) / 2)
    : Math.round(minutos[mid]);
}

/**
 * Streak médio: dias consecutivos respondendo, em média por família.
 * Aproximação simples: para cada família ativa nos últimos 30d, conta
 * o maior streak de respostas em ayla_daily_checkins (respondeu=true).
 */
async function averageStreak(supabase: SupabaseClient, desde: string): Promise<number> {
  const { data } = await supabase
    .from("ayla_daily_checkins")
    .select("family_account_id, date, respondeu")
    .eq("respondeu", true)
    .gte("created_at", desde)
    .order("date", { ascending: true });

  if (!data || data.length === 0) return 0;

  const porFamilia = new Map<string, string[]>();
  for (const d of data) {
    const arr = porFamilia.get(d.family_account_id as string) ?? [];
    arr.push(d.date as string);
    porFamilia.set(d.family_account_id as string, arr);
  }

  const streaks: number[] = [];
  for (const datas of porFamilia.values()) {
    const dedupe = Array.from(new Set(datas)).sort();
    let melhor = 1;
    let atual = 1;
    for (let i = 1; i < dedupe.length; i++) {
      const prev = new Date(dedupe[i - 1]);
      const curr = new Date(dedupe[i]);
      const diff = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
      if (diff === 1) {
        atual++;
        if (atual > melhor) melhor = atual;
      } else {
        atual = 1;
      }
    }
    streaks.push(melhor);
  }

  if (streaks.length === 0) return 0;
  return Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length);
}
