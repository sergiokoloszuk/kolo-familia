"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveTemplate } from "../actions";

export function TemplateForm({
  templateKey,
  initial,
  variables,
}: {
  templateKey: string;
  initial: {
    label: string;
    description: string;
    variations: string[];
    ativo: boolean;
  };
  variables: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description);
  const [variations, setVariations] = useState<string[]>(initial.variations);
  const [ativo, setAtivo] = useState(initial.ativo);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    startTransition(async () => {
      try {
        await saveTemplate({
          key: templateKey,
          label,
          description: description || undefined,
          variations: variations.map((v) => v.trim()).filter((v) => v.length > 0),
          ativo,
        });
        setOk(true);
        router.refresh();
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  function updateVariation(idx: number, value: string) {
    setVariations((arr) => arr.map((v, i) => (i === idx ? value : v)));
  }

  function addVariation() {
    setVariations((arr) => [...arr, ""]);
  }

  function removeVariation(idx: number) {
    if (variations.length === 1) return;
    setVariations((arr) => arr.filter((_, i) => i !== idx));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="label">Rótulo</Label>
          <input
            id="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          />
        </div>
        <div className="flex items-end gap-2">
          <Label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              disabled={pending}
            />
            Ativo
          </Label>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Quando essa mensagem é enviada"
          disabled={pending}
        />
      </div>

      {variables.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium">Variáveis disponíveis</p>
          <p className="mt-1 text-muted-foreground">
            Use{" "}
            {variables.map((v, i) => (
              <span key={v}>
                <code className="rounded bg-background px-1">{`{${v}}`}</code>
                {i < variables.length - 1 ? ", " : ""}
              </span>
            ))}{" "}
            no texto. São substituídas no envio.
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Variações ({variations.length})</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addVariation}
            disabled={pending}
          >
            + Adicionar variação
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          O scheduler escolhe round-robin entre as variações. Mais variações
          = menos repetição.
        </p>
        <div className="flex flex-col gap-3">
          {variations.map((v, idx) => (
            <div key={idx} className="rounded-md border bg-card p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Variação {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeVariation(idx)}
                  disabled={pending || variations.length === 1}
                  className="text-xs underline disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
              <textarea
                value={v}
                onChange={(e) => updateVariation(idx, e.target.value)}
                rows={5}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                disabled={pending}
              />
            </div>
          ))}
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {ok && <p className="text-sm text-emerald-600">Salvo. Nova versão entra em vigor já no próximo envio.</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
