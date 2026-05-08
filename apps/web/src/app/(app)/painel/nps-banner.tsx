"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { enviarFeedbackNps } from "./nps-actions";

export function NpsBanner({ contexto }: { contexto: "d7" | "d30" | "manual" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    if (score == null) return;
    setErro(null);
    startTransition(async () => {
      try {
        await enviarFeedbackNps({
          nps: score,
          comentario: comentario.trim() || undefined,
          contexto,
        });
        setEnviado(true);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  if (enviado) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base">Como está sendo o Kolo?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          De 0 a 10, o quanto você indicaria o Kolo Família para outra mãe ou
          pai de criança atípica?
        </p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 11 }).map((_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={`h-9 w-9 rounded-md border text-sm font-medium ${
                score === n
                  ? "bg-foreground text-background"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {score !== null && (
          <>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={
                score >= 9
                  ? "O que está sendo mais útil pra você?"
                  : score <= 6
                    ? "O que tem te incomodado? Conta aqui — leio."
                    : "Algum comentário? (opcional)"
              }
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {erro && (
              <p className="text-xs text-destructive">{erro}</p>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={enviar} disabled={pending}>
                {pending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
