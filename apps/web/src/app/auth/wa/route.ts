import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Aterrissagem do magic-link enviado pela Ayla no WhatsApp (Fase 3).
 *
 * A Ayla manda `/auth/wa?token_hash=...&next=/conversar/<id>`. Aqui
 * verificamos o token (verifyOtp grava a sessão nos cookies via SSR) e
 * mandamos a pessoa pro destino, já logada.
 *
 * Degradação graciosa: token ausente/expirado/inválido → manda pro /login
 * preservando o `next`. A pessoa loga manualmente e ainda cai no lugar
 * certo. Nunca mostra erro cru.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const nextRaw = searchParams.get("next") ?? "/estrategias";
  // Só aceita caminho relativo interno (evita open-redirect).
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/estrategias";

  const loginFallback = `${origin}/login?next=${encodeURIComponent(next)}`;

  if (!tokenHash) {
    return NextResponse.redirect(loginFallback);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(loginFallback);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
