"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { enviarMensagem } from "../actions";

export function ContinuarForm({
  conversaId,
  membroAtipicoId,
}: {
  conversaId: string;
  membroAtipicoId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await enviarMensagem({ conversaId, membroAtipicoId, texto });
        setTexto("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Continue a conversa..."
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        disabled={pending}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !texto.trim()}>
          {pending ? "Pensando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
