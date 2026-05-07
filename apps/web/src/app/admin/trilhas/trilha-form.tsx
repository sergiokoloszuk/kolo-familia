"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTrilha, deleteTrilha, type SaveTrilhaInput } from "./actions";

export type TrilhaInicial = {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  ordem?: number;
  tags?: string[];
  perfis_aplicaveis?: string[];
  ativo?: boolean;
};

export function TrilhaForm({
  inicial,
  permitirApagar = false,
}: {
  inicial: TrilhaInicial;
  permitirApagar?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SaveTrilhaInput>({
    id: inicial.id,
    titulo: inicial.titulo ?? "",
    descricao: inicial.descricao ?? "",
    ordem: inicial.ordem ?? 0,
    tags_csv: (inicial.tags ?? []).join(", "),
    perfis_csv: (inicial.perfis_aplicaveis ?? []).join(", "),
    ativo: inicial.ativo ?? true,
  });

  function set<K extends keyof SaveTrilhaInput>(k: K, v: SaveTrilhaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await saveTrilha(form);
        if (!inicial.id) router.push(`/admin/trilhas/${id}`);
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function apagar() {
    if (!inicial.id) return;
    if (!confirm("Apagar esta trilha? Aulas vinculadas perdem o vínculo.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTrilha(inicial.id!);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Título</Label>
        <Input
          id="titulo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <textarea
          id="descricao"
          rows={3}
          value={form.descricao ?? ""}
          onChange={(e) => set("descricao", e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ordem">Ordem</Label>
          <Input
            id="ordem"
            type="number"
            value={form.ordem ?? 0}
            onChange={(e) => set("ordem", Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="ativo"
            type="checkbox"
            checked={form.ativo ?? true}
            onChange={(e) => set("ativo", e.target.checked)}
          />
          <Label htmlFor="ativo">Ativa</Label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={form.tags_csv ?? ""}
          onChange={(e) => set("tags_csv", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfis">Perfis aplicáveis (separados por vírgula)</Label>
        <Input
          id="perfis"
          value={form.perfis_csv ?? ""}
          onChange={(e) => set("perfis_csv", e.target.value)}
          placeholder="TEA, TDAH"
        />
      </div>

      <div className="flex justify-between gap-2 pt-2">
        {permitirApagar && inicial.id ? (
          <Button type="button" variant="destructive" onClick={apagar} disabled={pending}>
            Apagar
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : inicial.id ? "Salvar" : "Criar trilha"}
        </Button>
      </div>
    </form>
  );
}
