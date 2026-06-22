"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { backfillSnapshots } from "./actions";

export function SnapshotsClient({ restantesInicial }: { restantesInicial: number }) {
  const [pending, start] = useTransition();
  const [restantes, setRestantes] = useState(restantesInicial);
  const [totalFeito, setTotalFeito] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  function rodar() {
    setErro(null);
    start(async () => {
      const r = await backfillSnapshots();
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
            ? "Gerando fotos…"
            : restantes === 0
              ? "Histórico completo ✓"
              : `Gerar próximas ${Math.min(6, restantes)}`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {restantes > 0 ? `${restantes} foto(s) de meses pendentes` : "nenhuma pendente"}
          {totalFeito > 0 && ` · ${totalFeito} geradas nesta sessão`}
        </span>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
