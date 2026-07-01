"use client";

import { useEffect } from "react";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * Captura as UTMs da URL e guarda num cookie (kolo_utm, 30 dias, last-touch).
 * O onboarding lê esse cookie e grava a origem do anúncio na família — espelha
 * a atribuição de afiliado (kolo_ref). Só grava quando há UTM na URL (não apaga
 * o valor anterior ao navegar sem UTM). Cookie não é httpOnly (UTM não é dado
 * sensível; o servidor lê via cookies() no onboarding). Nunca quebra a tela.
 */
export function UtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of UTM_KEYS) {
        const v = params.get(k);
        if (v) utm[k] = v.slice(0, 200);
      }
      if (Object.keys(utm).length === 0) return;
      const value = encodeURIComponent(JSON.stringify(utm));
      const maxAge = 60 * 60 * 24 * 30; // 30 dias
      document.cookie = `kolo_utm=${value}; max-age=${maxAge}; path=/; samesite=lax`;
    } catch {
      // tracking nunca pode quebrar a tela
    }
  }, []);

  return null;
}
