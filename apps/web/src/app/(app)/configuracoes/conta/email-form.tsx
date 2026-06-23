"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarEmailAction } from "./actions";

export function EmailForm({ atual }: { atual: string }) {
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(atual);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "erro"; msg: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await atualizarEmailAction({ email: valor });
      if (!res.ok) {
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setFeedback({
        kind: "ok",
        msg: "Enviamos um link de confirmação pro novo e-mail. A troca vale quando você confirmar por lá.",
      });
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
        <Label htmlFor="email">E-mail de login</Label>
        <Input
          id="email"
          type="email"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoComplete="email"
          disabled={pending}
        />
        <span className="text-xs text-muted-foreground">
          Pra trocar, mandamos um link de confirmação pro novo e-mail.
        </span>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Trocar e-mail"}
        </Button>
      </div>
    </form>
  );
}
