"use client";

import { useState, useTransition } from "react";
import { simularDemonstracao } from "./actions";

type Mensagem = { papel: "pessoa" | "ayla"; texto: string };

export function SimuladorDemo() {
  const [historico, setHistorico] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [usarRascunho, setUsarRascunho] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar() {
    const t = texto.trim();
    if (!t || pendente) return;
    setAviso(null);
    iniciar(async () => {
      const r = await simularDemonstracao({ historico, texto: t, usarRascunho });
      if (!r.ok) {
        setAviso(
          r.motivo === "sem_documento"
            ? "Não há documento “Demonstração (landing)” em /admin/documentos — nem rascunho nem ativo."
            : "O modelo não respondeu agora. Tente de novo.",
        );
        return;
      }
      setHistorico((h) => [...h, { papel: "pessoa", texto: t }, { papel: "ayla", texto: r.resposta }]);
      setTexto("");
      setAviso(`Condução usada: ${r.origem === "rascunho" ? "rascunho" : "versão ativa"}${r.versao ? ` v${r.versao}` : ""}.`);
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={usarRascunho} onChange={(e) => setUsarRascunho(e.target.checked)} />
        Usar o rascunho do documento, se houver (desmarque para testar a versão ativa)
      </label>

      <div className="space-y-3 rounded-2xl border bg-white p-4">
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Escreva como uma mãe escreveria na landing.</p>
        ) : (
          historico.map((m, i) => (
            <div
              key={i}
              className={
                m.papel === "pessoa"
                  ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-brand-purple/10 px-4 py-2 text-sm"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2 text-sm"
              }
            >
              {m.texto}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={1500}
          className="min-w-0 flex-1 rounded-xl border px-4 py-2 text-sm"
          placeholder="Mensagem da visitante"
        />
        <div className="flex gap-2 sm:flex-col">
          <button
            onClick={enviar}
            disabled={pendente || !texto.trim()}
            className="rounded-full bg-brand-purple px-5 py-2 font-semibold text-white disabled:opacity-40"
          >
            {pendente ? "Ayla escrevendo…" : "Enviar"}
          </button>
          <button
            onClick={() => {
              setHistorico([]);
              setAviso(null);
            }}
            className="rounded-full border px-5 py-2 text-sm"
          >
            Recomeçar
          </button>
        </div>
      </div>
      {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
    </div>
  );
}
