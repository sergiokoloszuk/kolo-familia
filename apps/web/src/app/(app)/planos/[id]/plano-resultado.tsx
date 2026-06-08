"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { registrarResultadoPlano } from "../actions";

type Resultado = "funcionou" | "parcial" | "nao_funcionou" | "nao_testou";

const OPCOES: { valor: Resultado; label: string }[] = [
  { valor: "funcionou", label: "Funcionou" },
  { valor: "parcial", label: "Mais ou menos" },
  { valor: "nao_funcionou", label: "Não funcionou" },
  { valor: "nao_testou", label: "Ainda não testei" },
];

const RESUMO: Record<Resultado, string> = {
  funcionou: "Você marcou que funcionou",
  parcial: "Você marcou que funcionou mais ou menos",
  nao_funcionou: "Você marcou que não funcionou",
  nao_testou: "Você marcou que ainda não testou",
};

/**
 * "Você testou? Como foi?" (Fase 4). Captura confiável do que funcionou —
 * a Kolo usa isso pra melhorar os próximos planos da criança.
 */
export function PlanoResultado({
  planoId,
  resultado,
  nota,
}: {
  planoId: string;
  resultado: Resultado | null;
  nota: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(resultado == null);
  const [sel, setSel] = useState<Resultado | null>(resultado);
  const [texto, setTexto] = useState(nota ?? "");

  function salvar() {
    if (!sel || pending) return;
    setErro(null);
    start(async () => {
      const r = await registrarResultadoPlano({ planoId, resultado: sel, nota: texto });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando && resultado) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 print:hidden">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <Check className="size-4" aria-hidden />
          {RESUMO[resultado]}.
        </span>
        {nota && <span className="text-sm text-muted-foreground">“{nota}”</span>}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-sm font-semibold text-brand-purple underline underline-offset-2 hover:text-brand-purple-dark"
        >
          Mudar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 p-4 print:hidden">
      <p className="font-heading text-base font-medium text-foreground">
        Você testou? Como foi?
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Me conta — assim eu aprendo o que funciona pra sua família e deixo os
        próximos planos cada vez mais certeiros.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setSel(o.valor)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              sel === o.valor
                ? "border-brand-purple bg-brand-purple text-white"
                : "border-input bg-white text-foreground hover:border-brand-purple/40",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Se quiser, conte o que mudou — o que ajudou, o que não rolou… (opcional)"
        className="mt-3 w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
      />
      {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      <button
        type="button"
        onClick={salvar}
        disabled={!sel || pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-purple-dark disabled:opacity-50"
      >
        {pending ? (
          <>
            <RefreshCw className="size-4 animate-spin" aria-hidden />
            Salvando...
          </>
        ) : (
          "Salvar"
        )}
      </button>
    </div>
  );
}
