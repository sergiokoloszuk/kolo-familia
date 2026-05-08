"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { favoritarImagem, apagarImagem } from "./actions";

const TIPOS_LABEL: Record<string, string> = {
  brincadeira: "Brincadeira",
  atividade: "Atividade",
  historia_social: "História social",
  conquista: "Conquista",
  livre: "Livre",
};

export function GaleriaItem({
  id,
  url,
  tipo,
  favoritada: favoritadaInicial,
  membroNome,
  criadaEm,
}: {
  id: string;
  url: string;
  tipo: string | null;
  favoritada: boolean;
  membroNome: string | null;
  criadaEm: string;
}) {
  const [pending, startTransition] = useTransition();
  const [favoritada, setFavoritada] = useState(favoritadaInicial);
  const [removida, setRemovida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (removida) return null;

  function toggleFav() {
    setErro(null);
    const next = !favoritada;
    setFavoritada(next);
    startTransition(async () => {
      try {
        await favoritarImagem({ id, favoritada: next });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
        setFavoritada(!next);
      }
    });
  }

  function apagar() {
    if (!confirm("Apagar esta imagem? Não dá pra desfazer.")) return;
    setErro(null);
    startTransition(async () => {
      try {
        await apagarImagem(id);
        setRemovida(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-md border bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={tipo ?? "imagem"} className="aspect-square w-full object-cover" />

      <div className="flex flex-col gap-2 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {tipo && <Badge variant="outline">{TIPOS_LABEL[tipo] ?? tipo}</Badge>}
            {membroNome && <span className="text-muted-foreground">{membroNome}</span>}
          </div>
          <span className="shrink-0 text-muted-foreground">{criadaEm}</span>
        </div>

        {erro && <p className="text-destructive">{erro}</p>}

        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleFav}
            disabled={pending}
            aria-label={favoritada ? "Desfavoritar" : "Favoritar"}
          >
            <Star
              aria-hidden="true"
              className={favoritada ? "fill-yellow-500 text-yellow-500" : ""}
            />
          </Button>
          <a
            href={url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-muted-foreground hover:bg-muted"
            aria-label="Baixar"
          >
            <Download aria-hidden="true" className="size-3.5" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={apagar}
            disabled={pending}
            aria-label="Apagar"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
