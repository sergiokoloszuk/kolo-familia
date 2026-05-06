import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * proxy.ts (antigo middleware.ts em Next.js 15) — roda em runtime nodejs,
 * antes de cada renderização. Refresca a sessão Supabase via cookies.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tudo que não é asset estático nem API interna do Next.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
