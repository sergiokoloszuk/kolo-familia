"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarRotina } from "./actions";

export function NovaRotina({
  membros,
  ativaId,
}: {
  membros: Array<{ id: string; nome: string }>;
  ativaId?: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [membroId, setMembroId] = useState(
    membros.find((m) => m.id === ativaId)?.id ?? membros[0]?.id ?? "",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function criar() {
    const n = nome.trim();
    if (!n || !membroId || pending) return;
    setErro(null);
    start(async () => {
      const r = await criarRotina({ membroAtipicoId: membroId, nome: n });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/ludico/rotinas/${r.rotinaId}`);
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group flex w-full items-center justify-between gap-4 rounded-3xl border-2 border-foreground/[0.09] bg-white px-6 py-7 text-left transition-colors hover:border-brand-purple/40"
      >
        <span className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-cat-foco-soft text-cat-foco">
            <Plus className="size-6" aria-hidden />
          </span>
          <span>
            <span className="block font-heading text-xl font-medium text-foreground md:text-2xl">Rotina de um dia</span>
            <span className="mt-1 block text-sm text-muted-foreground md:text-base">
              Um dia do seu jeito: dia do dentista, dia do parque, manhã tranquila…
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-brand-purple/40 px-5 py-2.5 text-sm font-semibold text-brand-purple transition-colors group-hover:bg-brand-purple/5">
          Criar +
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4">
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {membros.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rot-membro" className="text-sm font-medium text-foreground">
            Pra quem
          </label>
          <select
            id="rot-membro"
            value={membroId}
            onChange={(e) => setMembroId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da rotina (ex.: Dia do dentista, Dia do parque, Manhã)"
        onKeyDown={(e) => e.key === "Enter" && criar()}
        disabled={pending}
      />
      <div className="flex items-center gap-2">
        <Button type="button" onClick={criar} disabled={pending || !nome.trim()}>
          {pending ? "Criando..." : "Criar rotina"}
        </Button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={pending}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
