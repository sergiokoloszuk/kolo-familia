"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { bootstrapAdmin } from "./actions";

export function BootstrapButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await bootstrapAdmin();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <Button type="button" onClick={handleClick} disabled={pending}>
        {pending ? "Configurando..." : "Tornar-me admin (primeiro acesso)"}
      </Button>
    </div>
  );
}
