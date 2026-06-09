"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { capitalizarNome } from "@/lib/nome";
import { cn } from "@/lib/utils";
import { PlanoResultado } from "./plano-resultado";

export type PlanoSecaoView = {
  tipo: string;
  titulo: string;
  conteudo_markdown: string;
};

const LABEL: Record<string, string> = {
  entender: "Entendendo",
  crencas: "Crenças",
  diferente: "O que fazer diferente",
  rotina: "Rotina",
  brincadeiras: "Brincadeiras",
  atividades: "Atividades",
  historia_social: "Histórias sociais",
  frases: "Frases prontas",
  observar: "O que observar",
};

export function PlanoView({
  planoId,
  titulo,
  crianca,
  secoes,
  resultado,
  resultadoNota,
}: {
  planoId: string;
  titulo: string;
  crianca: string | null;
  secoes: PlanoSecaoView[];
  resultado: "funcionou" | "parcial" | "nao_funcionou" | "nao_testou" | null;
  resultadoNota: string | null;
}) {
  const [filtro, setFiltro] = useState<string>("tudo");
  const tipos = Array.from(new Set(secoes.map((s) => s.tipo)));
  const visiveis = filtro === "tudo" ? secoes : secoes.filter((s) => s.tipo === filtro);
  const nome = crianca ? capitalizarNome(crianca) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/planos"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Meus Planos
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl text-foreground md:text-4xl">{titulo}</h1>
            {nome && <p className="mt-1 text-sm text-muted-foreground">Sobre {nome}</p>}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-purple/20 bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow-sm transition-colors hover:bg-kolo-lilas-bg-2 print:hidden"
          >
            <Printer className="size-4" aria-hidden /> Imprimir
          </button>
        </div>
      </header>

      {/* Filtro — os antigos "botões" viram visões do mesmo plano (0 chamada). */}
      {tipos.length > 1 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Aba ativo={filtro === "tudo"} onClick={() => setFiltro("tudo")}>
            Tudo
          </Aba>
          {tipos.map((t) => (
            <Aba key={t} ativo={filtro === t} onClick={() => setFiltro(t)}>
              {LABEL[t] ?? t}
            </Aba>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {visiveis.map((s, i) => (
          <section key={`${s.tipo}-${i}`}>
            <h2 className="font-heading text-xl text-brand-purple md:text-2xl">
              {s.titulo || LABEL[s.tipo] || "Seção"}
            </h2>
            <RespostaMarkdown
              texto={s.conteudo_markdown}
              className="mt-2 flex flex-col gap-3 text-base leading-relaxed text-foreground"
            />
          </section>
        ))}
      </div>

      <PlanoResultado planoId={planoId} resultado={resultado} nota={resultadoNota} />
    </div>
  );
}

function Aba({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        ativo
          ? "border-brand-purple bg-brand-purple text-white"
          : "border-input bg-white text-foreground hover:border-brand-purple/40",
      )}
    >
      {children}
    </button>
  );
}
