import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { logEvent, logServerError } from "@/lib/log";
import { familiaEhDeStaff } from "@/lib/auth/acesso";
import { excluirFamilia } from "@/lib/billing/excluir-familia";
import {
  descreverMotivosAtivos,
  estadoRetencao,
  motivosAtivos,
  RETENCAO_DIAS,
  type EstadoRetencao,
  type MotivoRetencao,
} from "@/lib/billing/retencao";

/**
 * CRON DA RETENÇÃO — os três caminhos, não só o dunning.
 *
 * ⚠️ O NOME DA ROTA CONTINUA `exclusao-pagamento` DE PROPÓSITO: ela está no
 * `vercel.json` e trocar o caminho exigiria mexer no agendamento em produção.
 * Renomear o arquivo não vale o risco de o cron deixar de rodar em silêncio.
 *
 * O que mudou (20/08/2026): antes o filtro era `pagamento_falhou_em not null`,
 * carimbo que só nasce em `invoice.payment_failed`. Trial vencido e
 * cancelamento voluntário NUNCA geram esse evento — então esses dois caminhos
 * jamais eram apagados, apesar de a tela prometer que seriam. Agora a decisão
 * é de `estadoRetencao`, que deriva a data de cada caminho.
 *
 * ⛔ TRAVA: só apaga os motivos listados em `EXCLUSAO_AUTOMATICA`. Ausente ou
 * `off` = DRY-RUN — calcula, registra, não apaga. É o padrão.
 *
 * Protegido por CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}

type Avaliada = {
  familyId: string;
  estado: EstadoRetencao;
  apagada: boolean;
  motivoNaoApagou: string | null;
};

async function handle(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createServiceRoleClient();
  const ativos = motivosAtivos();
  const agora = Date.now();

  // Candidatas: tudo que NÃO está ativo. `active` nunca é elegível, e deixar
  // de fora aqui evita carregar a base inteira para descartar depois.
  const { data: linhas, error } = await admin
    .from("subscription_accesses")
    .select(
      "family_account_id, status, trial_ends_at, current_period_end, pagamento_falhou_em, cortesia, cortesia_ate, updated_at, stripe_subscription_id",
    )
    .neq("status", "active");

  if (error) {
    await logServerError("retencao_leitura_falhou", error, {});
    return NextResponse.json({ error: "leitura falhou" }, { status: 500 });
  }

  // Quem já recebeu aviso de fim de teste. UMA consulta para todas — a
  // alternativa (uma por família) seria centenas de idas ao banco por execução.
  const { data: avisos } = await admin
    .from("ayla_messages")
    .select("family_account_id")
    .in("tipo", ["trial_d0", "trial_d3"]);
  const avisadas = new Set((avisos ?? []).map((a) => a.family_account_id as string));

  const avaliadas: Avaliada[] = [];
  const porMotivo: Record<string, number> = {};
  const porProtecao: Record<string, number> = {};
  let apagadas = 0;

  for (const linha of linhas ?? []) {
    const familyId = linha.family_account_id as string;
    if (!familyId) continue;

    const ehStaff = await familiaEhDeStaff(admin, familyId);
    const estado = estadoRetencao(linha, { ehStaff, foiAvisada: avisadas.has(familyId) }, agora);

    if (estado.motivo) porMotivo[estado.motivo] = (porMotivo[estado.motivo] ?? 0) + 1;
    if (estado.protecao) porProtecao[estado.protecao] = (porProtecao[estado.protecao] ?? 0) + 1;

    if (!estado.elegivel) {
      avaliadas.push({ familyId, estado, apagada: false, motivoNaoApagou: estado.protecao ?? "em_retencao" });
      continue;
    }

    const motivo = estado.motivo as MotivoRetencao;
    if (!ativos.has(motivo)) {
      avaliadas.push({ familyId, estado, apagada: false, motivoNaoApagou: "dry_run" });
      continue;
    }

    // ── REVALIDAÇÃO IMEDIATA, camada 1 ──────────────────────────────────
    // Relê a linha agora, fechando a janela entre a consulta lá em cima e
    // este momento. Uma assinatura que entrou no meio some daqui.
    const { data: fresca } = await admin
      .from("subscription_accesses")
      .select(
        "family_account_id, status, trial_ends_at, current_period_end, pagamento_falhou_em, cortesia, cortesia_ate, updated_at, stripe_subscription_id",
      )
      .eq("family_account_id", familyId)
      .maybeSingle();
    const estadoFresco = estadoRetencao(
      fresca,
      { ehStaff, foiAvisada: avisadas.has(familyId) },
      Date.now(),
    );
    if (!estadoFresco.elegivel) {
      avaliadas.push({ familyId, estado: estadoFresco, apagada: false, motivoNaoApagou: "mudou_na_revalidacao" });
      continue;
    }

    // ── O STRIPE É A AUTORIDADE, camada 2 ───────────────────────────────
    // Se lá existe assinatura viva, a Kolo está errada — e apagar seria
    // destruir dado de quem está pagando. Erro de rede também aborta.
    const subId = (fresca?.stripe_subscription_id as string | null) ?? null;
    if (subId) {
      try {
        const s = await getStripeClient().subscriptions.retrieve(subId);
        if (s.status === "active" || s.status === "trialing") {
          await logEvent({
            kind: "retencao_abortada_stripe",
            severity: "error",
            family_account_id: familyId,
            message: `Stripe diz "${s.status}" e a Kolo diria apagar — divergência, exclusão abortada`,
          });
          avaliadas.push({ familyId, estado: estadoFresco, apagada: false, motivoNaoApagou: "stripe_ativo" });
          continue;
        }
      } catch (e) {
        await logServerError("retencao_stripe_indisponivel", e, { family_account_id: familyId });
        avaliadas.push({ familyId, estado: estadoFresco, apagada: false, motivoNaoApagou: "stripe_indisponivel" });
        continue;
      }
    }

    const { data: fam } = await admin
      .from("family_accounts")
      .select("user_id")
      .eq("id", familyId)
      .maybeSingle();
    const userId = (fam?.user_id as string | null) ?? null;
    if (!userId) {
      avaliadas.push({ familyId, estado: estadoFresco, apagada: false, motivoNaoApagou: "sem_user_id" });
      continue;
    }

    const r = await excluirFamilia(admin, {
      familyId,
      userId,
      motivo,
      detalhe: { inicio_em: estadoFresco.inicioEm, elegivel_em: estadoFresco.elegivelEm },
    });
    if (r.ok) apagadas += 1;
    avaliadas.push({
      familyId,
      estado: estadoFresco,
      apagada: r.ok,
      motivoNaoApagou: r.ok ? null : (r.erro ?? "falha"),
    });
  }

  const elegiveis = avaliadas.filter((a) => a.estado.elegivel).length;

  // Observabilidade persistida: motivo · início · elegível · proteção ·
  // resultado — a pergunta que o §11 do protocolo manda saber responder sem
  // depender da reclamação de uma família.
  await logEvent({
    kind: "retencao_execucao",
    severity: "warn",
    message: `motivos=${descreverMotivosAtivos()} avaliadas=${avaliadas.length} elegiveis=${elegiveis} apagadas=${apagadas}`,
    payload: {
      motivos_ativos: descreverMotivosAtivos(),
      retencao_dias: RETENCAO_DIAS,
      por_motivo: porMotivo,
      por_protecao: porProtecao,
      elegiveis,
      apagadas,
      detalhe: avaliadas.map((a) => ({
        familia: a.familyId,
        motivo: a.estado.motivo,
        inicio_em: a.estado.inicioEm,
        elegivel_em: a.estado.elegivelEm,
        protecao: a.estado.protecao,
        resultado: a.apagada ? "apagada" : (a.motivoNaoApagou ?? "preservada"),
      })),
    },
  });

  return NextResponse.json({
    ok: true,
    motivos_ativos: descreverMotivosAtivos(),
    dry_run: ativos.size === 0,
    avaliadas: avaliadas.length,
    por_motivo: porMotivo,
    por_protecao: porProtecao,
    elegiveis,
    apagadas,
  });
}
