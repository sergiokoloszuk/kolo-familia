"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Explanation } from "./tela-1-mae";

const schema = z.object({
  aceitou_termos: z.literal(true, { message: "É preciso aceitar os termos para continuar" }),
  optin_ayla: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function Tela5Termos({
  pending,
  onSubmit,
  onPrevious,
}: {
  pending: boolean;
  onSubmit: (values: { aceitou_termos: true; optin_ayla: boolean }) => void;
  onPrevious: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ aceitou_termos: boolean; optin_ayla: boolean }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { aceitou_termos: false, optin_ayla: true },
  });

  return (
    <Explanation
      o_que="Aceite dos termos e a permissão para a Ayla mandar mensagem no WhatsApp."
      por_que="LGPD pede consentimento explícito separado para o canal de WhatsApp. Você pode revogar a qualquer momento."
      proximo="Última tela: confirmação e início do trial de 30 dias."
    >
      <form
        onSubmit={handleSubmit((v) => onSubmit(v as { aceitou_termos: true; optin_ayla: boolean }))}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="rounded-md border p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" {...register("aceitou_termos")} />
            <span>
              <Label htmlFor="" className="font-medium">
                Aceito os termos de uso e a política de privacidade
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                O Kolo Família não substitui profissionais da saúde. Os dados ficam
                criptografados em repouso. Você pode pedir exportação ou exclusão a
                qualquer momento.
              </p>
            </span>
          </label>
          {errors.aceitou_termos && (
            <p className="mt-2 text-xs text-destructive">{errors.aceitou_termos.message}</p>
          )}
        </div>

        <div className="rounded-md border p-4">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" {...register("optin_ayla")} />
            <span>
              <Label htmlFor="" className="font-medium">
                Autorizo a Ayla a me mandar mensagem no WhatsApp
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                No máximo 2 mensagens proativas por dia, no horário que você escolher.
                Pode pausar com <code>PAUSAR</code> ou desativar com <code>SAIR</code>.
              </p>
            </span>
          </label>
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
    </Explanation>
  );
}
