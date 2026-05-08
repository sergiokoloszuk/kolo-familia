import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  sendRotinaDiaria,
  sendEngajamento,
  sendTrial,
  sendEmocionalStreak,
  sendProximoInsight,
  sendCampanha,
  type CampanhaCategoria,
} from "@/lib/ayla/orchestrator";
import { detectAndPersist } from "@/lib/ayla/insightEngine";

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
 */
export async function POST(request: NextRequest) {
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

  if (tipo === "rotina") return runRotina(supabase);
  if (tipo === "inatividade") return runInatividade(supabase);
  if (tipo === "comercial") return runComercial(supabase);
  if (tipo === "emocional") return runEmocional(supabase);
  if (tipo === "insights") return runInsights(supabase);
  if (tipo === "campanhas") return runCampanhas(supabase);

  return NextResponse.json({ error: `tipo inválido: ${tipo}` }, { status: 400 });
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Roda rotina diária para todas as famílias ativas onde:
 *   - subscription_access.status in (trialing, active, past_due)
 *   - ayla_preferences.consentimento_em existe + não desativada + não pausada
 *   - hora atual (UTC) cai dentro de horario_preferido_inicio..fim
 *
 * Ideal: cron rodar a cada 30min. Cada chamada despacha as famílias
 * cujo horário casa naquele momento.
 */
async function runRotina(supabase: AdminClient) {
  const agora = new Date();
  const horaAtualUtc = agora.toISOString().slice(11, 16); // HH:MM

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
    // Janela em horário UTC simples — TODO: respeitar timezone real da família
    if (inicio && fim && horaAtualUtc >= inicio && horaAtualUtc <= fim) {
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
