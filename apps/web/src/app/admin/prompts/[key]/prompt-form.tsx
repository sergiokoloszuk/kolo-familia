"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveAiPrompt } from "../actions";

export function PromptForm({
  promptKey,
  initial,
}: {
  promptKey: string;
  initial: {
    label: string;
    description: string;
    system_text: string;
    ativo: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description);
  const [systemText, setSystemText] = useState(initial.system_text);
  const [ativo, setAtivo] = useState(initial.ativo);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    startTransition(async () => {
      const res = await saveAiPrompt({
        key: promptKey,
        label,
        description: description || undefined,
        system_text: systemText,
        ativo,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
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
        <div className="flex items-end">
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
          placeholder="Pra que serve esse prompt"
          disabled={pending}
        />
      </div>

      <div>
        <Label htmlFor="system_text">System Prompt</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Esse é o texto enviado ao modelo Claude no campo <code>system</code>.
          Use markdown se quiser (# Regras, # Formato, etc). Variáveis dinâmicas
          são inseridas no <code>user message</code>, não aqui.
        </p>
        <textarea
          id="system_text"
          value={systemText}
          onChange={(e) => setSystemText(e.target.value)}
          rows={24}
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm leading-relaxed"
          disabled={pending}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {systemText.length} caracteres
        </p>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {ok && (
        <p className="text-sm text-emerald-600">
          Salvo. Versão incrementada — a próxima chamada da IA já usa esse texto.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
