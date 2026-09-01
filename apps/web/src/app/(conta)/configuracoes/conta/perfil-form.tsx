"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarPerfilAction } from "./actions";

export function PerfilForm({
  initial,
}: {
  initial: { nome_mae: string; como_chamar: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState(initial.nome_mae);
  const [comoChamar, setComoChamar] = useState(initial.como_chamar);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "erro"; msg: string } | null
  >(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await salvarPerfilAction({
        nome_mae: nome,
        como_chamar: comoChamar,
      });
      if (!res.ok) {
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setFeedback({ kind: "ok", msg: "Pronto, salvo." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {feedback && (
        <div
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome_mae">Seu nome</Label>
        <Input
          id="nome_mae"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="name"
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="como_chamar">Como prefere que a gente te chame</Label>
        <Input
          id="como_chamar"
          value={comoChamar}
          onChange={(e) => setComoChamar(e.target.value)}
          placeholder="Ex.: só o primeiro nome, ou um apelido"
          disabled={pending}
        />
        <span className="text-xs text-muted-foreground">
          É esse nome que aparece no &ldquo;Oi, ...&rdquo; do início e no menu.
          Deixe em branco pra usar seu nome.
        </span>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
