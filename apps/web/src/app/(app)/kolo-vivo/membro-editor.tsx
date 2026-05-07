"use client";

import { saveSecaoMembro } from "./actions";
import { SectionEditor } from "./section-editor";
import type { MembroData } from "./wrapper";

const SECOES = [
  {
    key: "essencial" as const,
    title: "Essencial",
    description: "Perfil oficial, diagnósticos formais, forças.",
    placeholder:
      "Ex: TEA nível 1 com laudo de 2023, AH/SD identificada na escola. Forças: memória visual excelente, foco grande quando interesse pega.",
  },
  {
    key: "como_e" as const,
    title: "Como ele/ela é",
    description: "Personalidade, interesses, formas preferidas de comunicação.",
    placeholder:
      "Ex: extrovertido, ama dinossauros e Lego. Comunica melhor com imagens. Não gosta de surpresas.",
  },
  {
    key: "corpo_rotina" as const,
    title: "Corpo & Rotina",
    description: "Sono, alimentação, rotina típica, sensibilidades corporais.",
    placeholder:
      "Ex: dorme 21h–6h. Come bem só com colher. Sensível a etiquetas de roupa.",
  },
  {
    key: "desafios_regulacao" as const,
    title: "Desafios & Regulação",
    description: "Gatilhos conhecidos, sinais de desregulação, o que acalma.",
    placeholder:
      "Ex: gatilhos: barulho alto, transição sem aviso. Sinais: bate as mãos, anda em círculos. Acalma com música baixa e abraço apertado.",
  },
  {
    key: "sensorial" as const,
    title: "Sensorial & Documentos",
    description: "Perfil sensorial, laudos, relatórios anexados.",
    placeholder:
      "Ex: hiperreativo auditivo, hiporeativo proprioceptivo. Laudos: TO 2024-03 (anexo), neuropsicológico 2023-11.",
  },
];

export function MembroEditor({ membro }: { membro: MembroData }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-medium">{membro.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {membro.idade} anos · {membro.perfil}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          Completude: {membro.completude_pct}%
        </div>
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
