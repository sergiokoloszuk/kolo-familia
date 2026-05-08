import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

const schema = z.object({
  // ISO timestamp do aceite (cliente envia o que registrou)
  aceitos_em: z.string().datetime().optional(),
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

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, termos_aceitos_em, privacidade_aceita_em")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) {
    return NextResponse.json(
      { ok: false, motivo: "family ainda não criada" },
      { status: 404 },
    );
  }

  const update: Record<string, string> = {};
  if (!family.termos_aceitos_em) update.termos_aceitos_em = ts;
  if (!family.privacidade_aceita_em) update.privacidade_aceita_em = ts;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, ja_aceito: true });
  }

  const { error } = await supabase
    .from("family_accounts")
    .update(update)
    .eq("id", family.id);
  if (error) {
    return NextResponse.json({ ok: false, motivo: error.message }, { status: 500 });
  }

  await logEvent({
    kind: "termos_aceitos",
    severity: "info",
    user_id: user.id,
    family_account_id: family.id as string,
  });

  return NextResponse.json({ ok: true });
}
