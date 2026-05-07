"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { changeBPStatus } from "../actions";

export function BPStatusActions({
  id,
  statusAtual,
}: {
  id: string;
  statusAtual: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function transicionar(novoStatus: "rascunho" | "ativo" | "arquivado") {
    setErro(null);
    startTransition(async () => {
      try {
        await changeBPStatus({ id, novoStatus });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {statusAtual !== "ativo" && (
          <Button type="button" onClick={() => transicionar("ativo")} disabled={pending}>
            {pending ? "..." : "Aprovar (ativa)"}
          </Button>
        )}
        {statusAtual !== "rascunho" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => transicionar("rascunho")}
            disabled={pending}
          >
            Voltar pra rascunho
          </Button>
        )}
        {statusAtual !== "arquivado" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => transicionar("arquivado")}
            disabled={pending}
          >
            Arquivar
          </Button>
        )}
      </div>
    </div>
  );
}
