"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleVetoAtivo, deleteVeto, type ActionResult } from "./actions";

export function VetoRow({
  id,
  ativo,
  origem,
}: {
  id: string;
  ativo: boolean;
  origem: string;
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
    <div className="flex flex-wrap items-center gap-2">
      {erro && <span className="text-xs text-destructive">{erro}</span>}
      {ativo ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run(() => toggleVetoAtivo(id, false))}
          disabled={pending}
        >
          Desativar
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run(() => toggleVetoAtivo(id, true))}
          disabled={pending}
        >
          Reativar
        </Button>
      )}
      {origem === "admin" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!confirm("Remover este veto permanentemente?")) return;
            run(() => deleteVeto(id));
          }}
          disabled={pending}
        >
          Remover
        </Button>
      )}
    </div>
  );
}
