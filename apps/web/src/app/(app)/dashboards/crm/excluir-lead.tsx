"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { excluirLead } from "./actions";

/** Botão Excluir com motivo (ex.: "é teste"). O motivo fica guardado. */
export function ExcluirLead({ familyId }: { familyId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirmar() {
    setErro(null);
    start(async () => {
      const r = await excluirLead({ familyId, motivo: motivo.trim() });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-full border border-foreground/20 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05]"
      >
        Excluir
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        autoFocus
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Por quê? (ex.: é teste do João)"
        className="w-56 rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none"
      />
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={pending || motivo.trim().length < 2}
          className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Excluindo…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-full border border-foreground/20 px-3 py-1 text-xs text-muted-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
