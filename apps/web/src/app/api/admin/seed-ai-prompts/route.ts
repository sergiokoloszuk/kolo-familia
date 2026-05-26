import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SEED_PROMPTS } from "@/lib/ai/seed-prompts-data";

/**
 * Re-seed dos prompts da IA no banco. Útil quando o conteúdo do código
 * (lib/ai/seed-prompts-data.ts) muda e precisa propagar pra prod, já que
 * a tabela `ai_prompts` vence sobre o fallback do código quando existe.
 *
 * Proteção: Bearer CRON_SECRET (mesmo padrão do /api/ayla/cron). Endpoint
 * idempotente — upsert por `key`. Reload do schema da PostgREST não é
 * necessário aqui (só dados, não DDL).
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado no servidor" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const results: Array<{
    key: string;
    chars: number;
    status: "ok" | "error";
    error?: string;
  }> = [];

  for (const p of SEED_PROMPTS) {
    const { error } = await supabase.from("ai_prompts").upsert(
      {
        key: p.key,
        label: p.label,
        description: p.description,
        scope: p.scope,
        system_text: p.system_text,
        ativo: true,
      },
      { onConflict: "key" },
    );
    results.push({
      key: p.key,
      chars: p.system_text.length,
      status: error ? "error" : "ok",
      error: error?.message,
    });
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    count: results.length,
    results,
    ts: new Date().toISOString(),
  });
}
