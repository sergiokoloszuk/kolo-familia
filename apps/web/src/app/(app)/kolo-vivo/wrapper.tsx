"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeletorCrianca } from "../seletor-crianca";
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
  conflitos: Array<{ chave: string; descricao: string }>;
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
  ativaId,
  sugestoes,
}: {
  familyId: string;
  familia: FamiliaSecoes;
  membros: MembroData[];
  ativaId: string | null;
  sugestoes: SugestaoRow[];
}) {
  // Sugestões — faixa contextual no topo (P-KV-8). Abre já quando há itens
  // pra não passar batido.
  const temSugestoes = sugestoes.length > 0;
  const [showSugestoes, setShowSugestoes] = useState(temSugestoes);

  // Multi-criança: mostra a CRIANÇA ATIVA (cookie global). O seletor é o mesmo
  // de toda a plataforma — trocar aqui troca em todo lugar. Com 1, leitura
  // contínua original (sem seletor).
  const multi = membros.length > 1;
  const ativo = membros.find((m) => m.id === ativaId) ?? membros[0] ?? null;
  const membrosVisiveis = multi && ativo ? [ativo] : membros;

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

      {/* Seletor de criança GLOBAL — só com 2+. Trocar aqui troca em toda a
       * plataforma (cookie). A família segue como continuação no fim. */}
      {multi && ativo && (
        <div className="w-fit">
          <SeletorCrianca
            criancas={membros.map((m) => ({ id: m.id, nome: m.nome }))}
            ativaId={ativo.id}
            variant="screen"
          />
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
