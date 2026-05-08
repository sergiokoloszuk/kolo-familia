"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DASS21_ESCALA,
  DASS21_ITEMS,
  FAIXA_INTERPRETACAO,
  FAIXA_LABEL,
  type DASS21Faixa,
} from "@/lib/dass21";
import { aplicarDASS21, type AplicarDASS21Result } from "./actions";

type RespostaState = (number | null)[];

export function DASS21Form() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AplicarDASS21Result | null>(null);
  const [respostas, setRespostas] = useState<RespostaState>(() =>
    Array<number | null>(21).fill(null),
  );

  const todasRespondidas = useMemo(
    () => respostas.every((r) => r !== null),
    [respostas],
  );

  function setResposta(index: number, valor: number) {
    setRespostas((arr) => {
      const next = arr.slice();
      next[index] = valor;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!todasRespondidas) {
      setErro("Responda todas as 21 questões antes de finalizar.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await aplicarDASS21({ respostas: respostas as number[] });
        setResultado(r);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  if (resultado) return <Resultado resultado={resultado} />;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {DASS21_ITEMS.map((item, i) => (
          <li key={item.numero}>
            <div className="rounded-md border p-3">
              <p className="text-sm">
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {item.numero}.
                </span>
                {item.texto}
              </p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
                {DASS21_ESCALA.map((opt) => (
                  <button
                    key={opt.valor}
                    type="button"
                    onClick={() => setResposta(i, opt.valor)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs ${
                      respostas[i] === opt.valor
                        ? "border-foreground bg-foreground text-background"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="block font-mono">{opt.valor}</span>
                    <span className="block">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {respostas.filter((r) => r !== null).length} de 21 respondidas
        </p>
        <Button type="submit" disabled={pending || !todasRespondidas}>
          {pending ? "Calculando..." : "Finalizar"}
        </Button>
      </div>
    </form>
  );
}

function Resultado({ resultado }: { resultado: AplicarDASS21Result }) {
  return (
    <div className="flex flex-col gap-4">
      {resultado.algumaSevera && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Sinais fortes nesta semana
            </CardTitle>
            <CardDescription>
              Recomendamos buscar um profissional de saúde mental. O termômetro
              indica que vale apoio agora — você não precisa enfrentar isso sozinha.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="mb-2">Em emergência:</p>
            <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
              <li>
                <strong>CVV — 188</strong> (24h, gratuito)
              </li>
              <li>
                <strong>CAPS</strong> mais próximo (Centro de Atenção Psicossocial)
              </li>
              <li>Profissional próprio se já tiver acompanhamento</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado</CardTitle>
          <CardDescription>
            Termômetro, não diagnóstico. Apenas você vê este resultado — fica
            protegido por permissões especiais no banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DimensaoLinha
            nome="Depressão"
            score={resultado.scores.depressao}
            faixa={resultado.faixas.depressao}
          />
          <DimensaoLinha
            nome="Ansiedade"
            score={resultado.scores.ansiedade}
            faixa={resultado.faixas.ansiedade}
          />
          <DimensaoLinha
            nome="Estresse"
            score={resultado.scores.estresse}
            faixa={resultado.faixas.estresse}
          />
        </CardContent>
      </Card>

      {resultado.algumaModeradaOuPior && !resultado.algumaSevera && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sugestão</CardTitle>
            <CardDescription>
              Sinais com mais intensidade que o usual. Vale conversar com profissional
              de saúde mental — sem urgência, mas vale.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Enquanto isso, pode ser útil abrir uma conversa em /conversar pedindo apoio
            sobre seu próprio bem-estar.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DimensaoLinha({
  nome,
  score,
  faixa,
}: {
  nome: string;
  score: number;
  faixa: DASS21Faixa;
}) {
  const variant: "default" | "secondary" | "destructive" | "outline" =
    faixa === "extremamente_severa" || faixa === "severa"
      ? "destructive"
      : faixa === "moderada"
        ? "default"
        : faixa === "leve"
          ? "secondary"
          : "outline";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{nome}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">score {score}</span>
          <Badge variant={variant}>{FAIXA_LABEL[faixa]}</Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{FAIXA_INTERPRETACAO[faixa]}</p>
    </div>
  );
}
