"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics/track-client";
import { telaDeRota } from "@/lib/analytics/telas";

/**
 * Dispara 'tela_visitada' a cada mudança de rota dentro do app. Montado uma vez
 * no layout do (app); fire-and-forget. Não renderiza nada.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    track("tela_visitada", { tela: telaDeRota(pathname), path: pathname });
  }, [pathname]);
  return null;
}
