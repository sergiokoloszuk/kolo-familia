"use client";

import { saveSecaoMembro } from "./actions";
import { SectionEditor, type SectionTone } from "./section-editor";
import type { MembroData } from "./wrapper";

type SecaoConfig = {
  key: keyof Pick<
    MembroData,
    "essencial" | "como_e" | "corpo_rotina" | "desafios_regulacao" | "sensorial"
  >;
  title: string;
  description: string;
  placeholder: string;
  tone: SectionTone;
};

/**
 * Títulos interpolados com o nome do membro — os capítulos do retrato
 * carregam a identidade da pessoa, não rótulos genéricos.
 */
function getSecoes(nome: string): SecaoConfig[] {
  return [
    {
      key: "essencial",
      title: `O básico sobre ${nome}`,
      description: "Diagnósticos, forças, o que está no papel.",
      placeholder:
        "Ex: TEA nível 1 com laudo de 2023, AH/SD identificada na escola. Forças: memória visual excelente, foco grande quando interesse pega.",
      tone: "foco",
    },
    {
      key: "como_e",
      title: `O jeito de ${nome}`,
      description: "Personalidade, interesses, como prefere se comunicar.",
      placeholder:
        "Ex: extrovertido, ama dinossauros e Lego. Comunica melhor com imagens. Não gosta de surpresas.",
      tone: "social",
    },
    {
      key: "corpo_rotina",
      title: "O corpo e o dia a dia",
      description: "Como come, como dorme, sensibilidades do corpo.",
      placeholder:
        "Ex: dorme 21h–6h. Come bem só com colher. Sensível a etiquetas de roupa.",
      tone: "alimentacao",
    },
    {
      key: "desafios_regulacao",
      title: "O que ajuda — e o que pesa",
      description: "Sinais quando está difícil, e o que ajuda a passar.",
      placeholder:
        "Ex: gatilhos: barulho alto, transição sem aviso. Sinais: bate as mãos, anda em círculos. Acalma com música baixa e abraço apertado.",
      tone: "emocao",
    },
    {
      key: "sensorial",
      title: "Sensações e acompanhamentos",
      description: "Como o corpo percebe o mundo, terapeutas, anexos.",
      placeholder:
        "Ex: hiperreativo auditivo, hiporeativo proprioceptivo. Laudos: TO 2024-03 (anexo), neuropsicológico 2023-11.",
      tone: "sensorial",
    },
  ];
}

export function MembroEditor({ membro }: { membro: MembroData }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-heading text-2xl font-medium leading-tight text-foreground">
          {membro.nome}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {membro.idade} anos · {membro.perfil}
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {getSecoes(membro.nome).map((s) => (
          <SectionEditor
            key={s.key}
            title={s.title}
            description={s.description}
            initialValue={membro[s.key].texto}
            atualizadoEm={membro[s.key].atualizadoEm}
            placeholder={s.placeholder}
            tone={s.tone}
            onSave={async (texto) => {
              await saveSecaoMembro({ membro_id: membro.id, campo: s.key, texto });
            }}
          />
        ))}
      </div>
    </div>
  );
}
