"use client";

import { useEffect } from "react";

/**
 * O ELO QUE FALTAVA NO FUNIL COMERCIAL — 26/08/2026.
 *
 * O funil já tinha quase tudo: `trial_fechamento_tentativa` (elegível/enviado),
 * `checkout_iniciado` e a assinatura em `subscription_accesses`. **Faltava um
 * elo, e era o do meio:** saber se a família ABRIU a página depois de receber o
 * convite. Sem ele, "mandamos e ninguém assinou" não distingue *"não clicou"*
 * de *"clicou e a página não convenceu"* — duas causas com correções opostas.
 *
 * ⚠️ NADA DE IDENTIFICADOR NA URL. `/precos` é pública, e o link vai por
 * WhatsApp — uma URL com `familyId`, e-mail ou telefone vaza num print, num
 * encaminhamento ou no histórico do navegador. O link carrega **apenas a
 * ORIGEM** (`?de=d7`), que é um rótulo de campanha, igual para todas as
 * famílias e sem valor para quem o intercepta.
 *
 * ⚠️ QUEM LIGA O EVENTO À FAMÍLIA É O SERVIDOR. `/api/track` carimba a família
 * pela SESSÃO — o cliente não manda id, e não dá para forjar. Então:
 *   · família autenticada que clica no D7 → evento COM família;
 *   · quem abre sem sessão → evento sem família, e continua servindo de
 *     denominador honesto.
 * O identificador nunca passa pela URL; ele é derivado de quem já está logado.
 *
 * ⚠️ E UMA VISITA COMUM NÃO VIRA CLIQUE DO D7. O evento só é emitido quando o
 * parâmetro `de` existe. Abrir `/precos` pelo menu, pelo Google ou pela landing
 * não emite nada — que é o que separa este número de um contador de pageview.
 */
export function MarcoOrigem({ origem }: { origem: string | null }) {
  useEffect(() => {
    if (!origem) return;
    try {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento: "link_precos_aberto", detalhe: { origem } }),
        keepalive: true,
      }).catch(() => {
        /* telemetria nunca atrapalha a página */
      });
    } catch {
      /* idem */
    }
  }, [origem]);

  return null;
}
