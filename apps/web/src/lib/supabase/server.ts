import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 *
 * Em Next.js 16, `cookies()` é async — daí a função ser async e ter `await`
 * antes de chamar.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll falha em Server Components puros — ignorar.
            // O proxy.ts cuida do refresh de sessão antes da renderização.
          }
        },
      },
    },
  );
}

/**
 * Cliente Supabase com a chave de SERVICE ROLE — bypassa RLS.
 *
 * Usar APENAS em rotas server-only e nunca expor para o navegador.
 * Pensar duas vezes antes de chamar — quase sempre o `createClient()`
 * com sessão de usuário é suficiente.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient não pode rodar no navegador.");
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // service role não persiste sessão
        },
      },
    },
  );
}
