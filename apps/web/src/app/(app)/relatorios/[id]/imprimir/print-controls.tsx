"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintControls() {
  return (
    <div className="no-print mb-6 flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3 text-sm">
      <span>Use o botão pra abrir o diálogo de impressão. Salvar como PDF é uma opção do navegador.</span>
      <Button type="button" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" className="size-3.5" /> Imprimir
      </Button>
    </div>
  );
}
