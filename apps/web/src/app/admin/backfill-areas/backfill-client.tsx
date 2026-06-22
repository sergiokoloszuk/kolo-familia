"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { backfillAreas } from "./actions";

export function BackfillClient({ restantesInicial }: { restantesInicial: number }) {
  const [pending, start] = useTransition();
  const [restantes, setRestantes] = useState(restantesInicial);
  const [totalFeito, setTotalFeito] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  function rodar() {
    setErro(null);
    start(async () => {
      const r = await backfillAreas();
      if (!r.ok) {
        setErro(r.error ?? "Erro inesperado");
        return;
      }
      setRestantes(r.restantes);
      setTotalFeito((t) => t + r.processados);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={rodar} disabled={pending || restantes === 0}>
          {pending
            ? "Etiquetando…"
            : restantes === 0
              ? "Tudo etiquetado ✓"
              : `Etiquetar próximos ${Math.min(25, restantes)}`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {restantes > 0 ? `${restantes} diário(s) sem área` : "nenhum pendente"}
          {totalFeito > 0 && ` · ${totalFeito} etiquetados nesta sessão`}
        </span>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
