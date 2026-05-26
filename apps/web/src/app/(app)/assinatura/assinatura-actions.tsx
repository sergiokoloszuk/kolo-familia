"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { iniciarCheckout, abrirPortal } from "./actions";

export function AssinaturaActions({
  status,
  temCustomerId,
}: {
  status: string;
  temCustomerId: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [pendingAcao, setPendingAcao] = useState<string | null>(null);

  function checkout(plano: "mensal" | "anual") {
    setErro(null);
    setPendingAcao(`checkout-${plano}`);
    startTransition(async () => {
      const r = await iniciarCheckout({ plano });
      if (!r.ok) {
        setErro(traduzirErro(r.error));
        setPendingAcao(null);
        return;
      }
      window.location.assign(r.url);
    });
  }

  function portal() {
    setErro(null);
    setPendingAcao("portal");
    startTransition(async () => {
      const r = await abrirPortal();
      if (!r.ok) {
        setErro(traduzirErro(r.error));
        setPendingAcao(null);
        return;
      }
      window.location.assign(r.url);
    });
  }

  const podeAssinar = status !== "active";
  const podeGerenciar = temCustomerId;

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {podeAssinar && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => checkout("mensal")} disabled={pending}>
            {pendingAcao === "checkout-mensal" ? "Abrindo..." : "Assinar mensal"}
          </Button>
          <Button variant="outline" onClick={() => checkout("anual")} disabled={pending}>
            {pendingAcao === "checkout-anual" ? "Abrindo..." : "Assinar anual (com desconto)"}
          </Button>
        </div>
      )}

      {podeGerenciar && (
        <div>
          <Button variant="outline" onClick={portal} disabled={pending}>
            {pendingAcao === "portal" ? "Abrindo..." : "Gerenciar assinatura"}
          </Button>
        </div>
      )}

      {!podeGerenciar && !podeAssinar && (
        <p className="text-xs text-muted-foreground">Sem ações disponíveis no momento.</p>
      )}
    </div>
  );
}

function traduzirErro(msg: string): string {
  if (msg.toLowerCase().includes("stripe_secret_key"))
    return "A chave do Stripe não está configurada no servidor.";
  if (msg.toLowerCase().includes("stripe_price_id"))
    return "Os preços do Stripe não estão configurados (PRICE_ID_MENSAL/ANUAL).";
  if (msg.toLowerCase().includes("não tem assinatura paga"))
    return "Você ainda não tem assinatura paga. Use 'Assinar' primeiro.";
  return msg;
}
