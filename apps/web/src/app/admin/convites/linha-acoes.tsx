"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revogarConvite, reativarConvite } from "./actions";

export function ConviteAcoes({
  id,
  revogado,
}: {
  id: string;
  revogado: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {erro && <span className="text-xs text-destructive">{erro}</span>}
      {revogado ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run(() => reativarConvite(id))}
          disabled={pending}
        >
          Reativar
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (!confirm("Revogar este convite?")) return;
            run(() => revogarConvite(id));
          }}
          disabled={pending}
        >
          Revogar
        </Button>
      )}
    </div>
  );
}
