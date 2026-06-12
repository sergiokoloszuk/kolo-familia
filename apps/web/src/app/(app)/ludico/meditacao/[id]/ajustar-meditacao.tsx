"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ajustarMeditacaoExistente } from "../actions";

export function AjustarMeditacao({ meditacaoId }: { meditacaoId: string }) {
  const router = useRouter();
  const [pedido, setPedido] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ajustar() {
    const p = pedido.trim();
    if (!p || pending) return;
    setErro(null);
    start(async () => {
      const r = await ajustarMeditacaoExistente({ meditacaoId, pedido: p });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setPedido("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-brand-purple/15 bg-white p-4 print:hidden">
      <span className="text-sm font-medium text-foreground">
        Quer mudar algo? Peça pra Kolo ajustar
      </span>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ajustar();
          }}
          disabled={pending}
          placeholder="Ex.: mais curtinha · mais lenta pro sono · troca o dinossauro por um gato · menos respiração"
          className="h-10 flex-1 rounded-xl border border-foreground/[0.08] bg-white px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
        <Button type="button" onClick={ajustar} disabled={pending || !pedido.trim()}>
          {pending ? (
            <>
              <Sparkles className="size-4 animate-pulse" aria-hidden /> Ajustando…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden /> Ajustar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
