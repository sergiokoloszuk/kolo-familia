"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { excluirMeditacao } from "../actions";

export function ExcluirMeditacao({ meditacaoId }: { meditacaoId: string }) {
  const router = useRouter();
  const [confirma, setConfirma] = useState(false);
  const [pending, start] = useTransition();

  if (!confirma) {
    return (
      <button
        type="button"
        onClick={() => setConfirma(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive print:hidden"
      >
        <Trash2 className="size-4" aria-hidden /> Excluir
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-3 text-sm print:hidden">
      <span className="text-muted-foreground">Excluir esta meditação?</span>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const r = await excluirMeditacao({ meditacaoId });
            if (r.ok) router.push("/ludico/meditacao");
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1.5 font-semibold text-destructive hover:underline disabled:opacity-50"
      >
        {pending && <RefreshCw className="size-3.5 animate-spin" aria-hidden />}
        Sim, excluir
      </button>
      <button
        type="button"
        onClick={() => setConfirma(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        Não
      </button>
    </span>
  );
}
