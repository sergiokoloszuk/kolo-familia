import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";
import { horaLocalHHMM } from "@/lib/idade";
import {
  sendRotinaDiaria,
  sendEngajamento,
  sendTrial,
  sendEmocionalStreak,
  sendProximoInsight,
  sendRepertorioSugestao,
  sendPlanoSeguimento,
  sendCampanha,
  type CampanhaCategoria,
} from "@/lib/ayla/orchestrator";
import { detectAndPersist } from "@/lib/ayla/insightEngine";
import { runRegrasParaFamilia } from "@/lib/regras/engine";

/**
 * Cron da Ayla — chamado por scheduler externo (n8n, Vercel Cron, etc.).
 *
 * Tipos suportados via query param `?tipo=`:
 *   - rotina       — manda pergunta diária (PRD §12.9.1)
 *   - inatividade  — detecta 2 e 5 dias sem responder (PRD §12.9.2)
 *   - comercial    — trial D-3 e D-0 (PRD §12.9.3)
 *   - emocional    — streak 7 dias (PRD §12.9.3)
 *   - insights     — detecta padrões + envia próximo pendente (PRD §12.9.4)
 *
 * Protegido por CRON_SECRET no header `Authorization: Bearer <secret>`.
 * Sem o env, qualquer um pode disparar — só no dev.
 *
 * O Vercel Cron chama via GET (e já injeta o header Authorization com o
 * CRON_SECRET); n8n/manual chamam via POST. Os dois caem no mesmo handler.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "rotina";

  const supabase = createServiceRoleClient();

  try {
    if (tipo === "rotina") return await runRotina(supabase);
    if (tipo === "inatividade") return await runInatividade(supabase);
    if (tipo === "comercial") return await runComercial(supabase);
    if (tipo === "emocional") return await runEmocional(supabase);
    if (tipo === "insights") return await runInsights(supabase);
    if (tipo === "repertorio") return await runRepertorio(supabase);
    if (tipo === "seguimento") return await runSeguimento(supabase);
    if (tipo === "campanhas") return await runCampanhas(supabase);
    if (tipo === "regras") return await runRegras(supabase);
    if (tipo === "cleanup") return await runCleanup(supabase);

    return NextResponse.json({ error: `tipo inválido: ${tipo}` }, { status: 400 });
  } catch (err) {
    await logServerError("ayla_cron", err, { payload: { tipo } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro" },
      { status: 500 },
    );
  }
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Roda rotina diária para todas as famílias ativas onde:
 *   - subscription_access.status in (trialing, active, past_due)
 *   - ayla_preferences.consentimento_em existe + não desativada + não pausada
 *   - hora atual (fuso BR) cai dentro de horario_preferido_inicio..fim
 *
 * Ideal: cron rodar a cada 30min. Cada chamada despacha as famílias
 * cujo horário casa naquele momento.
 */
async function runRotina(supabase: AdminClient) {
  const agora = new Date();
  // Janela comparada no fuso de Brasília (horário preferido é local), não UTC.
  const horaAtualLocal = horaLocalHHMM(agora); // "HH:MM"

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select(
      "family_account_id, horario_preferido_inicio, horario_preferido_fim, desativada, pausada_ate, consentimento_em",
    )
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const elegiveis: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const inicio = (p.horario_preferido_inicio as string)?.slice(0, 5);
    const fim = (p.horario_preferido_fim as string)?.slice(0, 5);
    if (inicio && fim && horaAtualLocal >= inicio && horaAtualLocal <= fim) {
      elegiveis.push(p.family_account_id);
    }
  }

  // Filtra por status de assinatura
  if (elegiveis.length > 0) {
    const { data: ativas } = await supabase
      .from("subscription_accesses")
      .select("family_account_id, status")
      .in("family_account_id", elegiveis)
      .in("status", ["trialing", "active", "past_due"]);
    const ativasSet = new Set((ativas ?? []).map((a) => a.family_account_id));
    elegiveis.splice(0, elegiveis.length, ...elegiveis.filter((id) => ativasSet.has(id)));
  }

  const resultados: Array<{
    familyId: string;
    enviada: boolean;
    motivo?: string;
  }> = [];

  for (const familyId of elegiveis) {
    try {
      const r = await sendRotinaDiaria(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Detecta famílias que pararam de responder e envia engajamento.
 * Roda 1x/dia (geralmente 09:00 timezone família — simplificado pra UTC).
 */
async function runInatividade(supabase: AdminClient) {
  const agora = new Date();
  const dois = new Date(agora.getTime() - 2 * 24 * 60 * 60 * 1000);
  const cinco = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);
  const dez = new Date(agora.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Famílias com consentimento + não desativadas + não pausadas
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string; dias: number }> = [];

  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;

    const familyId = p.family_account_id as string;

    // Última resposta da mãe
    const { data: ultima } = await supabase
      .from("ayla_messages")
      .select("created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .order("created_at", { ascending: false })
      .limit(1);

    const ref = ultima?.[0]?.created_at;
    if (!ref) continue;
    const refDate = new Date(ref);

    let diasInativos = 0;
    if (refDate <= dez) {
      // Silêncio total — não envia (regra §12.5)
      continue;
    } else if (refDate <= cinco) {
      diasInativos = 5;
    } else if (refDate <= dois) {
      diasInativos = 2;
    } else {
      continue;
    }

    try {
      const r = await sendEngajamento(supabase, familyId, diasInativos, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
        dias: diasInativos,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
        dias: diasInativos,
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Comercial: trial D-3 e D-0. Roda 1×/dia.
 */
async function runComercial(supabase: AdminClient) {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const em3 = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);
  const em3Fim = new Date(em3.getTime() + 24 * 60 * 60 * 1000);
  const hojeFim = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: d3 }, { data: d0 }] = await Promise.all([
    supabase
      .from("subscription_accesses")
      .select("family_account_id, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", em3.toISOString())
      .lt("trial_ends_at", em3Fim.toISOString()),
    supabase
      .from("subscription_accesses")
      .select("family_account_id, trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", hoje.toISOString())
      .lt("trial_ends_at", hojeFim.toISOString()),
  ]);

  const resultados: Array<{ familyId: string; tipo: string; enviada: boolean; motivo?: string }> = [];

  for (const r of d3 ?? []) {
    try {
      const res = await sendTrial(supabase, r.family_account_id as string, 3, agora);
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d3",
        enviada: res.enviada,
        motivo: res.enviada ? undefined : res.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d3",
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  for (const r of d0 ?? []) {
    try {
      const res = await sendTrial(supabase, r.family_account_id as string, 0, agora);
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d0",
        enviada: res.enviada,
        motivo: res.enviada ? undefined : res.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId: r.family_account_id as string,
        tipo: "trial_d0",
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Emocional: detecta famílias com 7 dias seguidos de respostas e celebra.
 * Idempotência: só envia 1× a cada 30 dias por família.
 */
async function runEmocional(supabase: AdminClient) {
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: respostas } = await supabase
    .from("ayla_daily_checkins")
    .select("family_account_id, date")
    .eq("respondeu", true)
    .gte("date", seteDiasAtras.toISOString().slice(0, 10));

  const porFamilia = new Map<string, Set<string>>();
  for (const r of respostas ?? []) {
    const set = porFamilia.get(r.family_account_id as string) ?? new Set<string>();
    set.add(r.date as string);
    porFamilia.set(r.family_account_id as string, set);
  }
  const candidatas = Array.from(porFamilia.entries())
    .filter(([, datas]) => datas.size >= 7)
    .map(([id]) => id);

  const { data: jaCelebradas } = candidatas.length
    ? await supabase
        .from("ayla_messages")
        .select("family_account_id")
        .in("family_account_id", candidatas)
        .eq("tipo", "emocional_streak")
        .gte("created_at", trintaDiasAtras.toISOString())
    : { data: [] };

  const jaSet = new Set((jaCelebradas ?? []).map((m) => m.family_account_id as string));
  const elegiveis = candidatas.filter((id) => !jaSet.has(id));

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of elegiveis) {
    try {
      const r = await sendEmocionalStreak(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Insights: detecta padrões em todas as famílias ativas e envia o
 * próximo pendente (1 por família, máx). Roda 1×/semana (PRD §12.9.4).
 */
async function runInsights(supabase: AdminClient) {
  const agora = new Date();
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  const resultados: Array<{
    familyId: string;
    detectados: number;
    enviada?: boolean;
    motivo?: string;
  }> = [];

  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    const familyId = p.family_account_id as string;

    try {
      const det = await detectAndPersist(supabase, familyId, agora);
      const env = await sendProximoInsight(supabase, familyId, agora);
      resultados.push({
        familyId,
        detectados: det.persistidos,
        enviada: env.enviada,
        motivo: env.enviada ? undefined : env.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        detectados: 0,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Repertório: 1×/semana, sugere uma experiência nova adjacente aos
 * interesses da criança (Fatia 3.3b). Elegíveis: consentimento + não
 * desativada + não pausada + assinatura ativa. A cadência semanal e o
 * "não repetir o recusado" ficam dentro de sendRepertorioSugestao.
 */
async function runRepertorio(supabase: AdminClient) {
  const agora = new Date();
  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  let ids: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    ids.push(p.family_account_id as string);
  }

  if (ids.length > 0) {
    const { data: ativas } = await supabase
      .from("subscription_accesses")
      .select("family_account_id, status")
      .in("family_account_id", ids)
      .in("status", ["trialing", "active", "past_due"]);
    const ativasSet = new Set((ativas ?? []).map((a) => a.family_account_id as string));
    ids = ids.filter((id) => ativasSet.has(id));
  }

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of ids) {
    try {
      const r = await sendRepertorioSugestao(supabase, familyId, agora);
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Follow-up de plano (Fase 4): alguns dias depois de um plano sem resultado,
 * a Ayla pergunta como foi (com link pro plano). Roda 1×/dia. Pega o plano
 * mais antigo de cada família na janela de 3–14 dias, ainda sem resultado e
 * sem follow-up enviado. As regras de proativa (janela/cap/consentimento) e
 * a idempotência por plano são garantidas dentro de sendPlanoSeguimento.
 */
async function runSeguimento(supabase: AdminClient) {
  const agora = new Date();
  const dia = 24 * 60 * 60 * 1000;
  const tresDiasAtras = new Date(agora.getTime() - 3 * dia);
  const quatorzeDiasAtras = new Date(agora.getTime() - 14 * dia);

  const { data: candidatas } = await supabase
    .from("ayla_preferences")
    .select("family_account_id, pausada_ate")
    .not("consentimento_em", "is", null)
    .eq("desativada", false);

  let ids: string[] = [];
  for (const p of candidatas ?? []) {
    if (p.pausada_ate && new Date(p.pausada_ate) > agora) continue;
    ids.push(p.family_account_id as string);
  }

  if (ids.length > 0) {
    const { data: ativas } = await supabase
      .from("subscription_accesses")
      .select("family_account_id, status")
      .in("family_account_id", ids)
      .in("status", ["trialing", "active", "past_due"]);
    const ativasSet = new Set((ativas ?? []).map((a) => a.family_account_id as string));
    ids = ids.filter((id) => ativasSet.has(id));
  }

  const resultados: Array<{ familyId: string; enviada: boolean; motivo?: string }> = [];
  for (const familyId of ids) {
    try {
      const { data: planos } = await supabase
        .from("planos")
        .select("id, tema, membro_atipico_id")
        .eq("family_account_id", familyId)
        .is("resultado", null)
        .is("seguimento_enviado_em", null)
        .lte("created_at", tresDiasAtras.toISOString())
        .gte("created_at", quatorzeDiasAtras.toISOString())
        .order("created_at", { ascending: true })
        .limit(1);
      const plano = planos?.[0];
      if (!plano) continue;

      const r = await sendPlanoSeguimento(
        supabase,
        familyId,
        {
          id: plano.id as string,
          tema: (plano.tema as string | null) ?? null,
          membro_atipico_id: (plano.membro_atipico_id as string | null) ?? null,
        },
        agora,
      );
      resultados.push({
        familyId,
        enviada: r.enviada,
        motivo: r.enviada ? undefined : r.motivo,
      });
    } catch (e) {
      resultados.push({
        familyId,
        enviada: false,
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    enviadas: resultados.filter((r) => r.enviada).length,
    detalhes: resultados,
  });
}

/**
 * Cleanup: purga linhas antigas das tabelas operacionais. Roda 1×/dia.
 *
 *   - eventos_app: info/debug com >30 dias; warn/error/fatal com >180d
 *   - links_vivos: revogados ou expirados há >90 dias
 *   - beta_invites: expirados ou esgotados há >180 dias
 *   - campanhas_destinatarios: status final em campanhas enviadas há >365d
 *
 * Bounded por DEL_LIMIT por tabela pra não travar o DB.
 */
async function runCleanup(supabase: AdminClient) {
  const agora = new Date();
  const dia = 24 * 60 * 60 * 1000;
  const limites = {
    eventos_info: new Date(agora.getTime() - 30 * dia).toISOString(),
    eventos_grave: new Date(agora.getTime() - 180 * dia).toISOString(),
    links_vivos: new Date(agora.getTime() - 90 * dia).toISOString(),
    beta_invites: new Date(agora.getTime() - 180 * dia).toISOString(),
    campanhas_old: new Date(agora.getTime() - 365 * dia).toISOString(),
  };

  const resultados: Record<string, number | string> = {};

  // eventos_app info/debug
  {
    const { count, error } = await supabase
      .from("eventos_app")
      .delete({ count: "exact" })
      .in("severity", ["debug", "info"])
      .lt("created_at", limites.eventos_info);
    resultados.eventos_info = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // eventos_app warn/error/fatal
  {
    const { count, error } = await supabase
      .from("eventos_app")
      .delete({ count: "exact" })
      .in("severity", ["warn", "error", "fatal"])
      .lt("created_at", limites.eventos_grave);
    resultados.eventos_grave = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // links_vivos revogados ou expirados
  {
    const { count, error } = await supabase
      .from("links_vivos")
      .delete({ count: "exact" })
      .or(
        `revogado.eq.true,expira_em.lt.${limites.links_vivos}`,
      );
    resultados.links_vivos = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // beta_invites expirados/revogados antigos
  {
    const { count, error } = await supabase
      .from("beta_invites")
      .delete({ count: "exact" })
      .or(`revogado.eq.true,expira_em.lt.${limites.beta_invites}`);
    resultados.beta_invites = error ? `erro: ${error.message}` : (count ?? 0);
  }
  // campanhas_destinatarios de campanhas enviadas há muito tempo
  {
    const { data: campanhasAntigas } = await supabase
      .from("campanhas")
      .select("id")
      .eq("status", "enviada")
      .lt("updated_at", limites.campanhas_old);
    const ids = (campanhasAntigas ?? []).map((c) => c.id as string);
    if (ids.length > 0) {
      const { count, error } = await supabase
        .from("campanhas_destinatarios")
        .delete({ count: "exact" })
        .in("campanha_id", ids);
      resultados.campanhas_destinatarios = error
        ? `erro: ${error.message}`
        : (count ?? 0);
    } else {
      resultados.campanhas_destinatarios = 0;
    }
  }

  return NextResponse.json({ ok: true, agora: agora.toISOString(), purgado: resultados });
}

/**
 * Regras: avalia o engine para todas as famílias com assinatura ativa.
 * Roda 1×/dia. Cada família é isolada (catch local) — falha em uma não
 * derruba as outras.
 */
async function runRegras(supabase: AdminClient) {
  const { data: ativas } = await supabase
    .from("subscription_accesses")
    .select("family_account_id, status")
    .in("status", ["trialing", "active", "past_due"]);

  const agora = new Date();
  const resultados: Array<{
    familyId: string;
    fired: number;
    resolved: number;
    error?: string;
  }> = [];

  for (const a of ativas ?? []) {
    const familyId = a.family_account_id as string;
    try {
      const r = await runRegrasParaFamilia(supabase, familyId, agora);
      resultados.push({
        familyId,
        fired: r.filter((x) => x.status === "fired_new").length,
        resolved: r.filter((x) => x.status === "resolved").length,
      });
    } catch (e) {
      resultados.push({
        familyId,
        fired: 0,
        resolved: 0,
        error: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return NextResponse.json({
    processadas: resultados.length,
    novos_alertas: resultados.reduce((acc, r) => acc + r.fired, 0),
    resolvidos: resultados.reduce((acc, r) => acc + r.resolved, 0),
    detalhes: resultados,
  });
}

/**
 * Campanhas: processa destinatarios pendentes de qualquer campanha em
 * status='enviando'. Roda 1x/hora (PRD §7.13). Bounded por BATCH_GLOBAL.
 */
async function runCampanhas(supabase: AdminClient) {
  const BATCH_GLOBAL = 500;

  const { data: ativas } = await supabase
    .from("campanhas")
    .select("id, categoria, conteudo_whatsapp")
    .eq("status", "enviando");

  const resultados: Array<{
    campanhaId: string;
    enviadas: number;
    bloqueadas: number;
    pendentes: number;
  }> = [];

  let restanteGlobal = BATCH_GLOBAL;

  for (const camp of ativas ?? []) {
    if (restanteGlobal <= 0) break;
    if (!camp.conteudo_whatsapp) continue;

    const { data: pendentes } = await supabase
      .from("campanhas_destinatarios")
      .select("id, family_account_id")
      .eq("campanha_id", camp.id)
      .eq("status", "pendente")
      .limit(restanteGlobal);

    let enviadas = 0;
    let bloqueadas = 0;

    for (const p of pendentes ?? []) {
      try {
        const r = await sendCampanha(supabase, {
          family_account_id: p.family_account_id as string,
          campanha_id: camp.id as string,
          categoria: camp.categoria as CampanhaCategoria,
          conteudo_whatsapp: camp.conteudo_whatsapp as string,
        });
        if (r.enviada) {
          enviadas++;
          await supabase
            .from("campanhas_destinatarios")
            .update({
              status: "enviada",
              enviada_em: new Date().toISOString(),
            })
            .eq("id", p.id);
        } else {
          bloqueadas++;
          await supabase
            .from("campanhas_destinatarios")
            .update({ status: "bloqueada", bloqueio_motivo: r.motivo })
            .eq("id", p.id);
        }
      } catch (e) {
        bloqueadas++;
        await supabase
          .from("campanhas_destinatarios")
          .update({
            status: "falha",
            bloqueio_motivo: e instanceof Error ? e.message : "erro",
          })
          .eq("id", p.id);
      }
      restanteGlobal--;
    }

    // Encerra campanha quando esvaziar
    const { count: pendCount } = await supabase
      .from("campanhas_destinatarios")
      .select("id", { count: "exact", head: true })
      .eq("campanha_id", camp.id)
      .eq("status", "pendente");
    const restantes = pendCount ?? 0;

    if (restantes === 0) {
      const [{ count: enviadasCount }, { count: bloqueadasCount }] =
        await Promise.all([
          supabase
            .from("campanhas_destinatarios")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", camp.id)
            .eq("status", "enviada"),
          supabase
            .from("campanhas_destinatarios")
            .select("id", { count: "exact", head: true })
            .eq("campanha_id", camp.id)
            .in("status", ["bloqueada", "falha"]),
        ]);
      await supabase
        .from("campanhas")
        .update({
          status: "enviada",
          total_alcance: enviadasCount ?? 0,
          total_bloqueados: bloqueadasCount ?? 0,
        })
        .eq("id", camp.id);
    }

    resultados.push({
      campanhaId: camp.id as string,
      enviadas,
      bloqueadas,
      pendentes: restantes,
    });
  }

  return NextResponse.json({
    campanhas: resultados.length,
    detalhes: resultados,
    batch_global_restante: restanteGlobal,
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
