import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendRotinaDiaria, sendEngajamento } from "@/lib/ayla/orchestrator";

/**
 * Cron da Ayla — chamado por scheduler externo (n8n, Vercel Cron, etc.).
 *
 * Tipos suportados via query param `?tipo=`:
 *   - rotina       — manda pergunta diária (PRD §12.9.1)
 *   - inatividade  — detecta 2 e 5 dias sem responder (PRD §12.9.2)
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
