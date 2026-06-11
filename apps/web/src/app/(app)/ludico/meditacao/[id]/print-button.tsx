"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
    >
      <Printer className="size-3.5" aria-hidden /> Imprimir
    </button>
  );
}
