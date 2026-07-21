"use client";

import { useState, useTransition } from "react";
import { bloquearAyla } from "./actions";

/** Bloqueia/desbloqueia a Ayla pra uma família (com confirmação pra bloquear). */
export function BloquearBtn({ familyId, bloqueada }: { familyId: string; bloqueada: boolean }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [conf, setConf] = useState(false);

  function acionar() {
    if (pending) return;
    if (!bloqueada && !conf) {
      setConf(true);
      return;
    }
    setErro(null);
    start(async () => {
      const r = await bloquearAyla(familyId, !bloqueada);
      if (!r.ok) setErro(r.error ?? "erro");
      setConf(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={acionar}
        disabled={pending}
        className={
          bloqueada
            ? "text-xs font-semibold text-emerald-600 hover:underline"
            : conf
              ? "text-xs font-bold text-destructive hover:underline"
              : "text-xs font-medium text-muted-foreground hover:text-destructive"
        }
      >
        {pending ? "…" : bloqueada ? "Desbloquear" : conf ? "Confirmar bloqueio" : "🚫 Bloquear Ayla"}
      </button>
      {erro && <span className="text-[10px] text-destructive">{erro}</span>}
    </span>
  );
}
