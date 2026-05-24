"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus } from "lucide-react";
import { Explanation } from "./tela-1-mae";
import type { Membro } from "../wizard";
import { idadeAnos, dataBrParaIso, mascararDataBr, dataIsoParaBr } from "@/lib/idade";

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
        data_nascimento: z
          .string()
          .trim()
          .refine((v) => {
            const iso = dataBrParaIso(v);
            if (!iso) return false;
            const a = idadeAnos(iso);
            return a !== null && a >= 0 && a <= 120;
          }, "Informe uma data válida (dd/mm/aaaa)"),
        perfil: z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"]),
      }),
    )
    .min(1, "Cadastre pelo menos 1 membro"),
});

type FormValues = z.infer<typeof schema>;

export function Tela2Membros({
  initial,
  dobResponsavel,
  pending,
  onSubmit,
  onRemove,
  onPrevious,
}: {
  initial: Membro[];
  /** Data de nascimento do responsável (ISO) — pra avisar se digitar a mesma. */
  dobResponsavel: string | null;
  pending: boolean;
  onSubmit: (membros: FormValues["membros"]) => void;
  onRemove: (id: string) => void;
  onPrevious: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      membros:
        initial.length > 0
          ? initial.map((m) => ({
              id: m.id,
              nome: m.nome,
              data_nascimento: dataIsoParaBr(m.data_nascimento),
              perfil: m.perfil as FormValues["membros"][number]["perfil"],
            }))
          : [{ nome: "", data_nascimento: "", perfil: "TEA" }],
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
                <Label htmlFor={`membros.${index}.data_nascimento`}>Data de nascimento</Label>
                <Controller
                  name={`membros.${index}.data_nascimento`}
                  control={control}
                  render={({ field }) => (
                    <Input
                      id={`membros.${index}.data_nascimento`}
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(mascararDataBr(e.target.value))}
                      onBlur={field.onBlur}
                    />
                  )}
                />
                {errors.membros?.[index]?.data_nascimento && (
                  <span className="text-xs text-destructive">
                    {errors.membros[index]?.data_nascimento?.message}
                  </span>
                )}
                {dobResponsavel &&
                  dataBrParaIso(watch(`membros.${index}.data_nascimento`) || "") ===
                    dobResponsavel && (
                    <span className="text-xs text-amber-600">
                      Essa é a <strong>sua</strong> data de nascimento. Confirme a
                      data do(a) {watch(`membros.${index}.nome`)?.trim() || "membro"}.
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
          onClick={() => append({ nome: "", data_nascimento: "", perfil: "TEA" })}
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
