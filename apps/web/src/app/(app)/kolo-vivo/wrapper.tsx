"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamiliaEditor } from "./familia-editor";
import { MembroEditor } from "./membro-editor";
import { SugestoesPanel } from "./sugestoes-panel";
import type { DominioKey } from "./dominios";
import type { DominioSugestao } from "./dominio-card";

/**
 * Cada seção tem texto + timestamp da última atualização (P-KV-6).
 * `atualizadoEm` é null quando a seção nunca foi salva via novos actions
 * (jsonb antigo do onboarding pode não ter o campo).
 */
export type Secao = {
  texto: string;
  atualizadoEm: string | null;
};

export type FamiliaSecoes = {
  composicao: Secao;
  rotina: Secao;
  recursos: Secao;
  dinamica: Secao;
};

export type MembroData = {
  id: string;
  nome: string;
  idade: number | null;
  perfil: string;
  diasAcompanhada: number | null;
  hiperfocos: string[];
  completude: number;
  dominios: Record<DominioKey, Secao>;
  sugestoes: Partial<Record<DominioKey, DominioSugestao>>;
  marcos: Array<{ data: string; dominio: string; texto: string }>;
  revisar: string[];
};

export type SugestaoRow = {
  id: string;
  membro_atipico_id: string | null;
  camada: "camada1" | "camada2";
  campo: string;
  texto_sugerido: string;
  origem: string;
  created_at: string;
};

export function KoloVivoWrapper({
  familyId: _familyId,
  familia,
  membros,
  sugestoes,
}: {
  familyId: string;
  familia: FamiliaSecoes;
  membros: MembroData[];
  sugestoes: SugestaoRow[];
}) {
  // Sugestões — faixa contextual no topo (P-KV-8). Abre já quando há itens
  // pra não passar batido.
  const temSugestoes = sugestoes.length > 0;
  const [showSugestoes, setShowSugestoes] = useState(temSugestoes);

  // Multi-criança: seletor pra focar numa por vez. Com 1 criança só, mantém
  // a leitura contínua original do protótipo (sem seletor, sem mudança).
  const multi = membros.length > 1;
  const [membroAtivoId, setMembroAtivoId] = useState<string | null>(
    membros[0]?.id ?? null,
  );
  const membrosVisiveis = multi
    ? membros.filter((m) => m.id === membroAtivoId)
    : membros;

  return (
    <div className="flex flex-col gap-5">
      {temSugestoes && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-yellow/40 bg-brand-yellow/10 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="relative flex size-2.5 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-yellow opacity-60" />
                <span className="relative size-2.5 rounded-full bg-brand-yellow" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {sugestoes.length}{" "}
                {sugestoes.length === 1 ? "coisa nova pra revisar" : "coisas novas pra revisar"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSugestoes((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple underline-offset-4 transition-colors hover:underline"
            >
              {showSugestoes ? "Esconder" : "Ver"}
              <ChevronDown
                aria-hidden
                className={cn(
                  "size-4 transition-transform",
                  showSugestoes && "rotate-180",
                )}
              />
            </button>
          </div>

          {showSugestoes && (
            <SugestoesPanel sugestoes={sugestoes} membros={membros} />
          )}
        </div>
      )}

      {/* Seletor de criança — só com 2+. Pills discretas pra focar numa
       * por vez. A família segue como continuação natural no fim. */}
      {multi && (
        <div
          role="tablist"
          aria-label="Escolher criança"
          className="flex flex-wrap gap-2"
        >
          {membros.map((m) => {
            const ativo = m.id === membroAtivoId;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setMembroAtivoId(m.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-brand-purple text-white"
                    : "bg-kolo-lilas-bg-2 text-foreground hover:bg-kolo-lilas-bg",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full font-heading text-xs font-semibold",
                    ativo
                      ? "bg-white/20 text-white"
                      : "bg-brand-yellow text-brand-purple-dark",
                  )}
                >
                  {m.nome[0]?.toUpperCase() ?? "?"}
                </span>
                {m.nome}
              </button>
            );
          })}
        </div>
      )}

      {/* Leitura contínua — membro(s) em sequência, depois a família como
       * continuação natural. Com 1 criança, mantém o comportamento do
       * protótipo (P-KV-2). Com 2+, o seletor acima filtra. */}
      <div className="flex flex-col gap-12">
        {membrosVisiveis.map((m) => (
          <MembroEditor key={m.id} membro={m} />
        ))}
        <div className="mt-8">
          <FamiliaEditor familia={familia} />
        </div>
      </div>
    </div>
  );
}
