"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus } from "lucide-react";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { DIAGNOSTICO_OPCOES, HIPOTESE_OPCOES } from "@/lib/onboarding/diagnostico";
import type { Membro } from "../wizard";
import { idadeAnos, dataBrParaIso, mascararDataBr, dataIsoParaBr } from "@/lib/idade";

const GENEROS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
] as const;

const DIAG_VALUES = ["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"] as const;
const HIP_VALUES = ["TEA", "TDAH", "Dislexia", "AHSD", "Outro"] as const;

const membroSchema = z
  .object({
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
    diagnosticos: z.array(z.enum(DIAG_VALUES)).min(1, "Escolha ao menos um diagnóstico"),
    diagnostico_outro: z.string().trim().optional(),
    hipoteses: z.array(z.enum(HIP_VALUES)).optional().default([]),
    genero: z.enum(["feminino", "masculino"], { message: "Escolha o gênero" }),
  })
  .refine(
    (m) => !m.diagnosticos.includes("Outro") || (m.diagnostico_outro && m.diagnostico_outro.trim().length >= 2),
    { path: ["diagnostico_outro"], message: "Detalhe qual é o outro diagnóstico" },
  );

const schema = z.object({
  membros: z.array(membroSchema).min(1, "Cadastre pelo menos 1 criança"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_MEMBRO = {
  nome: "",
  data_nascimento: "",
  diagnosticos: [] as string[],
  diagnostico_outro: "",
  hipoteses: [] as string[],
} as unknown as FormValues["membros"][number];

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
              diagnosticos: (m.diagnosticos && m.diagnosticos.length > 0
                ? m.diagnosticos
                : m.perfil
                  ? [m.perfil]
                  : []) as FormValues["membros"][number]["diagnosticos"],
              diagnostico_outro: m.diagnostico_outro ?? "",
              hipoteses: (m.hipoteses ?? []) as FormValues["membros"][number]["hipoteses"],
              genero:
                m.genero === "feminino" || m.genero === "masculino"
                  ? m.genero
                  : (undefined as unknown as FormValues["membros"][number]["genero"]),
            }))
          : [EMPTY_MEMBRO],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "membros" });
  const [removingId, setRemovingId] = useState<string | null>(null);

  /** Liga/desliga um valor numa lista (multi-seleção). */
  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

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
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit((v) => onSubmit(v.membros))} className="flex flex-col gap-4" noValidate>
        {errors.membros && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Faltou conferir alguns campos das crianças — veja os destaques em vermelho abaixo.
          </div>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="rounded-md border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Criança {index + 1}</span>
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

              <div className="flex flex-col gap-2 md:col-span-3">
                <Label>Diagnóstico</Label>
                <Controller
                  name={`membros.${index}.diagnosticos`}
                  control={control}
                  render={({ field }) => {
                    const sel = field.value ?? [];
                    return (
                      <ChipGroup label="Diagnóstico" multiSelect>
                        {DIAGNOSTICO_OPCOES.map((p) => (
                          <Chip
                            key={p.value}
                            multiSelect
                            selected={sel.includes(p.value)}
                            onClick={() => field.onChange(toggle(sel, p.value))}
                            disabled={pending}
                          >
                            {p.label}
                          </Chip>
                        ))}
                      </ChipGroup>
                    );
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Pode marcar mais de um (ex.: TEA e TDAH). Se já tem diagnóstico,
                  me conta; se ainda está investigando, também tem espaço — eu não
                  diagnostico, só registro o que você me traz.
                </p>
                {errors.membros?.[index]?.diagnosticos && (
                  <span className="text-xs text-destructive">
                    {errors.membros[index]?.diagnosticos?.message}
                  </span>
                )}

                {(watch(`membros.${index}.diagnosticos`) ?? []).includes("Outro") && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`membros.${index}.diagnostico_outro`}>
                      Qual outro diagnóstico?
                    </Label>
                    <Input
                      id={`membros.${index}.diagnostico_outro`}
                      placeholder="Ex.: Síndrome de Down, TOD, deficiência intelectual"
                      {...register(`membros.${index}.diagnostico_outro`)}
                    />
                    {errors.membros?.[index]?.diagnostico_outro && (
                      <span className="text-xs text-destructive">
                        {errors.membros[index]?.diagnostico_outro?.message}
                      </span>
                    )}
                  </div>
                )}

                {(watch(`membros.${index}.diagnosticos`) ?? []).includes("EmInvestigacao") && (
                  <div className="flex flex-col gap-2 rounded-md border border-input bg-muted/30 p-3">
                    <Label>Qual a hipótese em investigação?</Label>
                    <Controller
                      name={`membros.${index}.hipoteses`}
                      control={control}
                      render={({ field }) => {
                        const sel = field.value ?? [];
                        return (
                          <ChipGroup label="Hipótese em investigação" multiSelect>
                            {HIPOTESE_OPCOES.map((p) => (
                              <Chip
                                key={p.value}
                                multiSelect
                                selected={sel.includes(p.value)}
                                onClick={() => field.onChange(toggle(sel, p.value))}
                                disabled={pending}
                              >
                                {p.label}
                              </Chip>
                            ))}
                          </ChipGroup>
                        );
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      O que estão suspeitando, mesmo sem fechar o diagnóstico.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 md:col-span-3">
                <Label>Gênero</Label>
                <Controller
                  name={`membros.${index}.genero`}
                  control={control}
                  render={({ field }) => (
                    <ChipGroup label="Gênero">
                      {GENEROS.map((g) => (
                        <Chip
                          key={g.value}
                          selected={field.value === g.value}
                          onClick={() => field.onChange(g.value)}
                          disabled={pending}
                        >
                          {g.label}
                        </Chip>
                      ))}
                    </ChipGroup>
                  )}
                />
                {errors.membros?.[index]?.genero && (
                  <span className="text-xs text-destructive">
                    {errors.membros[index]?.genero?.message}
                  </span>
                )}
                <p className="text-xs text-muted-foreground">
                  Me ajuda a falar do jeito certo. Dá pra mudar depois.
                </p>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" onClick={() => append(EMPTY_MEMBRO)} disabled={pending}>
          <UserPlus aria-hidden="true" /> Adicionar outra criança
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
    </div>
  );
}
