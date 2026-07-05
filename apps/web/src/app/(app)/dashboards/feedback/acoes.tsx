"use client";

import { useState, useTransition } from "react";
import { atualizarStatusFeedback } from "./actions";

type Status = "nova" | "respondida" | "implementar" | "arquivada";

export function FeedbackAcoes({ id, status }: { id: string; status: Status }) {
  const [st, setSt] = useState<Status>(status);
  const [pending, start] = useTransition();

  function mudar(novo: Status) {
    start(async () => {
      const r = await atualizarStatusFeedback({ id, status: novo });
      if (r.ok) setSt(novo);
    });
  }

  const btn = "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {st === "implementar" && (
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
          ✓ Pra implementar
        </span>
      )}
      {st === "arquivada" && (
        <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs text-muted-foreground">
          Arquivada
        </span>
      )}
      {st !== "implementar" && st !== "arquivada" && (
        <button
          type="button"
          onClick={() => mudar("implementar")}
          disabled={pending}
          className={`${btn} border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10`}
        >
          Marcar p/ implementar
        </button>
      )}
      {st !== "arquivada" ? (
        <button
          type="button"
          onClick={() => mudar("arquivada")}
          disabled={pending}
          className={`${btn} border-foreground/20 text-muted-foreground hover:bg-foreground/[0.05]`}
        >
          Arquivar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => mudar("nova")}
          disabled={pending}
          className={`${btn} border-foreground/20 text-muted-foreground hover:bg-foreground/[0.05]`}
        >
          Reabrir
        </button>
      )}
    </div>
  );
}
