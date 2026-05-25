"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";

type Pagina = {
  ordem: number;
  texto: string | null;
  fala: string | null;
  imagem_url: string | null;
};

export function LeitorHistoria({
  titulo,
  capaUrl,
  paginas,
}: {
  titulo: string;
  capaUrl: string | null;
  paginas: Pagina[];
}) {
  // Slide 0 = capa; slides 1..N = páginas.
  const totalSlides = paginas.length + 1;
  const [i, setI] = useState(0);
  if (paginas.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta história ainda não tem páginas.</p>;
  }
  const naCapa = i === 0;
  const pagina = naCapa ? null : paginas[i - 1];

  return (
    <div className="flex flex-col gap-5">
      {/* Moldura de livro: fundo creme + página branca com sombra de livro */}
      <div className="rounded-[28px] bg-kolo-lilas-bg-2/50 p-3 sm:p-5">
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(46,10,82,0.06),0_18px_40px_rgba(46,10,82,0.14)]">
          {/* "lombada" sutil à esquerda */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-2 bg-gradient-to-r from-black/15 to-transparent"
          />

          {naCapa ? (
            <div className="relative">
              {capaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capaUrl} alt={titulo} className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-brand-purple-deep to-brand-purple text-white/50">
                  <BookOpen className="size-10" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-6 pt-16">
                <h2 className="font-heading text-2xl leading-tight text-white drop-shadow-lg md:text-3xl">
                  {titulo}
                </h2>
                <p className="mt-1 text-sm text-white/80">{paginas.length} páginas · toque em “Próxima”</p>
              </div>
            </div>
          ) : (
            <>
              <span className="absolute right-4 top-3 z-10 font-heading text-xs italic text-muted-foreground">
                {pagina!.ordem} de {paginas.length}
              </span>
              {pagina!.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pagina!.imagem_url}
                  alt={`Página ${pagina!.ordem}`}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-kolo-lilas-bg text-muted-foreground">
                  (ilustração indisponível)
                </div>
              )}
              <div className="flex flex-col items-center gap-4 px-6 py-7 text-center sm:px-10">
                {pagina!.texto && (
                  <p className="font-heading text-lg leading-relaxed text-foreground md:text-xl">
                    {pagina!.texto}
                  </p>
                )}
                {pagina!.fala && (
                  <p className="relative mt-1 inline-block rounded-2xl bg-[#FFF4D6] px-5 py-2.5 text-base italic text-brand-purple-dark after:absolute after:left-10 after:top-full after:-translate-y-px after:border-[9px] after:border-transparent after:border-t-[#FFF4D6] after:content-['']">
                    “{pagina!.fala}”
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition-transform hover:-translate-x-0.5 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden /> {i === 1 ? "Capa" : "Anterior"}
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={idx === 0 ? "Capa" : `Página ${idx}`}
              onClick={() => setI(idx)}
              className={`size-2 rounded-full transition-all ${
                idx === i
                  ? "scale-[1.6] bg-brand-yellow shadow-[0_0_0_3px_rgba(255,186,0,0.25)]"
                  : "bg-foreground/15 hover:bg-foreground/30"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setI((n) => Math.min(totalSlides - 1, n + 1))}
          disabled={i === totalSlides - 1}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition-transform hover:translate-x-0.5 disabled:opacity-40"
        >
          {i === 0 ? "Começar" : "Próxima"} <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
