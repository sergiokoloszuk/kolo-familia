"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { definirTemaSemana } from "./actions";

const SUGESTOES = ["Dinossauros", "Espaço", "Animais", "Fundo do mar", "Super-heróis", "Natureza", "Carros"];

/** Um tema pra a semana toda — aplicado a todos os dias ao gerar os cartões. */
export function TemaSemana({ membroId, temaAtual }: { membroId: string; temaAtual: string | null }) {
  const router = useRouter();
  const [tema, setTema] = useState(temaAtual ?? "");
  const [pending, start] = useTransition();
  const mudou = tema.trim() !== (temaAtual ?? "").trim();

  function aplicar() {
    if (!mudou || !tema.trim()) return;
    start(async () => {
      const r = await definirTemaSemana({ membroAtipicoId: membroId, tema: tema.trim() });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 p-4">
      <p className="text-sm font-semibold text-foreground">🎨 Tema da semana</p>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Um tema só, no interesse de quem vai usar — vale pros cartões de todos os dias.
      </p>
      <div className="flex gap-2">
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && aplicar()}
          placeholder="ex.: Dinossauros"
          className="flex-1 rounded-xl border border-kolo-linha bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
        />
        <button
          onClick={aplicar}
          disabled={!mudou || !tema.trim() || pending}
          className="rounded-full bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "aplicando…" : "Aplicar à semana"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => setTema(s)}
            className="rounded-full border border-kolo-linha bg-white px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand-purple/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      {mudou && tema.trim() && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ao aplicar, os cartões dos dias serão gerados de novo no tema novo.
        </p>
      )}
    </div>
  );
}
