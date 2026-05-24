"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enviarMensagem } from "../actions";

/**
 * Continuação de conversa — textarea inline. Enter envia (Shift+Enter
 * pula linha).
 */
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

  function submit() {
    if (!texto.trim() || pending) return;
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Continuar conversando..."
        disabled={pending}
        className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
          Enter envia · Shift+Enter pula linha
        </span>
        <Button type="submit" size="lg" disabled={pending || !texto.trim()}>
          {pending ? "Pensando..." : "Continuar"}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
