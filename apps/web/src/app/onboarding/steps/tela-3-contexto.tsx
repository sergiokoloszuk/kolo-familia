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
      o_que="O contexto que rodeia o membro atípico — pai, avós, irmãos, rotina, recursos."
      por_que="As skills usam isso para sugerir estratégias realistas, não receita de revista."
      proximo="Em seguida, três sinais iniciais por pessoa atípica."
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
          label="Como é a rotina típica"
          placeholder="Ex: criança vai pra escola das 7h às 12h, terapias às terças e quintas, jantar 19h."
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
