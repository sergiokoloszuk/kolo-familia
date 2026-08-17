import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Health check: responde com latência do DB + presença das envs
 * críticas. Útil pra dashboards externos / smoke test pós-deploy.
 *
 * Não vaza chaves — só retorna boolean de presença.
 */
export async function GET() {
  const t0 = Date.now();

  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : stripeKey
        ? "unknown"
        : "missing";

  // Diagnóstico: verifica se cada price do .env existe no modo do secret
  // (live com price de teste devolve 404 — explica falha do checkout).
  async function checkPrice(id: string | undefined): Promise<string> {
    if (!stripeKey) return "no_key";
    if (!id) return "missing_env";
    try {
      const r = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
        headers: { authorization: `Bearer ${stripeKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 200) return "ok";
      if (r.status === 404) return "not_found_in_mode";
      return `http_${r.status}`;
    } catch {
      return "error";
    }
  }
  const [priceMensal, priceAnual] = await Promise.all([
    checkPrice(process.env.STRIPE_PRICE_ID_MENSAL),
    checkPrice(process.env.STRIPE_PRICE_ID_ANUAL),
  ]);

  const env = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    stripe_secret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripe_secret_mode: stripeMode,
    stripe_webhook_secret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripe_price_mensal: priceMensal,
    stripe_price_anual: priceAnual,
    zapi_token: Boolean(process.env.ZAPI_TOKEN),
    cron_secret: Boolean(process.env.CRON_SECRET),
  };

  let db_ok = false;
  let db_latency_ms: number | null = null;
  let db_error: string | null = null;

  try {
    const supabase = createServiceRoleClient();
    const t1 = Date.now();
    const { error } = await supabase
      .from("output_types")
      .select("key", { count: "exact", head: true })
      .limit(1);
    db_latency_ms = Date.now() - t1;
    if (error) db_error = error.message;
    else db_ok = true;
  } catch (e) {
    db_error = e instanceof Error ? e.message : "unknown";
  }

  const total_ms = Date.now() - t0;
  const allEnvOk = Object.values(env).every(Boolean);
  const ok = db_ok && allEnvOk;

  // ⚠️ QUAL COMMIT ESTÁ NO AR (17/08/2026).
  //
  // "Publicado" e "deployado" são estados diferentes — o §18 do protocolo
  // separa os dois de propósito — e até aqui não havia NENHUMA forma de
  // responder a segunda pergunta de fora da Vercel. Na prática isso já custou
  // caro: pendências ficaram meses marcadas como "corrigida, não publicada"
  // quando o commit estava em `main` há semanas (foi o caso da PEND-071), e
  // toda auditoria precisava confiar em memória em vez de medir.
  //
  // A Vercel injeta estas variáveis sozinha em cada build. O SHA de um commit
  // é informação pública do repositório — não há segredo aqui, e por isso este
  // bloco fica fora do `env`, que só publica booleanos de presença.
  const deploy = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    ambiente: process.env.VERCEL_ENV ?? null,
  };

  return NextResponse.json(
    {
      ok,
      deploy,
      db: { ok: db_ok, latency_ms: db_latency_ms, error: db_error },
      env,
      total_ms,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
