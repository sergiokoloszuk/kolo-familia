"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  idade: number;
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
  // Default: primeira aba é o primeiro membro (foco do produto), depois família.
  const initialTab =
    membros.length > 0 ? `membro-${membros[0].id}` : "familia";
  const [tab, setTab] = useState(initialTab);

  // Sugestões saíram de "tab" pra faixa contextual no topo.
  // P-KV-8: parecem parte do retrato em construção, não fila de moderação.
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

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          {membros.map((m) => (
            <TabsTrigger key={m.id} value={`membro-${m.id}`}>
              {m.nome}
            </TabsTrigger>
          ))}
          <TabsTrigger value="familia">Família</TabsTrigger>
        </TabsList>

        {membros.map((m) => (
          <TabsContent key={m.id} value={`membro-${m.id}`}>
            <MembroEditor membro={m} />
          </TabsContent>
        ))}

        <TabsContent value="familia">
          <FamiliaEditor familia={familia} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
