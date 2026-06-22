"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { perguntarAjuda, type AjudaResult } from "./actions";

const EXEMPLOS = [
  "Como mudo o nome que aparece pra mim?",
  "Onde registro uma conquista do dia?",
  "Como crio o avatar?",
  "Quero pedir ideias de brincadeira",
];

export function AjudaClient() {
  const [pending, startTransition] = useTransition();
  const [pergunta, setPergunta] = useState("");
  const [resultado, setResultado] = useState<AjudaResult | null>(null);

  function submit(texto?: string) {
    const q = (texto ?? pergunta).trim();
    if (!q || pending) return;
    if (texto) setPergunta(texto);
    setResultado(null);
    startTransition(async () => {
      const r = await perguntarAjuda(q);
      setResultado(r);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          rows={3}
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: quero mudar o horário das mensagens da Ayla"
          disabled={pending}
          className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
            Enter envia · Shift+Enter pula linha
          </span>
          <Button type="submit" size="lg" disabled={pending || !pergunta.trim()}>
            {pending ? "Procurando..." : "Me orienta"}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>

      {!resultado && !pending && (
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-foreground/10 bg-white px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-purple/30 hover:text-brand-purple"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {resultado && !resultado.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {resultado.error}
        </p>
      )}

      {resultado && resultado.ok && (
        <div className="rounded-2xl border border-foreground/[0.08] bg-white p-5 shadow-sm">
          <RespostaMarkdown
            texto={resultado.resposta}
            className="flex flex-col gap-3 text-base text-foreground"
          />
          {resultado.rota && resultado.rotaLabel && (
            <Link
              href={resultado.rota}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-dark"
            >
              Ir para {resultado.rotaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}

      <div className="mt-2 flex items-start gap-2.5 border-t border-foreground/[0.06] pt-4 text-sm text-muted-foreground">
        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-brand-purple/70" aria-hidden />
        <span>
          Ainda precisa de ajuda de gente?{" "}
          <a
            href="mailto:kolosuporte@gmail.com?subject=Ajuda%20no%20Kolo%20Fam%C3%ADlia"
            className="font-semibold text-brand-purple underline-offset-2 hover:underline"
          >
            kolosuporte@gmail.com
          </a>
        </span>
      </div>
    </div>
  );
}
