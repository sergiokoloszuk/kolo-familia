"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-busca o server component a cada 5s enquanto a história está gerando.
 * `router.refresh()` é não-bloqueante — diferente do <meta refresh>, não rouba
 * cliques nem cancela navegação iniciada pelo usuário. Quando o page.tsx
 * detecta status != 'gerando', este componente desmonta e o polling para.
 */
export function HistoriaPoller({ intervaloMs = 5000 }: { intervaloMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);
  return null;
}
