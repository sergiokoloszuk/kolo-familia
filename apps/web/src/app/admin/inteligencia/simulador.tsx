"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { simular, type ResultadoSimulacao, type VersaoParaTeste } from "./actions";

export function Simulador({
  familias,
  versoes,
}: {
  familias: Array<{ id: string; nome: string }>;
  versoes: VersaoParaTeste[];
}) {
  const [familia, setFamilia] = useState(familias[0]?.id ?? "");
  const [versaoId, setVersaoId] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [saida, setSaida] = useState<ResultadoSimulacao | null>(null);
  const [pendente, iniciar] = useTransition();

  const rotulo = (v: VersaoParaTeste) =>
    `v${v.versao} · ${v.status === "ativo" ? "no ar" : v.publicado_em ? "já esteve no ar" : "candidata"} · ${v.chars.toLocaleString("pt-BR")} car.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold">Família de QA</span>
          <select
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            className="min-w-52 rounded-md border bg-background px-3 py-2 text-sm"
          >
            {familias.length === 0 ? <option value="">nenhuma família no QA</option> : null}
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold">Core a testar</span>
          <select
            value={versaoId}
            onChange={(e) => setVersaoId(e.target.value)}
            className="min-w-72 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">o que está no ar (ou o Core do código)</option>
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                {rotulo(v)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="A mensagem que a mãe mandaria…"
        className="min-h-[90px] w-full rounded-md border bg-background p-3 text-sm"
      />

      <div>
        <Button
          disabled={pendente || !msg.trim() || !familia}
          onClick={() =>
            iniciar(async () => {
              setSaida(null);
              setSaida(await simular(familia, msg, versaoId || null));
            })
          }
        >
          {pendente ? "A Ayla está pensando…" : "Testar"}
        </Button>
      </div>

      {saida ? (
        saida.ok ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="whitespace-pre-wrap text-sm">{saida.texto}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <Metrica k="Core testado" v={saida.coreTestado} />
              <Metrica
                k="origem"
                v={`${saida.coreOrigem}${saida.coreVersao !== null ? ` v${saida.coreVersao}` : ""}`}
              />
              <Metrica k="foco" v={saida.foco} />
              <Metrica k="chamadas LLM" v={String(saida.llms)} />
              <Metrica k="consultas" v={String(saida.consultas)} />
              <Metrica k="tokens entrada" v={saida.tokensEntrada.toLocaleString("pt-BR")} />
              <Metrica k="tokens saída" v={saida.tokensSaida.toLocaleString("pt-BR")} />
              <Metrica k="contexto" v={`${saida.msContexto} ms`} />
              <Metrica k="modelo" v={`${(saida.msModelo / 1000).toFixed(1)} s`} />
              <Metrica k="ponta a ponta" v={`${(saida.msTotal / 1000).toFixed(1)} s`} />
            </dl>
          </div>
        ) : (
          <p className="text-sm text-red-700">{saida.error}</p>
        )
      ) : null}
    </div>
  );
}

function Metrica({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono font-semibold">{v}</dd>
    </div>
  );
}
