"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { criarHistoria } from "../actions";

const EXEMPLOS = [
  "Preparar para a primeira ida ao dentista",
  "Ensaiar a hora do banho depois da TV, sem crise",
  "Celebrar que comeu um alimento novo",
  "Antecipar o almoço de domingo na casa da vó",
];

export function CriarHistoriaForm({
  criancas,
}: {
  criancas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [membroId, setMembroId] = useState(criancas[0]?.id ?? "");
  const [descricao, setDescricao] = useState("");
  const [nPaginas, setNPaginas] = useState(5);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function criar() {
    if (!descricao.trim() || pending) return;
    setErro(null);
    start(async () => {
      const r = await criarHistoria({ membroId, descricao, nPaginas });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/historias/${r.id}`);
    });
  }

  if (pending) {
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep to-brand-purple-dark px-8 py-16 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 18% 26%, rgba(255,255,255,.55) 50%, transparent), radial-gradient(1.5px 1.5px at 82% 20%, rgba(255,186,0,.7) 50%, transparent), radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,.5) 50%, transparent), radial-gradient(1px 1px at 28% 82%, rgba(255,186,0,.5) 50%, transparent)",
          }}
        />
        <span className="relative flex size-24 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border-2 border-dashed border-brand-yellow/50 animate-[spin_10s_linear_infinite]"
          />
          <Wand2 className="size-10 text-brand-yellow" />
        </span>
        <h2 className="relative font-heading text-2xl">A Kolo está ilustrando…</h2>
        <p className="relative max-w-sm text-sm text-white/75">
          Escrevendo a história e desenhando cada página com o mesmo personagem.
          Leva cerca de um minuto — pode deixar aberto.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-kolo-linha bg-white p-5">
      {criancas.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="crianca">Pra qual criança</Label>
          <select
            id="crianca"
            value={membroId}
            onChange={(e) => setMembroId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {criancas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descricao">O que você quer contar?</Label>
        <textarea
          id="descricao"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: uma história pra preparar o André para a consulta no dentista na semana que vem. Ele tem medo de barulho."
          className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-base leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescricao(ex)}
              className="rounded-full border border-foreground/10 bg-kolo-lilas-bg-2/50 px-3 py-1 text-xs text-muted-foreground hover:border-brand-purple/30 hover:text-brand-purple"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paginas">Quantas páginas</Label>
        <select
          id="paginas"
          value={nPaginas}
          onChange={(e) => setNPaginas(Number(e.target.value))}
          className="flex h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
        >
          {[3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} páginas
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div>
        <Button type="button" onClick={criar} disabled={!descricao.trim()}>
          <Sparkles className="size-4" aria-hidden />
          Criar história
        </Button>
      </div>
    </div>
  );
}
