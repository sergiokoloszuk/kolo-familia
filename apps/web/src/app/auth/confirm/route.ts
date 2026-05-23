import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirmação de e-mail (signup) e recuperação de senha via `token_hash`.
 *
 * Diferente do `/auth/callback` (PKCE, usado pelo OAuth do Google), esta rota
 * usa `verifyOtp` com `token_hash` — que NÃO depende do navegador/dispositivo
 * onde o fluxo começou. É o que permite a pessoa se cadastrar no desktop e
 * confirmar o e-mail no celular (o link do e-mail abre em qualquer lugar).
 *
 * Os templates de e-mail apontam pra cá com:
 *   /auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
 *   /auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
