"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { togglePessoaAtiva, type ActionResult } from "./actions";

export function TogglePessoa({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setErro(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {erro && <span className="text-xs text-destructive">{erro}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (ativo && !confirm("Desativar essa pessoa?")) return;
          run(() => togglePessoaAtiva(id, !ativo));
        }}
        disabled={pending}
      >
        {ativo ? "Desativar" : "Reativar"}
      </Button>
    </div>
  );
}
