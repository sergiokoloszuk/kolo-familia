"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { idadeAnos } from "@/lib/idade";

const schema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto"),
  data_nascimento_mae: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe sua data de nascimento")
    .refine((d) => {
      const a = idadeAnos(d);
      return a !== null && a >= 16 && a <= 100;
    }, "Idade deve estar entre 16 e 100 anos"),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+55\d{10,11}$/, "Informe o DDD + número, ex: (11) 99999-9999"),
  como_chamar: z.string().trim().optional(),
  papel: z.enum(["mae", "pai", "avo", "outro"], {
    message: "Selecione sua relação com a criança",
  }),
});

type FormValues = z.infer<typeof schema>;

// ---- Máscara de telefone BR: input mostra (nn) nnnnn-nnnn, armazena E.164 (+55...) ----
function digitsFromE164(e164: string): string {
  let d = (e164 ?? "").replace(/\D/g, "");
  if (d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

function maskTelefone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskFromE164(e164: string): string {
  return maskTelefone(digitsFromE164(e164));
}

function maskedToE164(masked: string): string {
  const d = masked.replace(/\D/g, "").slice(0, 11);
  return d ? `+55${d}` : "";
}

export function Tela1Mae({
  initial,
  pending,
  onSubmit,
}: {
  initial: { nome_mae: string; data_nascimento_mae: string; como_chamar: string; whatsapp_e164: string; papel: string };
  pending: boolean;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome_mae: initial.nome_mae,
      data_nascimento_mae: initial.data_nascimento_mae ?? "",
      como_chamar: initial.como_chamar,
      whatsapp_e164: initial.whatsapp_e164,
      papel: (initial.papel || "") as FormValues["papel"],
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
          <Input id="como_chamar" placeholder="Como prefere que a gente te chame" {...register("como_chamar")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="papel">Qual é a sua relação com a criança?</Label>
          <select
            id="papel"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            {...register("papel")}
          >
            <option value="">Selecione...</option>
            <option value="mae">Mãe</option>
            <option value="pai">Pai</option>
            <option value="avo">Avó ou avô</option>
            <option value="outro">Outro(a) responsável</option>
          </select>
          {errors.papel && (
            <span className="text-xs text-destructive">{errors.papel.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_nascimento_mae">Sua data de nascimento</Label>
          <Input id="data_nascimento_mae" type="date" {...register("data_nascimento_mae")} />
          {errors.data_nascimento_mae && (
            <span className="text-xs text-destructive">{errors.data_nascimento_mae.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Controller
            name="whatsapp_e164"
            control={control}
            render={({ field }) => (
              <Input
                id="whatsapp"
                placeholder="(11) 99999-9999"
                inputMode="numeric"
                autoComplete="tel"
                value={maskFromE164(field.value ?? "")}
                onChange={(e) => field.onChange(maskedToE164(e.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.whatsapp_e164 ? (
            <span className="text-xs text-destructive">{errors.whatsapp_e164.message}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Use DDD + número. O código do país (+55) entra automaticamente.
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
