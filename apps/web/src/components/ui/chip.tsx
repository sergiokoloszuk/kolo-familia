"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chip de toque pra seleção (substitui dropdowns no onboarding).
 * Alvo ≥44px; selecionado se distingue por COR e FORMA (preenchido + check),
 * não só por cor — acessível e claro no toque.
 */
export function Chip({
  selected,
  onClick,
  disabled,
  multiSelect,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** true = seleção múltipla (semântica de checkbox em vez de radio). */
  multiSelect?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={multiSelect ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-brand-purple bg-brand-purple text-white shadow-sm"
          : "border-input bg-background text-foreground hover:border-brand-purple/40",
      )}
    >
      {selected && <Check className="size-4 shrink-0 text-brand-yellow" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Agrupa chips pra leitores de tela (radiogroup p/ escolha única, group p/ múltipla). */
export function ChipGroup({
  label,
  multiSelect,
  children,
}: {
  label: string;
  multiSelect?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role={multiSelect ? "group" : "radiogroup"}
      aria-label={label}
      className="flex flex-wrap gap-2"
    >
      {children}
    </div>
  );
}
