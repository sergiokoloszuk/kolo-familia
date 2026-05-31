import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Cron diário (vercel.json) que puxa snapshot do gasto reportado pelo
 * próprio provider (Anthropic Admin API + OpenAI Admin API) dos últimos
 * 7 dias e faz upsert em api_provider_snapshots.
 *
 * Serve de truth global pra cross-check vs nossa soma de api_calls. Se
 * uma chave de admin não estiver configurada (ANTHROPIC_ADMIN_API_KEY /
 * OPENAI_ADMIN_API_KEY), pulamos esse provider e retornamos motivo —
 * dashboard mostra "snapshot indisponível" e cai pra usar só a soma do
 * api_calls.
 *
 * Auth: Bearer CRON_SECRET (header `Authorization`). Vercel Cron envia
 * automaticamente se a env CRON_SECRET estiver configurada.
 */

export const dynamic = "force-dynamic";

type ResultadoProvider =
  | { ok: true; dias_inseridos: number; total_periodo_usd: number }
  | { ok: false; motivo: string }
  | { ok: false; pulado: true; motivo: string };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const [anthropic, openai] = await Promise.all([
    puxarAnthropic(supabase).catch((e) => ({
      ok: false as const,
      motivo: e instanceof Error ? e.message : String(e),
    })),
    puxarOpenAI(supabase).catch((e) => ({
      ok: false as const,
      motivo: e instanceof Error ? e.message : String(e),
    })),
  ]);

  return NextResponse.json({
    fetched_at: new Date().toISOString(),
    anthropic,
    openai,
  });
}

const DIAS_LOOKBACK = 7;

async function puxarAnthropic(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<ResultadoProvider> {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!key) return { ok: false, pulado: true, motivo: "ANTHROPIC_ADMIN_API_KEY ausente" };

  const startingAt = new Date(Date.now() - DIAS_LOOKBACK * 86400_000).toISOString();
  const url = `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${encodeURIComponent(startingAt)}&bucket_width=1d`;

  const res = await fetch(url, {
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const buckets = json.data ?? [];

  let inseridos = 0;
  let totalUsd = 0;
  for (const bucket of buckets) {
    const dateRaw = (bucket.starting_at as string | undefined) ?? null;
    const date = dateRaw?.slice(0, 10);
    if (!date) continue;
    const total = somarBucketAnthropic(bucket);
    totalUsd += total;
    await supabase.from("api_provider_snapshots").upsert(
      {
        provider: "anthropic",
        date,
        gasto_usd: total,
        raw: bucket,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "provider,date" },
    );
    inseridos++;
  }
  return { ok: true, dias_inseridos: inseridos, total_periodo_usd: totalUsd };
}

/**
 * Extrai o total em USD do bucket do cost_report da Anthropic. O formato
 * documentado é { results: [{ amount: number, currency: "USD", ... }] }
 * — mas tolera variações pra não quebrar se mudarem o shape.
 */
function somarBucketAnthropic(bucket: Record<string, unknown>): number {
  const results = (bucket.results as Array<Record<string, unknown>> | undefined) ?? [];
  let total = 0;
  for (const r of results) {
    const amount = r.amount;
    if (typeof amount === "number") {
      total += amount;
    } else if (amount && typeof amount === "object" && "value" in amount) {
      const v = (amount as { value: unknown }).value;
      if (typeof v === "number") total += v;
    }
  }
  return total;
}

async function puxarOpenAI(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<ResultadoProvider> {
  const key = process.env.OPENAI_ADMIN_API_KEY;
  if (!key) return { ok: false, pulado: true, motivo: "OPENAI_ADMIN_API_KEY ausente" };

  const startTime = Math.floor((Date.now() - DIAS_LOOKBACK * 86400_000) / 1000);
  const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&bucket_width=1d`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const buckets = json.data ?? [];

  let inseridos = 0;
  let totalUsd = 0;
  for (const bucket of buckets) {
    const startSec = bucket.start_time as number | undefined;
    if (typeof startSec !== "number") continue;
    const date = new Date(startSec * 1000).toISOString().slice(0, 10);
    const total = somarBucketOpenAI(bucket);
    totalUsd += total;
    await supabase.from("api_provider_snapshots").upsert(
      {
        provider: "openai",
        date,
        gasto_usd: total,
        raw: bucket,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "provider,date" },
    );
    inseridos++;
  }
  return { ok: true, dias_inseridos: inseridos, total_periodo_usd: totalUsd };
}

/**
 * OpenAI cost bucket: { results: [{ amount: { value, currency }, ... }] }.
 */
function somarBucketOpenAI(bucket: Record<string, unknown>): number {
  const results = (bucket.results as Array<Record<string, unknown>> | undefined) ?? [];
  let total = 0;
  for (const r of results) {
    const amount = r.amount;
    if (amount && typeof amount === "object" && "value" in amount) {
      const v = (amount as { value: unknown }).value;
      if (typeof v === "number") total += v;
    } else if (typeof amount === "number") {
      total += amount;
    }
  }
  return total;
}
