import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolveFamily } from "@/lib/auth/current-family";
import { trackEventServer } from "@/lib/analytics/track";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

/**
 * Tracking de comportamento vindo do client (telas visitadas, cliques). Carimba
 * a FAMÍLIA no servidor pela sessão (o client não manda family_account_id — não
 * dá pra forjar) e insere em user_events via service-role. Fire-and-forget.
 *
 * Body: { evento: string, detalhe?: object }
 */

const schema = z.object({
  evento: z.string().trim().min(1).max(64),
  detalhe: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  // Generoso, mas barra storm de page-views (SPA navega rápido).
  const rl = checkRateLimit(clientKey(request, "track"), {
    capacidade: 120,
    refilPorMinuto: 120,
  });
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  const raw = await request.text();
  if (raw.length > 4 * 1024) return new NextResponse(null, { status: 413 });

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(raw));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Sessão → família. Sem usuário, ignora em silêncio (204).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const { data: family } = await resolveFamily(supabase);

  // Limita o tamanho do detalhe (defensivo) antes de gravar.
  const detalhe =
    parsed.detalhe && Object.keys(parsed.detalhe).length <= 20 ? parsed.detalhe : {};

  const admin = createServiceRoleClient();
  await trackEventServer(admin, {
    familyId: family?.id ?? null,
    userId: user.id,
    evento: parsed.evento,
    detalhe,
  });

  return new NextResponse(null, { status: 204 });
}
