import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

const schema = z.object({
  // ISO timestamp do aceite (cliente envia o que registrou)
  aceitos_em: z.string().datetime().optional(),
  marketing: z.boolean().optional(),
});

/**
 * Persiste o aceite de termos + privacidade na conta da família.
 *
 * Idempotente: se já tiver timestamp, não sobrescreve.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof schema> = {};
  try {
    body = schema.parse(await request.json());
  } catch {
    body = {};
  }
  const ts = body.aceitos_em ?? new Date().toISOString();

  const { data: familyId, error } = await supabase.rpc("registrar_meus_aceites_kolo", {
    p_aceitos_em: ts,
    p_marketing: body.marketing === true,
    p_marketing_informado: body.marketing !== undefined,
  });
  if (error) {
    return NextResponse.json({ ok: false, motivo: error.message }, { status: 500 });
  }
  if (!familyId) {
    return NextResponse.json(
      { ok: false, motivo: "family ainda não criada" },
      { status: 404 },
    );
  }

  await logEvent({
    kind: "termos_aceitos",
    severity: "info",
    user_id: user.id,
    family_account_id: familyId as string,
  });

  return NextResponse.json({ ok: true });
}
