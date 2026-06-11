"use client";

import { saveSecaoFamilia } from "./actions";
import { SectionEditor, type SectionTone } from "./section-editor";
import type { FamiliaSecoes } from "./wrapper";

const SECOES: Array<{
  key: keyof FamiliaSecoes;
  title: string;
  description: string;
  placeholder: string;
  tone: SectionTone;
}> = [
  {
    key: "composicao",
    title: "Quem faz parte da rotina",
    description: "Pessoas em volta no dia a dia.",
    placeholder:
      "Ex: eu, marido, dois filhos (10 e 6), minha mãe nos finais de semana.",
    tone: "comunicacao",
  },
  {
    key: "rotina",
    title: "Como os dias costumam ser",
    description: "Escola, trabalho, terapias, horários que ancoram o dia.",
    placeholder: "Ex: escola 7–12h, terapias terça/quinta, jantar 19h.",
    tone: "rotina",
  },
  {
    key: "recursos",
    title: "Quem está por perto",
    description: "Profissionais, escola, família estendida, apoio próximo.",
    placeholder: "Ex: TO semanal, escola inclusiva, vó aposentada que ajuda.",
    tone: "motor",
  },
  {
    key: "dinamica",
    title: "Como vocês atravessam os dias",
    description: "Estilo de cuidar, comunicação, momentos sensíveis.",
    placeholder:
      "Ex: marido trabalha de turno; eu sou a referência principal de cuidado.",
    tone: "sono",
  },
];

export function FamiliaEditor({ familia }: { familia: FamiliaSecoes }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-heading text-2xl font-medium leading-tight text-foreground">
          A família
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como vocês vivem juntos.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {SECOES.map((s) => (
          <SectionEditor
            key={s.key}
            title={s.title}
            description={s.description}
            initialValue={familia[s.key].texto}
            atualizadoEm={familia[s.key].atualizadoEm}
            placeholder={s.placeholder}
            tone={s.tone}
            onSave={async (texto) => {
              await saveSecaoFamilia({ campo: s.key, texto });
            }}
          />
        ))}
      </div>
    </div>
  );
}
