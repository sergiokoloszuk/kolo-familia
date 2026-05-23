"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamiliaEditor } from "./familia-editor";
import { MembroEditor } from "./membro-editor";
import { SugestoesPanel } from "./sugestoes-panel";

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
  essencial: Secao;
  como_e: Secao;
  corpo_rotina: Secao;
  desafios_regulacao: Secao;
  sensorial: Secao;
  completude_pct: number;
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
  // Sugestões — faixa contextual no topo (P-KV-8).
  // Tabs membros/família — removidas (P-KV-2): agora é leitura contínua.
  const [showSugestoes, setShowSugestoes] = useState(false);
  const temSugestoes = sugestoes.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {temSugestoes && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-kolo-lilas-bg-2/70 px-5 py-3">
            <p className="text-sm text-foreground">
              Algumas coisas novas apareceram por aqui.
            </p>
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

      {/* Leitura contínua — membros em sequência, depois a família como
       * continuação natural. Sem tabs (P-KV-2). Mudança de capítulo
       * sentida via mt-8 extra antes da família (sem virar quebra). */}
      <div className="flex flex-col gap-12">
        {membros.map((m) => (
          <MembroEditor key={m.id} membro={m} />
        ))}
        <div className="mt-8">
          <FamiliaEditor familia={familia} />
        </div>
      </div>
    </div>
  );
}
