"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apagarRelatorio } from "../actions";

export function ApagarRelatorioButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleApagar() {
    if (
      !confirm(
        "Apagar este relatório? Os dados base ficam, mas o snapshot e os links vivos ativos não serão recuperáveis.",
      )
    )
      return;
    setErro(null);
    startTransition(async () => {
      try {
        await apagarRelatorio(id);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {erro && (
        <p className="text-xs text-destructive">{erro}</p>
      )}
      <Button type="button" variant="destructive" size="sm" onClick={handleApagar} disabled={pending}>
        {pending ? "Apagando..." : "Apagar relatório"}
      </Button>
    </div>
  );
}
