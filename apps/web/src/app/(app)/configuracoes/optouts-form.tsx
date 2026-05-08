"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { alterarOptOut } from "./actions";

const CATEGORIAS = [
  {
    key: "informacional",
    label: "Informativos",
    descricao: "Avisos sobre novas aulas, atualizações do app.",
  },
  {
    key: "promocional",
    label: "Promocionais",
    descricao: "Descontos e ofertas (plano anual, cupons).",
  },
  {
    key: "avaliacao",
    label: "Avaliação / NPS",
    descricao: "Pesquisas curtas sobre sua experiência.",
  },
] as const;

export function OptOutsForm({ optoutSet }: { optoutSet: string[] }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [optouts, setOptouts] = useState(new Set(optoutSet));

  function alternar(categoria: "informacional" | "promocional" | "avaliacao") {
    const optar_out = !optouts.has(categoria);
    setErro(null);
    // Atualização otimista
    const next = new Set(optouts);
    if (optar_out) next.add(categoria);
    else next.delete(categoria);
    setOptouts(next);

    startTransition(async () => {
      try {
        await alterarOptOut({ categoria, optar_out });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
        // Reverte
        setOptouts(optouts);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {CATEGORIAS.map((c) => {
          const aceitar = !optouts.has(c.key);
          return (
            <li key={c.key} className="rounded-md border p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={aceitar}
                  disabled={pending}
                  onChange={() => alternar(c.key)}
                />
                <div className="flex-1">
                  <Label className="font-medium">Aceitar {c.label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
