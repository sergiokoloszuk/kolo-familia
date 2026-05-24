"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Explanation } from "./tela-1-mae";

type FormValues = {
  composicao: string;
  rotina: string;
  recursos: string;
  dinamica: string;
};

export function Tela3Contexto({
  initial,
  pending,
  onSubmit,
  onPrevious,
}: {
  initial: FormValues;
  pending: boolean;
  onSubmit: (values: FormValues) => void;
  onPrevious: () => void;
}) {
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: initial });

  return (
    <Explanation
      o_que="O contexto que rodeia a família — quem mora junto, o ritmo da casa, recursos e dinâmica."
      por_que="As skills usam isso para sugerir estratégias realistas, não receita de revista."
      proximo="Em seguida, os sinais e a rotina de cada pessoa atípica."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field
          id="composicao"
          label="Quem mora junto"
          placeholder="Ex: eu, meu marido, dois filhos (10 e 6 anos), minha mãe nos finais de semana."
          register={register("composicao")}
        />

        <Field
          id="rotina"
          label="Rotina da casa"
          placeholder="Ex: todos jantam por volta das 19h, dormem cedo, fins de semana mais livres, a avó ajuda nas tardes. (a rotina de cada criança vem na próxima tela)"
          register={register("rotina")}
        />

        <Field
          id="recursos"
          label="Recursos disponíveis"
          placeholder="Ex: terapia ocupacional semanal, escola inclusiva, vó aposentada que ajuda."
          register={register("recursos")}
        />

        <Field
          id="dinamica"
          label="Dinâmica familiar"
          placeholder="Ex: meu marido trabalha de turno, eu sou a referência principal de cuidado."
          register={register("dinamica")}
        />

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

function Field({
  id,
  label,
  placeholder,
  register,
}: {
  id: string;
  label: string;
  placeholder: string;
  register: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        placeholder={placeholder}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        {...register}
      />
    </div>
  );
}
