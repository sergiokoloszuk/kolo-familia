"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAula, type SaveAulaInput } from "./actions";

export type AulaInicial = {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  video_url?: string | null;
  transcricao?: string | null;
  trilha_id?: string | null;
  ordem_na_trilha?: number | null;
  faixa_etaria_min?: number | null;
  faixa_etaria_max?: number | null;
  tags?: string[];
  perfis_aplicaveis?: string[];
};

export function AulaForm({
  inicial,
  trilhas,
}: {
  inicial: AulaInicial;
  trilhas: Array<{ id: string; titulo: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SaveAulaInput>({
    id: inicial.id,
    titulo: inicial.titulo ?? "",
    descricao: inicial.descricao ?? "",
    video_url: inicial.video_url ?? "",
    transcricao: inicial.transcricao ?? "",
    trilha_id: inicial.trilha_id ?? null,
    ordem_na_trilha: inicial.ordem_na_trilha ?? null,
    faixa_etaria_min: inicial.faixa_etaria_min ?? null,
    faixa_etaria_max: inicial.faixa_etaria_max ?? null,
    tags_csv: (inicial.tags ?? []).join(", "),
    perfis_csv: (inicial.perfis_aplicaveis ?? []).join(", "),
  });

  function set<K extends keyof SaveAulaInput>(k: K, v: SaveAulaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await saveAula(form);
        if (!inicial.id) router.push(`/admin/aulas/${id}`);
        else router.refresh();
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
          rows={2}
          value={form.descricao ?? ""}
          onChange={(e) => set("descricao", e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="video_url">URL do vídeo</Label>
        <Input
          id="video_url"
          type="url"
          value={form.video_url ?? ""}
          onChange={(e) => set("video_url", e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transcricao">
          Transcrição (a IA usa pra extrair Boas Práticas quando publicar)
        </Label>
        <textarea
          id="transcricao"
          rows={10}
          value={form.transcricao ?? ""}
          onChange={(e) => set("transcricao", e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trilha">Trilha (opcional)</Label>
          <select
            id="trilha"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={form.trilha_id ?? ""}
            onChange={(e) => set("trilha_id", e.target.value || null)}
          >
            <option value="">— sem trilha —</option>
            {trilhas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ordem">Ordem na trilha</Label>
          <Input
            id="ordem"
            type="number"
            value={form.ordem_na_trilha ?? ""}
            onChange={(e) => set("ordem_na_trilha", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idade_min">Faixa etária mínima</Label>
          <Input
            id="idade_min"
            type="number"
            value={form.faixa_etaria_min ?? ""}
            onChange={(e) =>
              set("faixa_etaria_min", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idade_max">Faixa etária máxima</Label>
          <Input
            id="idade_max"
            type="number"
            value={form.faixa_etaria_max ?? ""}
            onChange={(e) =>
              set("faixa_etaria_max", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={form.tags_csv ?? ""}
          onChange={(e) => set("tags_csv", e.target.value)}
          placeholder="transicao, sono, regulacao"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfis">Perfis aplicáveis (separados por vírgula)</Label>
        <Input
          id="perfis"
          value={form.perfis_csv ?? ""}
          onChange={(e) => set("perfis_csv", e.target.value)}
          placeholder="TEA, TDAH, Outro"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : inicial.id ? "Salvar alterações" : "Criar aula"}
        </Button>
      </div>
    </form>
  );
}
