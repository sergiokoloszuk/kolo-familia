import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Endpoint pra erros client-side. Recebe um pacote pequeno e insere
 * em eventos_app via cliente autenticado (RLS força kind=client_error).
 *
 * Formato esperado:
 *   { message, stack?, url, user_agent, family_account_id?, payload? }
 *
 * Limites:
 *   - message ≤ 500 chars
 *   - stack ≤ 4000 chars
 *   - body total ≤ 8 KB
 */

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().trim().max(4000).optional(),
  url: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(500).optional(),
  family_account_id: z.string().uuid().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  // Tamanho do body bem limitado
  const raw = await request.text();
  if (raw.length > 8 * 1024) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("eventos_app").insert({
    kind: "client_error",
    severity: "error",
    user_id: user.id,
    family_account_id: parsed.family_account_id ?? null,
    message: parsed.message,
    stack: parsed.stack ?? null,
    url: parsed.url ?? null,
    user_agent: parsed.user_agent ?? null,
    payload: parsed.payload ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
