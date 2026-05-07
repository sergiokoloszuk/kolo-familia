"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { changeAulaStatus, deleteAula } from "../actions";

export function AulaStatusActions({
  id,
  statusAtual,
}: {
  id: string;
  statusAtual: string;
}) {
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function transicionar(novoStatus: "rascunho" | "ativo" | "arquivado") {
    setAviso(null);
    setErro(null);
    startTransition(async () => {
      try {
        const r = await changeAulaStatus({ id, novoStatus });
        if (r.inseridas !== undefined && r.inseridas > 0) {
          setAviso(
            `Aula publicada. A IA extraiu ${r.inseridas} candidata${r.inseridas === 1 ? "" : "s"} de Boa Prática para revisão.`,
          );
        } else if (r.avisoExtracao) {
          setAviso(r.avisoExtracao);
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function apagar() {
    if (!confirm("Apagar esta aula? Boas Práticas vinculadas perdem o link mas não são apagadas."))
      return;
    setErro(null);
    startTransition(async () => {
      try {
        await deleteAula(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {aviso && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{aviso}</div>
      )}
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {statusAtual !== "ativo" && (
          <Button type="button" onClick={() => transicionar("ativo")} disabled={pending}>
            {pending ? "Publicando..." : "Publicar (ativo)"}
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
        <Button type="button" variant="destructive" onClick={apagar} disabled={pending}>
          Apagar
        </Button>
      </div>
    </div>
  );
}
