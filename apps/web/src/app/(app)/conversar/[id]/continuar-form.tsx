"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { enviarMensagem } from "../actions";

/**
 * Continuação de conversa — textarea editorial inline (P-EST-6).
 * Sem Label, sem Card wrapper, sem caixa dura. Placeholder editorial
 * e botão "Continuar →" em vez de "Enviar".
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
        placeholder="Continuar conversando..."
        disabled={pending}
        className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending || !texto.trim()}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-brand-purple hover:bg-transparent hover:text-brand-purple-dark",
          )}
        >
          {pending ? "Pensando..." : "Continuar"}
          {!pending && <ArrowRight className="size-3" aria-hidden />}
        </Button>
      </div>
    </form>
  );
}
