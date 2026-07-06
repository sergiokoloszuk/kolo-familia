"use client";

import { useState, useTransition } from "react";
import { salvarCadencia } from "../actions";

export function CadenciaForm({
  situacao,
  label,
  diretriz,
  ativo,
}: {
  situacao: string;
  label: string;
  diretriz: string;
  ativo: boolean;
}) {
  const [texto, setTexto] = useState(diretriz);
  const [on, setOn] = useState(ativo);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar(novoAtivo?: boolean) {
    const at = novoAtivo ?? on;
    setErro(null);
    setOk(false);
    start(async () => {
      const r = await salvarCadencia({ situacao, diretriz: texto, ativo: at });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOn(at);
      setOk(true);
    });
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-heading text-base text-foreground">{label}</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => salvar(e.target.checked)}
            disabled={pending}
          />
          {on ? "ligada" : "desligada"}
        </label>
      </div>
      <textarea
        rows={2}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setOk(false);
        }}
        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
      />
      {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => salvar()}
          disabled={pending}
          className="rounded-full bg-brand-purple px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {ok && <span className="text-sm text-emerald-600">✓ Salvo</span>}
      </div>
    </div>
  );
}
