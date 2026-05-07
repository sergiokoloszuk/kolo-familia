"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBoaPratica, deleteBoaPratica } from "../actions";

type Inicial = {
  id: string;
  titulo: string | null;
  versao_curta: string | null;
  versao_conversa: string | null;
  texto_original: string;
  skills_relacionadas: string[];
  tags: string[];
  perfis_aplicaveis: string[];
  faixa_etaria_min: number | null;
  faixa_etaria_max: number | null;
  nivel: "iniciante" | "intermediario" | "avancado" | null;
};

export function BPForm({ inicial }: { inicial: Inicial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    titulo: inicial.titulo ?? "",
    versao_curta: inicial.versao_curta ?? "",
    versao_conversa: inicial.versao_conversa ?? "",
    texto_original: inicial.texto_original ?? "",
    skills_csv: inicial.skills_relacionadas.join(", "),
    tags_csv: inicial.tags.join(", "),
    perfis_csv: inicial.perfis_aplicaveis.join(", "),
    faixa_etaria_min: inicial.faixa_etaria_min,
    faixa_etaria_max: inicial.faixa_etaria_max,
    nivel: inicial.nivel,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveBoaPratica({
          id: inicial.id,
          titulo: form.titulo,
          versao_curta: form.versao_curta,
          versao_conversa: form.versao_conversa,
          texto_original: form.texto_original,
          skills_csv: form.skills_csv,
          tags_csv: form.tags_csv,
          perfis_csv: form.perfis_csv,
          faixa_etaria_min: form.faixa_etaria_min,
          faixa_etaria_max: form.faixa_etaria_max,
          nivel: form.nivel,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function apagar() {
    if (!confirm("Apagar esta Boa Prática?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBoaPratica(inicial.id);
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
          onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="versao_curta">Versão curta (1 frase — usada pelas skills)</Label>
        <textarea
          id="versao_curta"
          rows={2}
          value={form.versao_curta}
          onChange={(e) => setForm((f) => ({ ...f, versao_curta: e.target.value }))}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="versao_conversa">Versão conversa (parágrafo natural — opcional)</Label>
        <textarea
          id="versao_conversa"
          rows={3}
          value={form.versao_conversa}
          onChange={(e) => setForm((f) => ({ ...f, versao_conversa: e.target.value }))}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="texto_original">Texto original</Label>
        <textarea
          id="texto_original"
          rows={4}
          value={form.texto_original}
          onChange={(e) => setForm((f) => ({ ...f, texto_original: e.target.value }))}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skills">Skills relacionadas (separadas por vírgula)</Label>
        <Input
          id="skills"
          value={form.skills_csv}
          onChange={(e) => setForm((f) => ({ ...f, skills_csv: e.target.value }))}
          placeholder="sensorial, regulacao_emocional"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={form.tags_csv}
          onChange={(e) => setForm((f) => ({ ...f, tags_csv: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfis">Perfis aplicáveis</Label>
          <Input
            id="perfis"
            value={form.perfis_csv}
            onChange={(e) => setForm((f) => ({ ...f, perfis_csv: e.target.value }))}
            placeholder="TEA, TDAH"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nivel">Nível</Label>
          <select
            id="nivel"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={form.nivel ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                nivel: (e.target.value || null) as Inicial["nivel"],
              }))
            }
          >
            <option value="">—</option>
            <option value="iniciante">Iniciante</option>
            <option value="intermediario">Intermediário</option>
            <option value="avancado">Avançado</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idade_min">Idade mínima</Label>
          <Input
            id="idade_min"
            type="number"
            value={form.faixa_etaria_min ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                faixa_etaria_min: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idade_max">Idade máxima</Label>
          <Input
            id="idade_max"
            type="number"
            value={form.faixa_etaria_max ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                faixa_etaria_max: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button type="button" variant="destructive" onClick={apagar} disabled={pending}>
          Apagar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
