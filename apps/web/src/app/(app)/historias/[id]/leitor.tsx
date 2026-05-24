"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Pagina = {
  ordem: number;
  texto: string | null;
  fala: string | null;
  imagem_url: string | null;
};

export function LeitorHistoria({ paginas }: { paginas: Pagina[] }) {
  const [i, setI] = useState(0);
  if (paginas.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta história ainda não tem páginas.</p>;
  }
  const p = paginas[i];
  const primeira = i === 0;
  const ultima = i === paginas.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-3xl border border-kolo-linha bg-white shadow-sm">
        {p.imagem_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imagem_url}
            alt={`Página ${p.ordem}`}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-kolo-lilas-bg text-muted-foreground">
            (ilustração indisponível)
          </div>
        )}
        <div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
          {p.texto && (
            <p className="font-heading text-lg leading-relaxed text-foreground md:text-xl">
              {p.texto}
            </p>
          )}
          {p.fala && (
            <p className="rounded-2xl bg-brand-yellow/15 px-4 py-2 text-base italic text-brand-purple-dark">
              “{p.fala}”
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={primeira}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden /> Anterior
        </button>

        <div className="flex items-center gap-2">
          {paginas.map((pg, idx) => (
            <button
              key={pg.ordem}
              type="button"
              aria-label={`Página ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`size-2 rounded-full transition-all ${idx === i ? "scale-125 bg-brand-yellow" : "bg-foreground/15"}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setI((n) => Math.min(paginas.length - 1, n + 1))}
          disabled={ultima}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm disabled:opacity-40"
        >
          Próxima <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
