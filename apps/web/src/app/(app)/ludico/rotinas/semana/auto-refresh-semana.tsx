"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enquanto algum dia está gerando cartões, recarrega a tela da semana sozinha
 * (a cada 4s) — assim o chip vira de "gerando…" pra "prontos ✓" sem F5. Para
 * quando não há mais nada gerando.
 */
export function AutoRefreshSemana({ ativo }: { ativo: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [ativo, router]);
  return null;
}
