"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FamiliaEditor } from "./familia-editor";
import { MembroEditor } from "./membro-editor";
import { SugestoesPanel } from "./sugestoes-panel";

export type FamiliaSecoes = {
  composicao: string;
  rotina: string;
  recursos: string;
  dinamica: string;
};

export type MembroData = {
  id: string;
  nome: string;
  idade: number;
  perfil: string;
  essencial: string;
  como_e: string;
  corpo_rotina: string;
  desafios_regulacao: string;
  sensorial: string;
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
  // Default: primeira aba é o primeiro membro (foco do produto), depois família,
  // depois sugestões. Se não tem membro ainda, vai pra família.
  const initialTab =
    membros.length > 0 ? `membro-${membros[0].id}` : "familia";
  const [tab, setTab] = useState(initialTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
      <TabsList className="flex w-full flex-wrap justify-start gap-1">
        {membros.map((m) => (
          <TabsTrigger key={m.id} value={`membro-${m.id}`}>
            {m.nome}
          </TabsTrigger>
        ))}
        <TabsTrigger value="familia">Família</TabsTrigger>
        <TabsTrigger value="sugestoes" className="gap-2">
          Sugestões
          {sugestoes.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {sugestoes.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {membros.map((m) => (
        <TabsContent key={m.id} value={`membro-${m.id}`}>
          <MembroEditor membro={m} />
        </TabsContent>
      ))}

      <TabsContent value="familia">
        <FamiliaEditor familia={familia} />
      </TabsContent>

      <TabsContent value="sugestoes">
        <SugestoesPanel sugestoes={sugestoes} membros={membros} />
      </TabsContent>
    </Tabs>
  );
}
