"use client";

import { useState, useTransition } from "react";
import { salvarFaseScript } from "../actions";

export function ConfigForm({
  fase,
  label,
  textoAyla,
  textoSugestao,
}: {
  fase: string;
  label: string;
  textoAyla: string;
  textoSugestao: string;
}) {
  const [ayla, setAyla] = useState(textoAyla);
  const [sug, setSug] = useState(textoSugestao);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar() {
    setErro(null);
    setOk(false);
    start(async () => {
      const r = await salvarFaseScript({ fase, textoAyla: ayla, textoSugestao: sug });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(true);
    });
  }

  const ta = "w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none";

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
      <h3 className="mb-3 font-heading text-base text-foreground">{label}</h3>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            🤖 O que a Ayla faz (referência)
          </label>
          <textarea
            rows={2}
            value={ayla}
            onChange={(e) => {
              setAyla(e.target.value);
              setOk(false);
            }}
            className={ta}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            🙋‍♀️ Sugestão da SUA abordagem (alimenta o copiloto)
          </label>
          <textarea
            rows={3}
            value={sug}
            onChange={(e) => {
              setSug(e.target.value);
              setOk(false);
            }}
            className={ta}
          />
        </div>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="rounded-full bg-brand-purple px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
          {ok && <span className="text-sm text-emerald-600">✓ Salvo</span>}
        </div>
      </div>
    </div>
  );
}
