"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarWhatsappAction } from "./actions";

export function WhatsappForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(initial);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "erro"; msg: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await atualizarWhatsappAction({ whatsapp_e164: valor });
      if (!res.ok) {
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setFeedback({ kind: "ok", msg: "Pronto, WhatsApp atualizado." });
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
        <Label htmlFor="whatsapp_e164">Número do WhatsApp</Label>
        <Input
          id="whatsapp_e164"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="+55 11 91234-5678"
          autoComplete="tel"
          disabled={pending}
        />
        <span className="text-xs text-muted-foreground">
          Com o código do país (+55). É por aqui que a Ayla fala com você.
        </span>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar WhatsApp"}
        </Button>
      </div>
    </form>
  );
}
