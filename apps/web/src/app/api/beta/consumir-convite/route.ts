import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validarConvite, consumirConvite } from "@/lib/beta/gate";
import { isBetaGateAtivo } from "@/lib/beta/codigos";

/**
 * Consome o convite após o signup completo. Idempotente — se a
 * família já tem registro em beta_invite_uses, no-op.
 *
 * Fluxo: signup (client) → supabase.auth.signUp → email confirmation
 * (opcional) → primeiro login + onboarding chama este endpoint com
 * o código que o user digitou (vinda de localStorage no client).
 */

const schema = z.object({
  codigo: z.string().trim().min(1).max(40),
});

export async function POST(request: NextRequest) {
  if (!isBetaGateAtivo()) {
    return NextResponse.json({ ok: true, gate_ativo: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, motivo: "unauthorized" }, { status: 401 });
  }

  let body: { codigo: string };
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, motivo: "Body inválido." },
      { status: 400 },
    );
  }

  const v = await validarConvite(body.codigo);
  if (!v.ok) {
    return NextResponse.json({ ok: false, motivo: v.motivo }, { status: 400 });
  }

  // Resolve family_account_id do user
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) {
    return NextResponse.json(
      { ok: false, motivo: "Sem família ainda — termine o onboarding antes." },
      { status: 400 },
    );
  }

  await consumirConvite({
    invite_id: v.invite_id,
    family_account_id: family.id as string,
    user_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
