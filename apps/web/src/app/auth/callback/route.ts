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

  // Conta nova via OAuth (Google) → passa pela página-relâmpago /cadastro-ok
  // (no grupo (auth), onde o GTM carrega) pra disparar a conversão form_submit;
  // ela encaminha pro /onboarding (que NÃO tem GTM, por LGPD).
  //
  // NÃO dá pra detectar "novo" por "não tem family_account": o gatilho
  // handle_new_user cria a família já no insert do usuário, então ela SEMPRE
  // existe aqui (era por isso que a conversão do Google nunca disparava).
  // Detectamos por: provedor social (≠ email) + conta criada agora há pouco.
  // O cadastro por e-mail NÃO entra aqui (provider 'email'), porque já dispara
  // o form_submit na própria /signup — evita contagem dupla.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const provider = user.app_metadata?.provider;
    const ehSocial = !!provider && provider !== "email";
    const criadoMs = user.created_at ? new Date(user.created_at).getTime() : 0;
    const recemCriado = criadoMs > 0 && Date.now() - criadoMs < 5 * 60 * 1000;
    if (ehSocial && recemCriado) {
      return NextResponse.redirect(`${origin}/cadastro-ok`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
