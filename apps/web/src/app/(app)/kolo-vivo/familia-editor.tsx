"use client";

import { saveSecaoFamilia } from "./actions";
import { SectionEditor } from "./section-editor";
import type { FamiliaSecoes } from "./wrapper";

const SECOES = [
  {
    key: "composicao" as const,
    title: "Composição da família",
    description: "Quem mora junto, papéis, presença.",
    placeholder:
      "Ex: eu, marido, dois filhos (10 e 6), minha mãe nos finais de semana.",
  },
  {
    key: "rotina" as const,
    title: "Rotina da família",
    description: "Horários, escola/trabalho, divisão de cuidados.",
    placeholder: "Ex: criança escola 7–12h, terapias terça/quinta, jantar 19h.",
  },
  {
    key: "recursos" as const,
    title: "Recursos disponíveis",
    description: "Acompanhamento profissional, escola inclusiva, rede de apoio.",
    placeholder: "Ex: TO semanal, escola inclusiva, vó aposentada que ajuda.",
  },
  {
    key: "dinamica" as const,
    title: "Dinâmica familiar",
    description: "Estilo de comunicação, valores, momentos sensíveis.",
    placeholder:
      "Ex: marido trabalha de turno; eu sou a referência principal de cuidado.",
  },
];

export function FamiliaEditor({ familia }: { familia: FamiliaSecoes }) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-heading text-lg font-medium">Contexto da família</h2>
        <p className="text-sm text-muted-foreground">
          Quem está em volta do membro atípico, como vocês vivem.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {SECOES.map((s) => (
          <SectionEditor
            key={s.key}
            title={s.title}
            description={s.description}
            initialValue={familia[s.key]}
            placeholder={s.placeholder}
            onSave={async (texto) => {
              await saveSecaoFamilia({ campo: s.key, texto });
            }}
          />
        ))}
      </div>
    </div>
  );
}
