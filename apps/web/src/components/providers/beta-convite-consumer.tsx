"use client";

import { useEffect } from "react";

/**
 * Consome itens pendentes guardados em localStorage durante o signup:
 *   - código de convite Beta → /api/beta/consumir-convite
 *   - timestamp de aceite de termos → /api/me/aceitar-termos
 *
 * Roda silenciosamente. Se 401, deixa pendente — tenta de novo na
 * próxima navegação após login.
 */

const KEY_BETA = "beta_codigo_pendente";
const KEY_TERMOS = "termos_aceitos_em_pendente";

export function BetaConviteConsumer() {
  useEffect(() => {
    let cancelled = false;

    let codigo: string | null = null;
    let termosTs: string | null = null;
    try {
      codigo = localStorage.getItem(KEY_BETA);
      termosTs = localStorage.getItem(KEY_TERMOS);
    } catch {
      return;
    }
    if (!codigo && !termosTs) return;

    (async () => {
      if (codigo) {
        try {
          const r = await fetch("/api/beta/consumir-convite", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ codigo }),
            keepalive: true,
          });
          if (!cancelled && r.ok) {
            try {
              localStorage.removeItem(KEY_BETA);
            } catch {
              /* ignora */
            }
          }
        } catch {
          /* tenta de novo depois */
        }
      }

      if (termosTs) {
        try {
          const r = await fetch("/api/me/aceitar-termos", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ aceitos_em: termosTs }),
            keepalive: true,
          });
          if (!cancelled && r.ok) {
            try {
              localStorage.removeItem(KEY_TERMOS);
            } catch {
              /* ignora */
            }
          }
        } catch {
          /* tenta de novo depois */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
