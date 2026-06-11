"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarRespostaCrianca } from "../actions";

const CARINHAS = [
  { emoji: "😊", label: "feliz" },
  { emoji: "😟", label: "preocupada" },
  { emoji: "😠", label: "brava" },
  { emoji: "😨", label: "com medo" },
  { emoji: "😐", label: "tranquila" },
];

export function RespostaCrianca({
  desenhoId,
  inicial,
}: {
  desenhoId: string;
  inicial: string | null;
}) {
  const [texto, setTexto] = useState(inicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, start] = useTransition();

  function addCarinha(label: string) {
    setTexto((t) => (t.trim() ? `${t.trim()} · apontou: ${label}` : `Apontou: ${label}`));
  }

  function salvar() {
    if (pending) return;
    setErro(null);
    setSalvo(false);
    start(async () => {
      const r = await salvarRespostaCrianca({ desenhoId, resposta: texto.trim() });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4">
      <p className="font-heading text-base font-medium text-foreground">
        O que a criança respondeu?
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Anote com as palavras dela. Se ela fala pouco, pode mostrar as carinhas e tocar na
        que ela apontou.
      </p>

      <div className="flex flex-wrap gap-2">
        {CARINHAS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => addCarinha(c.label)}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-sm transition-colors hover:border-brand-purple/30"
          >
            <span aria-hidden className="text-base">
              {c.emoji}
            </span>
            {c.label}
          </button>
        ))}
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: 'É a mamãe e eu na praia.' Disse que estavam felizes."
        className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={pending}>
          {salvo ? (
            <>
              <Check className="size-4" aria-hidden /> Guardado
            </>
          ) : pending ? (
            "Guardando…"
          ) : (
            "Guardar no diário"
          )}
        </Button>
      </div>
    </div>
  );
}
