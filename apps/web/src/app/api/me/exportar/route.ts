import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

/**
 * Exportação de dados pessoais — direito LGPD §18, II (acesso) + V
 * (portabilidade). Devolve um JSON com tudo que existe sob a família.
 *
 * Não inclui: hash de senha, tokens, payload bruto de webhooks Stripe
 * (são metadados internos).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const familyId = family?.id as string | undefined;

  // Coleta tudo via RLS — supabase já filtra por família
  const tabelas = [
    "family_accounts",
    "family_profiles",
    "membros_atipicos",
    "perfil_vivo_familia",
    "perfil_vivo_membro",
    "sugestao_perfil_vivos",
    "diarios",
    "check_ins_diarios",
    "check_ins_semanais",
    "reflexoes_semanais",
    "dass21_aplicacoes",
    "conversas",
    "mensagens_skill",
    "ayla_messages",
    "ayla_daily_checkins",
    "ayla_preferences",
    "ayla_insights",
    "subscription_accesses",
    "avatares_membros_atipicos",
    "galeria_imagens",
    "relatorios_gerados",
    "links_vivos",
    "alertas",
    "adaptacoes_sugeridas",
    "regras_overrides",
    "feedback_beta",
  ] as const;

  const dump: Record<string, unknown> = {
    exportado_em: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    aviso:
      "Dados exportados conforme LGPD art. 18, II e V. Não inclui credenciais, tokens ou dados de outros usuários.",
  };

  for (const t of tabelas) {
    const { data } = await supabase.from(t).select("*");
    dump[t] = data ?? [];
  }

  if (familyId) {
    await logEvent({
      kind: "exportacao_dados",
      severity: "info",
      user_id: user.id,
      family_account_id: familyId,
      message: "Usuária baixou seus dados (LGPD).",
    });
  }

  const body = JSON.stringify(dump, null, 2);
  const filename = `kolo-familia-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
