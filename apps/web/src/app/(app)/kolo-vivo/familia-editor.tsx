"use client";

import { saveSecaoFamilia } from "./actions";
import { SectionEditor } from "./section-editor";
import type { FamiliaSecoes } from "./wrapper";

const SECOES = [
  {
    key: "composicao" as const,
    title: "Quem mora junto",
    description: "Pessoas em volta no dia a dia.",
    placeholder:
      "Ex: eu, marido, dois filhos (10 e 6), minha mãe nos finais de semana.",
  },
  {
    key: "rotina" as const,
    title: "Como a semana acontece",
    description: "Escola, trabalho, terapias, horários que ancoram o dia.",
    placeholder: "Ex: criança escola 7–12h, terapias terça/quinta, jantar 19h.",
  },
  {
    key: "recursos" as const,
    title: "Quem ajuda",
    description: "Profissionais, escola, família estendida, apoio próximo.",
    placeholder: "Ex: TO semanal, escola inclusiva, vó aposentada que ajuda.",
  },
  {
    key: "dinamica" as const,
    title: "Como vocês se cuidam",
    description: "Estilo de cuidar, comunicação, momentos sensíveis.",
    placeholder:
      "Ex: marido trabalha de turno; eu sou a referência principal de cuidado.",
  },
];

export function FamiliaEditor({ familia }: { familia: FamiliaSecoes }) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-heading text-2xl font-medium leading-tight text-foreground">
          A família
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como vocês vivem juntos.
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
