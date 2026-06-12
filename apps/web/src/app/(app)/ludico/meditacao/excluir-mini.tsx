"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { excluirMeditacao } from "./actions";

export function ExcluirMini({ meditacaoId }: { meditacaoId: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();

  function remover() {
    start(async () => {
      await excluirMeditacao({ meditacaoId });
      router.refresh();
    });
  }

  if (confirmar) {
    return (
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm">
        <button
          type="button"
          onClick={remover}
          disabled={pending}
          className="text-xs font-semibold text-destructive disabled:opacity-50"
        >
          {pending ? "Excluindo…" : "Excluir"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmar(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmar(true)}
      aria-label="Excluir meditação"
      className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-secondary/60 hover:text-destructive"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
