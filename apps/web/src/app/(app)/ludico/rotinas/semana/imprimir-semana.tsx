"use client";

import { Printer } from "lucide-react";

/** Abre a impressão do navegador — o CSS print da página deixa só o calendário. */
export function ImprimirSemana() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-brand-purple/30 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5 print:hidden"
    >
      <Printer className="size-4" aria-hidden /> Imprimir a semana
    </button>
  );
}
