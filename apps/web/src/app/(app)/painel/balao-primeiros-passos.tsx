"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Compass, BookHeart, MessageSquareText, X } from "lucide-react";
import { marcarBalaoPrimeirosPassosVisto } from "./balao-actions";

/**
 * Balão one-shot que aparece no primeiro acesso ao painel. Convida pra
 * Kolo Vivo (alimentar informações) ou Estratégias (procurar orientação).
 * Após fechar ou clicar num dos destinos, marca visto e some pra sempre.
 */
export function BalaoPrimeirosPassos() {
  const [pending, start] = useTransition();

  function marcar(then?: () => void) {
    start(async () => {
      await marcarBalaoPrimeirosPassosVisto();
      then?.();
    });
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-brand-purple/15 bg-white px-6 py-7 shadow-[0_2px_6px_rgba(46,10,82,0.05),_0_18px_38px_rgba(46,10,82,0.06)] md:px-8 md:py-8"
    >
      {/* fundo atmosférico — radial leve roxo-amarelo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 92% 6%, rgba(255,186,0,0.16) 0%, transparent 45%), radial-gradient(circle at 6% 92%, rgba(107,31,168,0.06) 0%, transparent 50%)",
        }}
      />

      <button
        type="button"
        aria-label="Fechar"
        onClick={() => marcar()}
        disabled={pending}
        className="absolute right-4 top-4 z-10 grid size-7 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="relative">
        <div className="inline-flex items-center gap-2.5">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand-purple/10 text-brand-purple">
            <Compass className="size-3.5" aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Os primeiros passos
          </span>
        </div>

        <p className="mt-3.5 max-w-2xl text-[15px] leading-relaxed text-foreground">
          Duas portas pra começar: contar mais sobre {""}
          <strong className="font-semibold">quem você cuida</strong> — quanto
          mais a gente sabe, mais as orientações ganham a cara dele — ou já{" "}
          <strong className="font-semibold">pedir uma estratégia</strong>{" "}
          pra alguma situação que está pesando agora.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/kolo-vivo"
            onClick={() => marcar()}
            className="group flex items-start gap-3 rounded-2xl border border-kolo-linha bg-white px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 hover:shadow-sm"
          >
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <BookHeart className="size-4" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="font-heading text-base text-foreground">
                Alimentar o Kolo Vivo
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Conte mais sobre seu filho — sensorial, foco, rotina, o que ajuda.
              </p>
            </div>
          </Link>

          <Link
            href="/estrategias"
            onClick={() => marcar()}
            className="group flex items-start gap-3 rounded-2xl border border-kolo-linha bg-white px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 hover:shadow-sm"
          >
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <MessageSquareText className="size-4" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="font-heading text-base text-foreground">
                Pedir uma estratégia
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Conta o que está acontecendo e a Kolo devolve um caminho prático.
              </p>
            </div>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => marcar()}
          disabled={pending}
          className="mt-5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        >
          {pending ? "fechando…" : "agora não"}
        </button>
      </div>
    </section>
  );
}
