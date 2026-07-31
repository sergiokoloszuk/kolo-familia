"use client";

import { useState } from "react";
import type { CasoRevisao } from "@/lib/memoria-viva/revisao";
import { CasoCard } from "./caso-card";

/**
 * A fila. Card resolvido some da tela na hora, sem recarregar — porque quem
 * revisa cinco casos seguidos precisa ver o progresso, e um reload a cada
 * clique perde a posição da rolagem.
 */
export function Fila({ casos }: { casos: CasoRevisao[] }) {
  const [restantes, setRestantes] = useState(casos);
  const [resolvidos, setResolvidos] = useState(0);

  function remover(id: string) {
    setRestantes((atual) => atual.filter((c) => c.id !== id));
    setResolvidos((n) => n + 1);
  }

  if (restantes.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-medium text-emerald-900">
          Nenhum caso aguardando revisão
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          {resolvidos > 0
            ? `${resolvidos} caso${resolvidos > 1 ? "s" : ""} resolvido${resolvidos > 1 ? "s" : ""} agora. Você não precisa fazer mais nada.`
            : "Você não precisa fazer nada agora."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        {restantes.length} caso{restantes.length > 1 ? "s" : ""} aguardando
        {resolvidos > 0 ? ` · ${resolvidos} resolvido${resolvidos > 1 ? "s" : ""}` : ""}
      </p>
      {restantes.map((caso) => (
        <CasoCard key={caso.id} caso={caso} onResolvido={remover} />
      ))}
    </div>
  );
}
