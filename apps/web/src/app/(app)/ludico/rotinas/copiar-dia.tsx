"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copiarDiaRotina } from "./actions";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Copia a sequência deste dia pra outros dias da semana (substitui a deles). */
export function CopiarDia({ rotinaId, diaOrigem }: { rotinaId: string; diaOrigem: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<number[]>([]);
  const [pending, start] = useTransition();

  function copiar() {
    if (!sel.length) return;
    start(async () => {
      const r = await copiarDiaRotina({ rotinaId, paraDias: sel });
      if (r.ok) {
        setAberto(false);
        setSel([]);
        router.refresh();
      }
    });
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-full border border-kolo-linha bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-purple hover:text-brand-purple"
      >
        copiar pra outros dias
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-kolo-linha bg-white p-3">
      <p className="text-xs font-medium text-foreground">Copiar esta sequência pra:</p>
      <div className="flex flex-wrap gap-1.5">
        {DIAS.map((nome, dia) =>
          dia === diaOrigem ? null : (
            <button
              key={dia}
              onClick={() => setSel((s) => (s.includes(dia) ? s.filter((x) => x !== dia) : [...s, dia]))}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                sel.includes(dia)
                  ? "bg-brand-purple text-white"
                  : "border border-kolo-linha bg-white text-muted-foreground hover:border-brand-purple/40"
              }`}
            >
              {nome}
            </button>
          ),
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Substitui a sequência desses dias (os cartões deles serão gerados de novo).</p>
      <div className="flex items-center gap-2">
        <button
          disabled={pending || !sel.length}
          onClick={copiar}
          className="rounded-full bg-brand-purple px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "copiando…" : "Copiar"}
        </button>
        <button
          onClick={() => {
            setAberto(false);
            setSel([]);
          }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          cancelar
        </button>
      </div>
    </div>
  );
}
