"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const schema = z.object({
  aceitou_termos: z.literal(true, { message: "É preciso aceitar os termos para continuar" }),
  optin_ayla: z.boolean(),
});

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
    // LGPD: nenhum dos dois pode vir pré-marcado, e são consentimentos separados.
    defaultValues: { aceitou_termos: false, optin_ayla: false },
  });

  return (
    <div className="flex flex-col gap-4">
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
                Aceito os{" "}
                <a
                  href="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-purple underline underline-offset-2"
                >
                  termos de uso
                </a>{" "}
                e a{" "}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-purple underline underline-offset-2"
                >
                  política de privacidade
                </a>
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                O Kolo Família não substitui profissionais da saúde. Seus dados são
                tratados com segurança, e você pode exportar ou excluir tudo quando
                quiser, direto na sua conta.
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
                Autorizo a Ayla a me mandar mensagem no WhatsApp{" "}
                <span className="text-brand-purple">(recomendado)</span>
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Assim, além de pedir orientações e dicas à Ayla a qualquer hora,
                você deixa ela acompanhar de perto o dia a dia — ela pergunta como
                foi o dia, comemora junto as conquistas e apoia nos perrengues, e
                com isso acompanha melhor a evolução do seu filho ou sua filha. No
                máximo 2 mensagens por dia, no horário que você escolher. Mudou de
                ideia? É só desativar essa opção na sua conta quando quiser.
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
    </div>
  );
}
