"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { avaliarDemanda, type AvaliarDemandaResult } from "./actions";

const RECOMENDACAO_LABEL: Record<string, string> = {
  coberta: "Já é coberta",
  melhoria: "É melhoria de skill existente",
  nova: "É skill nova",
};

const RECOMENDACAO_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  coberta: "secondary",
  melhoria: "outline",
  nova: "default",
};

export function CuradoriaForm() {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<AvaliarDemandaResult | null>(null);
  const [demanda, setDemanda] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demanda.trim().length < 15) return;
    setResultado(null);
    startTransition(async () => {
      try {
        const r = await avaliarDemanda({ demanda });
        setResultado(r);
      } catch (e) {
        setResultado({
          ok: false,
          erro: e instanceof Error ? e.message : "Erro inesperado",
        });
      }
    });
  }

  function reset() {
    setResultado(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="demanda">Demanda</Label>
          <textarea
            id="demanda"
            rows={4}
            value={demanda}
            onChange={(e) => setDemanda(e.target.value)}
            disabled={pending}
            placeholder="Descreva o tema, padrão de pergunta ou tipo de orientação que você quer cobrir."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending || demanda.trim().length < 15}
          >
            <Sparkles aria-hidden="true" />
            {pending ? "Avaliando..." : "Avaliar com IA"}
          </Button>
        </div>
      </form>

      {resultado && !resultado.ok && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {resultado.erro}
        </div>
      )}

      {resultado?.ok && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="text-base">
                Recomendação
              </CardTitle>
              <Badge
                variant={
                  RECOMENDACAO_VARIANT[resultado.suggestion.recomendacao] ?? "default"
                }
              >
                {RECOMENDACAO_LABEL[resultado.suggestion.recomendacao] ??
                  resultado.suggestion.recomendacao}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{resultado.suggestion.justificativa}</p>
            </CardContent>
          </Card>

          {resultado.suggestion.skillsAfetadas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Skills afetadas</CardTitle>
                <CardDescription>
                  {resultado.suggestion.recomendacao === "coberta"
                    ? "Estas skills já cobrem (parcial ou totalmente) a demanda."
                    : "Ajustes sugeridos pra cobrir a demanda."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {resultado.suggestion.skillsAfetadas.map((s) => (
                    <li key={s.name} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-xs">{s.name}</code>
                        <a
                          href={`/admin/skills`}
                          className="text-xs underline-offset-4 hover:underline"
                        >
                          Abrir →
                        </a>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.ajustes_sugeridos}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {resultado.suggestion.minutaNovaSkill && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Minuta de skill nova
                </CardTitle>
                <CardDescription>
                  Revise. Pra criar de fato, copie os campos pra{" "}
                  <a href="/admin/skills/nova" className="underline">
                    /admin/skills/nova
                  </a>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                  {JSON.stringify(resultado.suggestion.minutaNovaSkill, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={reset}>
              Avaliar outra demanda
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
