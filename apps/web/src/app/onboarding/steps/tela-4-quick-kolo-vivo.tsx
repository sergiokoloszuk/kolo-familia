"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Explanation } from "./tela-1-mae";
import type { Membro } from "../wizard";

type FormValues = {
  porMembro: {
    membro_id: string;
    desafios: { value: string }[];
    interesses: { value: string }[];
    conquista: string;
    rotina: string;
  }[];
};

export function Tela4QuickKoloVivo({
  membros,
  pending,
  onSubmit,
  onPrevious,
}: {
  membros: Membro[];
  pending: boolean;
  onSubmit: (
    data: {
      membro_id: string;
      desafios: string[];
      interesses: string[];
      conquista?: string;
      rotina?: string;
    }[],
  ) => void;
  onPrevious: () => void;
}) {
  const { register, control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      porMembro: membros.map((m) => ({
        membro_id: m.id,
        desafios: [{ value: "" }, { value: "" }, { value: "" }],
        interesses: [{ value: "" }, { value: "" }, { value: "" }],
        conquista: "",
        rotina: "",
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: "porMembro" });

  function submit(values: FormValues) {
    const out = values.porMembro.map((p) => ({
      membro_id: p.membro_id,
      desafios: p.desafios.map((d) => d.value).filter((s) => s.trim().length > 0),
      interesses: p.interesses.map((i) => i.value).filter((s) => s.trim().length > 0),
      conquista: p.conquista.trim() || undefined,
      rotina: p.rotina.trim() || undefined,
    }));
    onSubmit(out);
  }

  return (
    <Explanation
      o_que="Para cada pessoa atípica: desafios, interesses, uma conquista e como é o dia dela."
      por_que="Isso já alimenta o Kolo Vivo dela e deixa a primeira conversa com a Ayla mais útil. A rotina aqui é a de cada criança — pode ser diferente entre os filhos."
      proximo="Em seguida, termos de uso e a permissão pra Ayla aparecer no WhatsApp."
    >
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-6" noValidate>
        {fields.map((field, mi) => {
          const membro = membros[mi];
          return (
            <fieldset key={field.id} className="rounded-md border p-4">
              <legend className="px-2 text-sm font-medium">{membro.nome}</legend>

              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-sm font-medium">3 desafios atuais</Label>
                  <div className="mt-2 flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={i}
                        placeholder={`Desafio ${i + 1}`}
                        {...register(`porMembro.${mi}.desafios.${i}.value`)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">3 interesses fortes</Label>
                  <div className="mt-2 flex flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <Input
                        key={i}
                        placeholder={`Interesse ${i + 1}`}
                        {...register(`porMembro.${mi}.interesses.${i}.value`)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`conquista-${mi}`} className="text-sm font-medium">
                    Uma conquista recente (opcional)
                  </Label>
                  <Input
                    id={`conquista-${mi}`}
                    placeholder="Algo que você quer celebrar"
                    className="mt-2"
                    {...register(`porMembro.${mi}.conquista`)}
                  />
                </div>

                <div>
                  <Label htmlFor={`rotina-${mi}`} className="text-sm font-medium">
                    Como é o dia dela? (opcional)
                  </Label>
                  <textarea
                    id={`rotina-${mi}`}
                    rows={2}
                    placeholder="Ex: escola de manhã, terapia ter/qui, custa pegar no sono, come devagar."
                    className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register(`porMembro.${mi}.rotina`)}
                  />
                </div>
              </div>
            </fieldset>
          );
        })}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onPrevious} disabled={pending}>
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Continuar"}
          </Button>
        </div>
      </form>
    </Explanation>
  );
}
