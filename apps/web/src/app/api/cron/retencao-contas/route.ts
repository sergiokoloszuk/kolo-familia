import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEvent, logServerError } from "@/lib/log";

const DIA_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const agora = new Date();
  const executarExclusao = process.env.ACCOUNT_DELETE_ENABLED === "true";
  const executarRetencaoBf = process.env.BF2026_RETENTION_DELETE_ENABLED === "true";

  const { data: solicitacoes, error: solicitacoesError } = await admin
    .from("exclusao_conta_solicitacoes")
    .select("family_account_id, user_id, executar_em, status")
    .in("status", ["agendada", "falhou"])
    .lte("executar_em", agora.toISOString())
    .limit(100);
  if (solicitacoesError) throw solicitacoesError;

  let exclusoesAgendadasExecutadas = 0;
  const exclusoesAgendadasCandidatas = solicitacoes?.length ?? 0;
  if (executarExclusao) {
    for (const solicitacao of solicitacoes ?? []) {
      const familyId = solicitacao.family_account_id as string;
      const userId = solicitacao.user_id as string;
      const { data: acesso } = await admin
        .from("subscription_accesses")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("family_account_id", familyId)
        .maybeSingle();
      const periodoAindaVigente = acesso?.current_period_end &&
        new Date(acesso.current_period_end as string).getTime() > agora.getTime();
      if (periodoAindaVigente || (acesso?.status === "active" && acesso?.cancel_at_period_end !== true)) {
        continue;
      }

      const apagou = await excluirUsuarioComRegistroMinimo(admin, userId, familyId, "solicitacao");
      if (apagou) exclusoesAgendadasExecutadas++;
    }
  }

  const limiteBf = new Date(agora.getTime() - 30 * DIA_MS).toISOString();
  const { data: participacoes, error: participacoesError } = await admin
    .from("black_friday_2026_participacoes")
    .select("family_account_id, oferta_fim_exclusivo")
    .is("convertido_em", null)
    .lte("oferta_fim_exclusivo", limiteBf)
    .limit(100);
  if (participacoesError) throw participacoesError;

  let retencoesBfExecutadas = 0;
  const retencoesBfCandidatas = participacoes?.length ?? 0;
  if (executarRetencaoBf) {
    for (const participacao of participacoes ?? []) {
      const familyId = participacao.family_account_id as string;
      const [{ data: acesso }, { data: familia }] = await Promise.all([
        admin
          .from("subscription_accesses")
          .select("status, trial_ends_at, current_period_end, cortesia")
          .eq("family_account_id", familyId)
          .maybeSingle(),
        admin.from("family_accounts").select("user_id").eq("id", familyId).maybeSingle(),
      ]);
      const possuiAcesso = acesso?.cortesia === true || acesso?.status === "active" ||
        (acesso?.status === "trialing" && acesso?.trial_ends_at &&
          new Date(acesso.trial_ends_at as string).getTime() > agora.getTime()) ||
        (acesso?.current_period_end &&
          new Date(acesso.current_period_end as string).getTime() > agora.getTime());
      if (possuiAcesso || !familia?.user_id) continue;

      const apagou = await excluirUsuarioComRegistroMinimo(
        admin,
        familia.user_id as string,
        familyId,
        "black_friday_2026_retencao",
      );
      if (apagou) retencoesBfExecutadas++;
    }
  }

  return NextResponse.json({
    ok: true,
    exclusao_agendada: {
      dry_run: !executarExclusao,
      candidatos: exclusoesAgendadasCandidatas,
      apagados: exclusoesAgendadasExecutadas,
    },
    retencao_black_friday: {
      dry_run: !executarRetencaoBf,
      candidatos: retencoesBfCandidatas,
      apagados: retencoesBfExecutadas,
    },
  });
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function excluirUsuarioComRegistroMinimo(
  admin: AdminClient,
  userId: string,
  familyId: string,
  origem: string,
): Promise<boolean> {
  const [{ data: usuario }, { data: familia }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("family_accounts").select("whatsapp_e164").eq("id", familyId).maybeSingle(),
  ]);
  const { error: registroError } = await admin.rpc("registrar_teste_usado", {
    p_email: usuario?.user?.email ?? null,
    p_whatsapp: (familia?.whatsapp_e164 as string | null) ?? null,
    p_origem: origem,
  });
  if (registroError) {
    await logServerError("registrar_teste_usado_falhou", registroError, {
      user_id: userId,
      family_account_id: familyId,
    });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await admin
      .from("exclusao_conta_solicitacoes")
      .update({
        status: "falhou",
        ultimo_erro: error.message,
        updated_at: new Date().toISOString(),
      })
      .eq("family_account_id", familyId);
    await logServerError("retencao_conta_delete_user", error, {
      user_id: userId,
      family_account_id: familyId,
    });
    return false;
  }

  await logEvent({
    kind: "conta_excluida_retencao",
    severity: "warn",
    user_id: userId,
    family_account_id: familyId,
    message: `Conta excluída conforme regra: ${origem}.`,
  });
  return true;
}
