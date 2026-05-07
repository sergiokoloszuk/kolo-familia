"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto"),
  idade_mae: z.coerce.number().int().min(16, "Idade mínima 16").max(100),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "Use o formato +5511999999999"),
  como_chamar: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export function Tela1Mae({
  initial,
  pending,
  onSubmit,
}: {
  initial: { nome_mae: string; idade_mae: number | null; como_chamar: string; whatsapp_e164: string };
  pending: boolean;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome_mae: initial.nome_mae,
      idade_mae: initial.idade_mae ?? undefined,
      como_chamar: initial.como_chamar,
      whatsapp_e164: initial.whatsapp_e164,
    },
  });

  return (
    <Explanation
      o_que="Estes dados ficam só com você e ajudam a Ayla a te chamar pelo nome."
      por_que="Sem o WhatsApp a Ayla não consegue aparecer onde sua família já está."
      proximo="Em seguida, vamos saber sobre o(s) membro(s) atípico(s) da família."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome_mae">Como você se chama?</Label>
          <Input id="nome_mae" autoComplete="name" {...register("nome_mae")} />
          {errors.nome_mae && (
            <span className="text-xs text-destructive">{errors.nome_mae.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="como_chamar">Apelido (opcional)</Label>
          <Input id="como_chamar" placeholder="Como prefere ser chamada" {...register("como_chamar")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idade_mae">Sua idade</Label>
          <Input id="idade_mae" type="number" inputMode="numeric" {...register("idade_mae")} />
          {errors.idade_mae && (
            <span className="text-xs text-destructive">{errors.idade_mae.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            placeholder="+5511999999999"
            autoComplete="tel"
            {...register("whatsapp_e164")}
          />
          {errors.whatsapp_e164 ? (
            <span className="text-xs text-destructive">{errors.whatsapp_e164.message}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Inclua o código do país (+55) e o DDD.
            </span>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Continuar"}
          </Button>
        </div>
      </form>
    </Explanation>
  );
}

export function Explanation({
  o_que,
  por_que,
  proximo,
  children,
}: {
  o_que: string;
  por_que: string;
  proximo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-1 gap-3 rounded-md bg-muted/50 p-4 text-sm md:grid-cols-3">
        <div>
          <dt className="font-medium text-foreground">O que é esta tela</dt>
          <dd className="text-muted-foreground">{o_que}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Por que importa</dt>
          <dd className="text-muted-foreground">{por_que}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Próximo passo</dt>
          <dd className="text-muted-foreground">{proximo}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}
