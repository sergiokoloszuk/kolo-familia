import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

/**
 * Captura de UTM ROBUSTA — chamada pela tela de cadastro logo após o signUp
 * (com o userId recém-criado), pra gravar a origem do anúncio na família NA
 * HORA, sem depender do cookie sobreviver nem de a pessoa terminar o onboarding.
 *
 * Escreve só quando ainda não há atribuição (first-touch) e só a conta daquele
 * userId (conta acabada de criar). Dado não-sensível (etiquetas de anúncio).
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(clientKey(request, "track_utm"), {
    capacidade: 20,
    refilPorMinuto: 10,
  });
  if (!rl.ok) return NextResponse.json({ ok: false, motivo: "rate_limit" }, { status: 429 });

  let body: { userId?: unknown; utm?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : null;
  const utm = body.utm && typeof body.utm === "object" ? body.utm : null;
  if (!userId || !utm) return NextResponse.json({ ok: false }, { status: 400 });

  const val = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
  const source = val(utm.utm_source);
  if (!source) return NextResponse.json({ ok: true, skipped: "sem utm_source" });

  const admin = createServiceRoleClient();
  const gravar = () =>
    admin
      .from("family_accounts")
      .update({
        utm_source: source,
        utm_medium: val(utm.utm_medium),
        utm_campaign: val(utm.utm_campaign),
        utm_content: val(utm.utm_content),
        utm_term: val(utm.utm_term),
        utm_atribuido_em: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .is("utm_atribuido_em", null)
      .select("id");

  // Corrida: a família pode ainda não ter sido criada pelo trigger. Tenta 1x mais.
  let res = await gravar();
  if (!res.error && (res.data?.length ?? 0) === 0) {
    await new Promise((r) => setTimeout(r, 800));
    res = await gravar();
  }

  const n = res.data?.length ?? 0;
  console.log(
    `[track-utm] userId=${userId} source=${source} campaign=${val(utm.utm_campaign) ?? "-"} content=${val(utm.utm_content) ?? "-"} → ${n} linha(s)${res.error ? ` ERRO: ${res.error.message}` : ""}`,
  );

  if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: n });
}
