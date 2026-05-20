"use client";

import { saveSecaoMembro } from "./actions";
import { SectionEditor } from "./section-editor";
import type { MembroData } from "./wrapper";

const SECOES = [
  {
    key: "essencial" as const,
    title: "Quem ele/ela é, oficialmente",
    description: "Diagnósticos, forças, o que está no papel.",
    placeholder:
      "Ex: TEA nível 1 com laudo de 2023, AH/SD identificada na escola. Forças: memória visual excelente, foco grande quando interesse pega.",
  },
  {
    key: "como_e" as const,
    title: "Como ele/ela é",
    description: "Personalidade, interesses, como prefere se comunicar.",
    placeholder:
      "Ex: extrovertido, ama dinossauros e Lego. Comunica melhor com imagens. Não gosta de surpresas.",
  },
  {
    key: "corpo_rotina" as const,
    title: "Sono, comida, corpo",
    description: "Como come, como dorme, sensibilidades do corpo.",
    placeholder:
      "Ex: dorme 21h–6h. Come bem só com colher. Sensível a etiquetas de roupa.",
  },
  {
    key: "desafios_regulacao" as const,
    title: "O que pesa, o que acalma",
    description: "Sinais quando está difícil, e o que ajuda a passar.",
    placeholder:
      "Ex: gatilhos: barulho alto, transição sem aviso. Sinais: bate as mãos, anda em círculos. Acalma com música baixa e abraço apertado.",
  },
  {
    key: "sensorial" as const,
    title: "Sentidos e laudos",
    description: "Como o corpo percebe o mundo, terapeutas, anexos.",
    placeholder:
      "Ex: hiperreativo auditivo, hiporeativo proprioceptivo. Laudos: TO 2024-03 (anexo), neuropsicológico 2023-11.",
  },
];

export function MembroEditor({ membro }: { membro: MembroData }) {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-heading text-2xl font-medium leading-tight text-foreground">
          {membro.nome}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {membro.idade} anos · {membro.perfil}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {SECOES.map((s) => (
          <SectionEditor
            key={s.key}
            title={s.title}
            description={s.description}
            initialValue={membro[s.key]}
            placeholder={s.placeholder}
            onSave={async (texto) => {
              await saveSecaoMembro({ membro_id: membro.id, campo: s.key, texto });
            }}
          />
        ))}
      </div>
    </div>
  );
}
