"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarRotinaDia } from "./actions";

/** Cria a rotina de um dia da semana e abre o editor dela. */
export function CriarDia({ membroId, diaSemana }: { membroId: string; diaSemana: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await criarRotinaDia({ membroAtipicoId: membroId, diaSemana });
          if (r.ok) router.push(`/ludico/rotinas/${r.rotinaId}`);
        })
      }
      className="rounded-full border border-dashed border-kolo-linha px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-brand-purple hover:text-brand-purple disabled:opacity-50"
    >
      {pending ? "criando…" : "+ montar este dia"}
    </button>
  );
}
