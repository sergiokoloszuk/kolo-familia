"use client";

import { useState, useTransition } from "react";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { decideSugestao } from "./actions";
import type { MembroData, SugestaoRow } from "./wrapper";

export function SugestoesPanel({
  sugestoes,
  membros,
}: {
  sugestoes: SugestaoRow[];
  membros: MembroData[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDecide(id: string, decisao: "aprovar" | "rejeitar") {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        await decideSugestao({ sugestao_id: id, decisao });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao decidir");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (sugestoes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nenhuma sugestão pendente</CardTitle>
          <CardDescription>
            Quando a Ayla ou um especialista propor uma atualização do Kolo Vivo, aparece aqui pra
            você decidir.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {sugestoes.map((s) => {
        const membro = membros.find((m) => m.id === s.membro_atipico_id);
        return (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium">
                  {s.camada === "camada1"
                    ? `${membro?.nome ?? "Membro"} · ${labelCampo(s.campo)}`
                    : `Família · ${labelCampo(s.campo)}`}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="secondary">{labelOrigem(s.origem)}</Badge>
                  <span>{formatRelative(new Date(s.created_at), new Date(), { locale: ptBR })}</span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {s.texto_sugerido}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDecide(s.id, "rejeitar")}
                  disabled={pendingId === s.id}
                >
                  <X aria-hidden="true" /> Rejeitar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleDecide(s.id, "aprovar")}
                  disabled={pendingId === s.id}
                >
                  <Check aria-hidden="true" /> {pendingId === s.id ? "..." : "Aprovar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function labelCampo(campo: string): string {
  const map: Record<string, string> = {
    essencial: "Essencial",
    como_e: "Como ele/ela é",
    corpo_rotina: "Corpo & Rotina",
    desafios_regulacao: "Desafios & Regulação",
    sensorial: "Sensorial",
    composicao: "Composição",
    rotina: "Rotina",
    recursos: "Recursos",
    dinamica: "Dinâmica",
  };
  return map[campo] ?? campo;
}

function labelOrigem(origem: string): string {
  const map: Record<string, string> = {
    ayla: "Ayla",
    skill: "Especialista",
    app: "Você",
    diario_parser: "Diário",
  };
  return map[origem] ?? origem;
}
