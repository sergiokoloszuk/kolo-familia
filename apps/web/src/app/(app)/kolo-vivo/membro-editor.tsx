"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { decideSugestao, saveSecaoMembro } from "./actions";
import { DOMINIOS } from "./dominios";
import { DominioCard, type DominioStatus } from "./dominio-card";
import type { MembroData } from "./wrapper";

const TAG_DOT = [
  "bg-cat-alimentacao",
  "bg-cat-motor",
  "bg-cat-foco",
  "bg-cat-social",
  "bg-cat-comunicacao",
];

type Filtro = "todos" | "vivo" | "perceber" | "comecar";

const FILTRO_DOT: Record<Exclude<Filtro, "todos">, string> = {
  vivo: "bg-brand-yellow",
  perceber: "bg-cat-emocao",
  comecar: "bg-foreground/15",
};

export function MembroEditor({ membro }: { membro: MembroData }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Status por domínio (perceber = tem sugestão pendente; vivo = preenchido).
  const items = useMemo(
    () =>
      DOMINIOS.map((d) => {
        const secao = membro.dominios[d.key];
        const sugestao = membro.sugestoes[d.key];
        const status: DominioStatus = sugestao
          ? "perceber"
          : secao.texto.trim()
            ? "vivo"
            : "comecar";
        return { d, secao, sugestao, status };
      }),
    [membro],
  );

  const contagem = useMemo(() => {
    const c = { vivo: 0, perceber: 0, comecar: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  const visiveis =
    filtro === "todos" ? items : items.filter((it) => it.status === filtro);

  const inicial = membro.nome.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — identidade da criança */}
      <div className="flex flex-col items-start gap-6 rounded-[28px] bg-gradient-to-br from-kolo-creme to-kolo-lilas-bg p-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_8px_24px_rgba(46,10,82,0.05)] md:flex-row md:items-center md:gap-8 md:p-9">
        <span
          aria-hidden
          className="grid size-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-yellow to-[#FFA500] font-heading text-4xl font-medium text-brand-purple-dark shadow-[0_4px_16px_rgba(255,186,0,0.3)] md:size-24"
        >
          {inicial}
        </span>

        <div className="flex-1">
          <h2 className="font-heading text-3xl font-medium leading-none tracking-tight text-foreground md:text-4xl">
            {membro.nome}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {[
              membro.idade != null ? `${membro.idade} anos` : null,
              membro.perfil,
              membro.diasAcompanhada != null
                ? `Acompanhada há ${membro.diasAcompanhada} ${membro.diasAcompanhada === 1 ? "dia" : "dias"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {membro.hiperfocos.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {membro.hiperfocos.map((h, i) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-[0_1px_3px_rgba(46,10,82,0.04)]"
                >
                  <span
                    aria-hidden
                    className={cn("size-2 rounded-full", TAG_DOT[i % TAG_DOT.length])}
                  />
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-left md:text-right">
          <div className="font-heading text-5xl font-medium leading-none tracking-tight text-brand-purple">
            {membro.completude}%
          </div>
          <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            do mapa vivo
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Filtrar
        </span>
        <FiltroPill ativo={filtro === "todos"} onClick={() => setFiltro("todos")}>
          Tudo · {items.length}
        </FiltroPill>
        <FiltroPill ativo={filtro === "vivo"} onClick={() => setFiltro("vivo")} dot={FILTRO_DOT.vivo}>
          Já percebido · {contagem.vivo}
        </FiltroPill>
        <FiltroPill
          ativo={filtro === "perceber"}
          onClick={() => setFiltro("perceber")}
          dot={FILTRO_DOT.perceber}
        >
          Vale entender · {contagem.perceber}
        </FiltroPill>
        <FiltroPill
          ativo={filtro === "comecar"}
          onClick={() => setFiltro("comecar")}
          dot={FILTRO_DOT.comecar}
        >
          Começar · {contagem.comecar}
        </FiltroPill>
      </div>

      {/* Grid de domínios */}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {visiveis.map(({ d, secao, sugestao, status }) => (
          <DominioCard
            key={d.key}
            dominio={d}
            texto={secao.texto}
            atualizadoEm={secao.atualizadoEm}
            status={status}
            sugestao={sugestao}
            membroId={membro.id}
            onSave={async (texto) => {
              await saveSecaoMembro({ membro_id: membro.id, campo: d.key, texto });
            }}
            onDecideSugestao={async (id, decisao) => {
              await decideSugestao({ sugestao_id: id, decisao });
            }}
          />
        ))}
      </div>

      {visiveis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nada nesse filtro por enquanto.
        </p>
      )}
    </div>
  );
}

function FiltroPill({
  ativo,
  onClick,
  dot,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors",
        ativo
          ? "border-brand-purple-dark bg-brand-purple-dark text-white"
          : "border-border bg-white text-muted-foreground hover:border-brand-purple hover:text-brand-purple",
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </button>
  );
}
