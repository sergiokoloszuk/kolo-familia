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

  const env = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    stripe_secret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripe_secret_mode: stripeMode,
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

  return NextResponse.json(
    {
      ok,
      db: { ok: db_ok, latency_ms: db_latency_ms, error: db_error },
      env,
      total_ms,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
