"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus } from "lucide-react";
import { Explanation } from "./tela-1-mae";
import type { Membro } from "../wizard";

const PERFIS = [
  { value: "TEA", label: "TEA" },
  { value: "TDAH", label: "TDAH" },
  { value: "Dislexia", label: "Dislexia" },
  { value: "AHSD", label: "AH/SD" },
  { value: "Outro", label: "Outro" },
  { value: "EmInvestigacao", label: "Em investigação" },
] as const;

const schema = z.object({
  membros: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        nome: z.string().trim().min(2, "Nome muito curto"),
        idade: z.coerce.number().int().min(0).max(120),
        perfil: z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"]),
      }),
    )
    .min(1, "Cadastre pelo menos 1 membro"),
});

type FormValues = z.infer<typeof schema>;

export function Tela2Membros({
  initial,
  pending,
  onSubmit,
  onRemove,
  onPrevious,
}: {
  initial: Membro[];
  pending: boolean;
  onSubmit: (membros: FormValues["membros"]) => void;
  onRemove: (id: string) => void;
  onPrevious: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      membros:
        initial.length > 0
          ? initial.map((m) => ({
              id: m.id,
              nome: m.nome,
              idade: m.idade,
              perfil: m.perfil as FormValues["membros"][number]["perfil"],
            }))
          : [{ nome: "", idade: undefined as unknown as number, perfil: "TEA" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "membros" });
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleRemoveAt(index: number) {
    const id = fields[index].id;
    if (id) {
      setRemovingId(id);
      onRemove(id);
    }
    remove(index);
    setRemovingId(null);
  }

  return (
    <Explanation
      o_que="Quem é o foco do cuidado. Pode ser mais de uma pessoa atípica na mesma família."
      por_que="A Ayla precisa saber sobre quem ela está te perguntando. As skills personalizam por aqui."
      proximo="Em seguida, o contexto familiar (quem mais está em volta)."
    >
      <form onSubmit={handleSubmit((v) => onSubmit(v.membros))} className="flex flex-col gap-4" noValidate>
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-md border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Pessoa {index + 1}</span>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAt(index)}
                  disabled={pending || removingId === field.id}
                >
                  <Trash2 aria-hidden="true" /> Remover
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label htmlFor={`membros.${index}.nome`}>Nome</Label>
                <Input id={`membros.${index}.nome`} {...register(`membros.${index}.nome`)} />
                {errors.membros?.[index]?.nome && (
                  <span className="text-xs text-destructive">
                    {errors.membros[index]?.nome?.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`membros.${index}.idade`}>Idade</Label>
                <Input
                  id={`membros.${index}.idade`}
                  type="number"
                  inputMode="numeric"
                  {...register(`membros.${index}.idade`)}
                />
                {errors.membros?.[index]?.idade && (
                  <span className="text-xs text-destructive">
                    {errors.membros[index]?.idade?.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-3">
                <Label htmlFor={`membros.${index}.perfil`}>Perfil</Label>
                <select
                  id={`membros.${index}.perfil`}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  {...register(`membros.${index}.perfil`)}
                >
                  {PERFIS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => append({ nome: "", idade: undefined as unknown as number, perfil: "TEA" })}
          disabled={pending}
        >
          <UserPlus aria-hidden="true" /> Adicionar mais um(a) atípico(a) na família
        </Button>

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
