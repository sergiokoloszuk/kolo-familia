"use client";

import { useEffect } from "react";

/**
 * Consome o código de convite Beta guardado em localStorage durante
 * o signup. Roda silenciosamente — se não houver código, no-op; se
 * o endpoint retornar 401 (ainda não logada) tenta de novo numa
 * próxima navegação; se retornar 400 com motivo "termine onboarding",
 * fica esperando próxima carga.
 *
 * Best-effort: se algo falhar, deixa pendente. Admin pode ver no log.
 */

const KEY = "beta_codigo_pendente";

export function BetaConviteConsumer() {
  useEffect(() => {
    let cancelled = false;
    let codigo: string | null = null;
    try {
      codigo = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!codigo) return;

    (async () => {
      try {
        const r = await fetch("/api/beta/consumir-convite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codigo }),
          keepalive: true,
        });
        if (cancelled) return;
        if (r.ok) {
          try {
            localStorage.removeItem(KEY);
          } catch {
            // ignora
          }
        }
        // 401 / 400 com onboarding pendente: deixa o código no storage
      } catch {
        // Erro de rede: tenta de novo na próxima carga
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
