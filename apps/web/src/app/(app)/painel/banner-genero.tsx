"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { salvarGeneroMembro } from "./genero-actions";

type Genero = "masculino" | "feminino" | "neutro";

const OPCOES: { value: Genero; label: string; sub: string }[] = [
  { value: "masculino", label: "Menino", sub: "ele / dele" },
  { value: "feminino", label: "Menina", sub: "ela / dela" },
  { value: "neutro", label: "Prefiro não dizer", sub: "vou usar o nome" },
];

/**
 * Banner que aparece no painel pra membros sem `genero` definido. Pergunta
 * uma vez, com 3 chips, e some quando responde.
 */
export function BannerGenero({
  membroId,
  nomeMembro,
}: {
  membroId: string;
  nomeMembro: string;
}) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<Genero | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar(g: Genero) {
    setErro(null);
    setEscolha(g);
    start(async () => {
      const r = await salvarGeneroMembro({ membroId, genero: g });
      if (!r.ok) {
        setErro(r.error);
        setEscolha(null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-purple/15 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(46,10,82,0.04)] md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow/20 text-brand-purple">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-heading text-base text-foreground">
            Como vocês chamam {nomeMembro}?
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ajuda a Ayla a falar do jeito certo nas mensagens.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {OPCOES.map((op) => {
            const ativa = escolha === op.value;
            return (
              <button
                key={op.value}
                type="button"
                onClick={() => salvar(op.value)}
                disabled={pending}
                className={`flex flex-col items-start gap-0 rounded-full border px-3.5 py-1.5 text-left transition-colors disabled:opacity-50 ${
                  ativa
                    ? "border-brand-purple bg-brand-purple/5"
                    : "border-input bg-white hover:border-brand-purple/40"
                }`}
              >
                <span className="text-sm font-medium text-foreground">
                  {op.label}
                </span>
                <span className="text-[10px] text-muted-foreground">{op.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
      {erro && (
        <p className="mt-3 text-xs text-destructive">{erro}</p>
      )}
    </section>
  );
}
