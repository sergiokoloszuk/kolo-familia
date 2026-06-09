"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";

/**
 * Tela "montando seu plano…" enquanto a geração roda em segundo plano.
 * Re-busca o server component a cada 3s (router.refresh, não-bloqueante);
 * quando as seções chegam, a página troca pra o plano e este componente
 * desmonta. Se passar do teto (~3,5 min), mostra um aviso gentil com saídas.
 */
export function PlanoMontando({ crianca }: { crianca: string | null }) {
  const router = useRouter();
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => router.refresh(), 3000);
    const teto = setTimeout(() => {
      setDemorou(true);
      clearInterval(intervalo);
    }, 210_000); // 3,5 min
    return () => {
      clearInterval(intervalo);
      clearTimeout(teto);
    };
  }, [router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-brand-yellow/25 text-brand-purple"
      >
        {demorou ? <Sparkles className="size-7" /> : <RefreshCw className="size-7 animate-spin" />}
      </span>

      {demorou ? (
        <>
          <h1 className="font-heading text-2xl text-foreground">
            Está demorando mais que o normal
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Pode ser que a geração tenha tido um soluço. Recarregue esta página em
            instantes — se não aparecer, volte às Estratégias e peça o plano de novo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-purple-dark"
            >
              Recarregar
            </button>
            <Link
              href="/estrategias"
              className="text-sm font-semibold text-brand-purple underline-offset-2 hover:underline"
            >
              Voltar às Estratégias
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl text-foreground">
            Montando {crianca ? `o plano de ${crianca}` : "seu plano"}…
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Estou organizando tudo num plano só — ideias práticas, frases pra usar e o
            que observar. Leva cerca de um minuto. Pode deixar aberto que ele aparece
            aqui sozinho. 🌿
          </p>
        </>
      )}
    </div>
  );
}
