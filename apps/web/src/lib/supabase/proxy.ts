import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Helper chamado pelo proxy.ts da raiz para refrescar a sessão Supabase
 * antes de cada renderização SSR.
 *
 * Sem isso, tokens expiram e o usuário cai pra deslogado mesmo tendo
 * cookies válidos. Padrão recomendado por @supabase/ssr.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANTE: rodar getUser() força o refresh do token e rejeita
  // sessões inválidas. Não substituir por getSession() (não valida).
  await supabase.auth.getUser();

  return supabaseResponse;
}
