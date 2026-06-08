"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Trash2, UserPlus } from "lucide-react";
import { idadeAnos, dataBrParaIso, mascararDataBr, dataIsoParaBr } from "@/lib/idade";

export type Irmao = {
  nome: string;
  data_nascimento: string; // ISO
  brinca_junto: "sim" | "asvezes" | "nao";
};

const BRINCA = [
  { value: "sim", label: "Sim" },
  { value: "asvezes", label: "Às vezes" },
  { value: "nao", label: "Não" },
] as const;

const irmaoSchema = z.object({
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
  brinca_junto: z.enum(["sim", "asvezes", "nao"], { message: "Brincam juntos?" }),
});

const schema = z
  .object({
    tem_irmaos: z.enum(["sim", "nao"], { message: "Responda se há outras crianças" }),
    irmaos: z.array(irmaoSchema),
    observacao: z.string().trim().optional(),
  })
  .refine((d) => d.tem_irmaos !== "sim" || d.irmaos.length >= 1, {
    path: ["irmaos"],
    message: "Adicione ao menos uma criança",
  });

type FormValues = z.infer<typeof schema>;

export type Tela3Initial = {
  irmaos: Array<{ nome: string; data_nascimento: string; brinca_junto: string }>;
  observacao: string;
};

const EMPTY_IRMAO = { nome: "", data_nascimento: "" } as unknown as FormValues["irmaos"][number];

export function Tela3Contexto({
  initial,
  pending,
  onSubmit,
  onPrevious,
}: {
  initial: Tela3Initial;
  pending: boolean;
  onSubmit: (values: FormValues) => void;
  onPrevious: () => void;
}) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tem_irmaos: initial.irmaos.length > 0 ? "sim" : undefined,
      irmaos: initial.irmaos.map((i) => ({
        nome: i.nome,
        data_nascimento: dataIsoParaBr(i.data_nascimento),
        brinca_junto: i.brinca_junto as FormValues["irmaos"][number]["brinca_junto"],
      })),
      observacao: initial.observacao,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "irmaos" });
  const temIrmaos = watch("tem_irmaos");

  // Ao escolher "Sim" sem nenhuma criança ainda, abre a primeira.
  function escolherTem(value: "sim" | "nao", onChange: (v: string) => void) {
    onChange(value);
    if (value === "sim" && fields.length === 0) append(EMPTY_IRMAO);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {errors.tem_irmaos && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.tem_irmaos.message}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Tem outras crianças morando com vocês?</Label>
          <Controller
            name="tem_irmaos"
            control={control}
            render={({ field }) => (
              <ChipGroup label="Outras crianças na casa">
                <Chip
                  selected={field.value === "nao"}
                  onClick={() => escolherTem("nao", field.onChange)}
                  disabled={pending}
                >
                  Não
                </Chip>
                <Chip
                  selected={field.value === "sim"}
                  onClick={() => escolherTem("sim", field.onChange)}
                  disabled={pending}
                >
                  Sim
                </Chip>
              </ChipGroup>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Irmãos que moram junto ajudam nas ideias de brincadeira — dá pra
            incluí-los quando faz sentido.
          </p>
        </div>

        {temIrmaos === "sim" && (
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => {
              const iso = dataBrParaIso(watch(`irmaos.${index}.data_nascimento`) || "");
              const idade = iso ? idadeAnos(iso) : null;
              return (
                <div key={field.id} className="rounded-md border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Criança {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={pending}
                    >
                      <Trash2 aria-hidden="true" /> Remover
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`irmaos.${index}.nome`}>Nome</Label>
                      <Input id={`irmaos.${index}.nome`} {...register(`irmaos.${index}.nome`)} />
                      {errors.irmaos?.[index]?.nome && (
                        <span className="text-xs text-destructive">
                          {errors.irmaos[index]?.nome?.message}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`irmaos.${index}.data_nascimento`}>
                        Data de nascimento{idade != null ? ` · ${idade} anos` : ""}
                      </Label>
                      <Controller
                        name={`irmaos.${index}.data_nascimento`}
                        control={control}
                        render={({ field }) => (
                          <Input
                            id={`irmaos.${index}.data_nascimento`}
                            inputMode="numeric"
                            placeholder="dd/mm/aaaa"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(mascararDataBr(e.target.value))}
                            onBlur={field.onBlur}
                          />
                        )}
                      />
                      {errors.irmaos?.[index]?.data_nascimento && (
                        <span className="text-xs text-destructive">
                          {errors.irmaos[index]?.data_nascimento?.message}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label>Brincam juntos?</Label>
                      <Controller
                        name={`irmaos.${index}.brinca_junto`}
                        control={control}
                        render={({ field }) => (
                          <ChipGroup label="Brincam juntos?">
                            {BRINCA.map((b) => (
                              <Chip
                                key={b.value}
                                selected={field.value === b.value}
                                onClick={() => field.onChange(b.value)}
                                disabled={pending}
                              >
                                {b.label}
                              </Chip>
                            ))}
                          </ChipGroup>
                        )}
                      />
                      {errors.irmaos?.[index]?.brinca_junto && (
                        <span className="text-xs text-destructive">
                          {errors.irmaos[index]?.brinca_junto?.message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {errors.irmaos && !Array.isArray(errors.irmaos) && (
              <span className="text-xs text-destructive">{errors.irmaos.message}</span>
            )}

            <Button type="button" onClick={() => append(EMPTY_IRMAO)} disabled={pending}>
              <UserPlus aria-hidden="true" /> Adicionar outra criança
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observacao">Algo mais sobre a casa que eu deva saber? (opcional)</Label>
          <textarea
            id="observacao"
            rows={3}
            placeholder="Ex.: a avó ajuda nas tardes, meu marido trabalha de turno. Sem pressa — dá pra contar aos poucos."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...register("observacao")}
          />
        </div>

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
