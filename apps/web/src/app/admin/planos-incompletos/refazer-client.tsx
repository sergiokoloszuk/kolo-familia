"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { refazerPlanosIncompletos } from "./actions";

export function RefazerClient({ restantesInicial }: { restantesInicial: number }) {
  const [pending, start] = useTransition();
  const [restantes, setRestantes] = useState(restantesInicial);
  const [refeitos, setRefeitos] = useState(0);
  const [falhos, setFalhos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  function rodar() {
    setErro(null);
    start(async () => {
      const r = await refazerPlanosIncompletos();
      if (!r.ok) {
        setErro(r.error ?? "Erro inesperado");
        return;
      }
      setRestantes(r.restantes);
      setRefeitos((t) => t + r.refeitos);
      setFalhos((t) => t + r.aindaQuebrados);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={rodar} disabled={pending || restantes === 0}>
          {pending
            ? "Refazendo…"
            : restantes === 0
              ? "Nenhum plano quebrado ✓"
              : `Refazer próximos ${Math.min(3, restantes)}`}
        </Button>
        <span className="text-sm text-muted-foreground">
          {restantes > 0 ? `${restantes} plano(s) sem as práticas` : "nenhum pendente"}
          {refeitos > 0 && ` · ${refeitos} refeitos nesta sessão`}
          {falhos > 0 && ` · ${falhos} não deram certo (voltam pra fila)`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Cada plano leva de 30s a 1min (várias chamadas à IA por dentro). Fique na página até o
        lote terminar.
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
