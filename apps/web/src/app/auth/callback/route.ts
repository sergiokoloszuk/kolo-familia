import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback do OAuth (Google, etc) e do magic link de confirmação de e-mail.
 *
 * Supabase redireciona pra cá com `?code=...&next=/destino`.
 * Trocamos o code por sessão e:
 *  - se o user NÃO tem `family_account` (primeiro login, geralmente via Google
 *    OAuth que auto-cria a conta no Supabase), manda direto pro /onboarding
 *    pra não deixar a pessoa perdida na landing sem entender o que aconteceu.
 *  - se já tem família, segue pro `next` (default `/`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_code`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // User sem family_account → primeiro acesso, manda pro onboarding.
  // Sem isso, OAuth de novo usuário caía silenciosamente na landing.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!family) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
