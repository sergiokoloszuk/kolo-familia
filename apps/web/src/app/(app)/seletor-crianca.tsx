"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { selecionarCriancaAtiva } from "./crianca-actions";

type Crianca = { id: string; nome: string };

/**
 * Seletor de criança ativa — MESMO componente na sidebar e no topo das telas.
 * Troca o cookie (via selecionarCriancaAtiva) e dá refresh, então a plataforma
 * inteira passa a falar da criança escolhida. Com 1 filho, não aparece.
 *
 * `variant`:
 *  - "screen": pílula clara pro topo das páginas ("Sobre: Manu ▾").
 *  - "sidebar": card lavado, encaixa no menu lateral.
 */
export function SeletorCrianca({
  criancas,
  ativaId,
  variant = "screen",
}: {
  criancas: Crianca[];
  ativaId: string;
  variant?: "screen" | "sidebar";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (criancas.length <= 1) return null;
  const ativa = criancas.find((c) => c.id === ativaId) ?? criancas[0];

  function escolher(id: string) {
    setOpen(false);
    if (id === ativa.id) return;
    start(async () => {
      await selecionarCriancaAtiva(id);
      router.refresh();
    });
  }

  const isSidebar = variant === "sidebar";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-2xl transition-colors disabled:opacity-60",
          isSidebar
            ? "bg-kolo-lilas-bg-2/60 px-3 py-2.5 hover:bg-kolo-lilas-bg-2"
            : "border border-brand-purple/20 bg-white px-3 py-1.5 hover:border-brand-purple/40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark font-heading font-semibold text-brand-purple-dark",
            isSidebar ? "size-9 text-[15px]" : "size-6 text-xs",
          )}
        >
          {ativa.nome[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="min-w-0 flex-1 text-left">
          {!isSidebar && (
            <span className="mr-1 text-xs text-muted-foreground">Sobre:</span>
          )}
          <span className={cn("font-semibold text-foreground", isSidebar ? "text-sm" : "text-sm")}>
            {ativa.nome}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-1 w-full min-w-[180px] overflow-hidden rounded-xl border border-foreground/10 bg-white py-1 shadow-lg"
        >
          {criancas.map((c) => {
            const ativo = c.id === ativa.id;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={ativo}
                onClick={() => escolher(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-kolo-lilas-bg-2/60",
                  ativo ? "font-semibold text-brand-purple" : "text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark text-xs font-semibold text-brand-purple-dark"
                >
                  {c.nome[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="flex-1">{c.nome}</span>
                {ativo && <Check className="size-4 text-brand-purple" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
