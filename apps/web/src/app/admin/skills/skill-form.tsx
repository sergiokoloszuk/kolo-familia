"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSkill, deleteSkill, type SaveSkillInput } from "./actions";

export type SkillInicial = {
  id?: string;
  name?: string;
  display_name?: string;
  objective?: string;
  tone?: string;
  scope?: string;
  limits?: string;
  kolo_vivo_fields?: string[];
  knowledge_tags?: string[];
  routing_keywords?: string[];
  routing_priority?: number;
  fallback_questions?: string[];
  ativo?: boolean;
};

export function SkillForm({
  inicial,
  permitirApagar = false,
}: {
  inicial: SkillInicial;
  permitirApagar?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<SaveSkillInput>({
    id: inicial.id,
    name: inicial.name ?? "",
    display_name: inicial.display_name ?? "",
    objective: inicial.objective ?? "",
    tone: inicial.tone ?? "",
    scope: inicial.scope ?? "",
    limits: inicial.limits ?? "",
    kolo_vivo_fields_csv: (inicial.kolo_vivo_fields ?? []).join(", "),
    knowledge_tags_csv: (inicial.knowledge_tags ?? []).join(", "),
    routing_keywords_csv: (inicial.routing_keywords ?? []).join(", "),
    routing_priority: inicial.routing_priority ?? 50,
    fallback_questions_jsonl: (inicial.fallback_questions ?? []).join("\n"),
    ativo: inicial.ativo ?? true,
  });

  function set<K extends keyof SaveSkillInput>(k: K, v: SaveSkillInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        const { id } = await saveSkill(form);
        if (!inicial.id) router.push(`/admin/skills/${id}`);
        else router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function apagar() {
    if (!inicial.id) return;
    if (
      !confirm(
        "Apagar esta skill? Conversas que a usaram permanecem, mas roteamento futuro fica sem ela.",
      )
    )
      return;
    setErro(null);
    startTransition(async () => {
      try {
        await deleteSkill(inicial.id!);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome interno (snake_case)</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={Boolean(inicial.id)}
            placeholder="ex: regulacao_emocional"
            required
          />
          {inicial.id && (
            <p className="text-xs text-muted-foreground">
              Nome interno não muda após criação.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Nome de exibição</Label>
          <Input
            id="display_name"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder="ex: Regulação Emocional"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="objective">Objetivo (1 frase)</Label>
        <textarea
          id="objective"
          rows={2}
          value={form.objective}
          onChange={(e) => set("objective", e.target.value)}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tone">Tom de voz</Label>
          <textarea
            id="tone"
            rows={2}
            value={form.tone}
            onChange={(e) => set("tone", e.target.value)}
            required
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scope">Escopo</Label>
          <textarea
            id="scope"
            rows={2}
            value={form.scope}
            onChange={(e) => set("scope", e.target.value)}
            required
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="limits">Limites (o que NÃO faz)</Label>
        <textarea
          id="limits"
          rows={2}
          value={form.limits}
          onChange={(e) => set("limits", e.target.value)}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kvf">Campos Kolo Vivo consumidos (CSV)</Label>
          <Input
            id="kvf"
            value={form.kolo_vivo_fields_csv ?? ""}
            onChange={(e) => set("kolo_vivo_fields_csv", e.target.value)}
            placeholder="essencial, desafios_regulacao"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tags">Tags de conhecimento (CSV)</Label>
          <Input
            id="tags"
            value={form.knowledge_tags_csv ?? ""}
            onChange={(e) => set("knowledge_tags_csv", e.target.value)}
            placeholder="regulacao, emocao, transicao"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kw">Routing keywords (CSV) — gatilhos do roteador</Label>
        <textarea
          id="kw"
          rows={2}
          value={form.routing_keywords_csv ?? ""}
          onChange={(e) => set("routing_keywords_csv", e.target.value)}
          placeholder="crise, ansioso, ataque, perdeu o controle, desregulou"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prio">Routing priority (0-100)</Label>
          <Input
            id="prio"
            type="number"
            min={0}
            max={100}
            value={form.routing_priority}
            onChange={(e) => set("routing_priority", Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input
            id="ativo"
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => set("ativo", e.target.checked)}
          />
          <Label htmlFor="ativo">Ativa</Label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fallback">Fallback questions — exatamente 4, uma por linha</Label>
        <textarea
          id="fallback"
          rows={4}
          value={form.fallback_questions_jsonl ?? ""}
          onChange={(e) => set("fallback_questions_jsonl", e.target.value)}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          {pending ? "Salvando..." : inicial.id ? "Salvar (incrementa versão)" : "Criar skill"}
        </Button>
      </div>
    </form>
  );
}
