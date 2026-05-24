"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explicação discreta e recolhível "Como usar esta tela" — o que fazer + por
 * quê. Recolhida por padrão pra respeitar o tom editorial (não polui quem já
 * sabe). Padroniza a ajuda contextual em todas as telas.
 */
export function ComoUsar({
  oQueFazer,
  porQue,
}: {
  oQueFazer: string;
  porQue: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="-mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="size-3.5" aria-hidden />
        Como usar esta tela
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 flex max-w-2xl flex-col gap-2 rounded-xl border border-foreground/[0.06] bg-white/60 px-4 py-3 text-sm leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">O que fazer: </span>
            <span className="text-muted-foreground">{oQueFazer}</span>
          </p>
          <p>
            <span className="font-semibold text-foreground">Por quê: </span>
            <span className="text-muted-foreground">{porQue}</span>
          </p>
        </div>
      )}
    </div>
  );
}
