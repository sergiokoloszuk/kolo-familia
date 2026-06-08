"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { inferGeneroDePalavra } from "@/lib/ayla/pronomes";
import { idadeAnos, dataBrParaIso, mascararDataBr, dataIsoParaBr } from "@/lib/idade";

const schema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto"),
  data_nascimento_mae: z
    .string()
    .trim()
    .refine((v) => {
      const iso = dataBrParaIso(v);
      if (!iso) return false;
      const a = idadeAnos(iso);
      return a !== null && a >= 16 && a <= 100;
    }, "Informe sua data de nascimento (idade entre 16 e 100)"),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+55\d{10,11}$/, "Informe o DDD + número, ex: (11) 99999-9999"),
  // avó/avô são chips separados — o gênero do cuidador fica implícito no chip.
  // Em "outro", o grau livre (tia, madrinha...) também já revela o gênero pela palavra.
  papel: z.enum(["mae", "pai", "avo", "avoh", "outro"], {
    message: "Selecione sua relação com a criança",
  }),
  papel_outro: z.string().trim().optional(),
  genero_responsavel: z.enum(["masculino", "feminino", "neutro"]).optional(),
}).refine(
  (d) => d.papel !== "outro" || (d.papel_outro && d.papel_outro.trim().length >= 2),
  { path: ["papel_outro"], message: "Diga qual é o grau de parentesco" },
).refine(
  // Em "outro": se a palavra não revela o gênero (ex.: "responsável", "tutor"),
  // exige a escolha explícita. Se revela (tia, tio, madrinha...), dispensa.
  (d) => {
    if (d.papel !== "outro") return true;
    const grau = d.papel_outro?.trim() ?? "";
    if (grau.length < 2) return true; // outra mensagem já cobre
    if (inferGeneroDePalavra(grau)) return true;
    return !!d.genero_responsavel;
  },
  { path: ["genero_responsavel"], message: "Me diz se é no feminino ou masculino" },
);

const PARENTESCOS = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avó" },
  { value: "avoh", label: "Avô" },
  { value: "outro", label: "Outro(a) responsável" },
] as const;

const GENEROS_RESPONSAVEL = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "neutro", label: "Prefiro não dizer" },
] as const;

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
  initial: {
    nome_mae: string;
    data_nascimento_mae: string;
    whatsapp_e164: string;
    papel: string;
    papel_outro?: string | null;
    genero_responsavel?: string | null;
  };
  pending: boolean;
  onSubmit: (values: FormValues) => void;
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
      nome_mae: initial.nome_mae,
      data_nascimento_mae: dataIsoParaBr(initial.data_nascimento_mae),
      whatsapp_e164: initial.whatsapp_e164,
      papel: (initial.papel || "") as FormValues["papel"],
      papel_outro: initial.papel_outro ?? "",
      // "" quebra o z.enum().optional() — precisa ser undefined quando vazio.
      genero_responsavel: (initial.genero_responsavel || undefined) as FormValues["genero_responsavel"],
    },
  });

  const papel = watch("papel");
  const papelOutro = watch("papel_outro");
  // Só perguntamos o gênero quando a palavra digitada não revela (ex.: "responsável").
  const generoIndefinido =
    papel === "outro" &&
    (papelOutro?.trim().length ?? 0) >= 2 &&
    inferGeneroDePalavra(papelOutro ?? "") === null;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Faltou conferir:{" "}
            {Object.values(errors)
              .map((e) => e?.message)
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome_mae">Como você se chama?</Label>
          <Input id="nome_mae" autoComplete="name" {...register("nome_mae")} />
          {errors.nome_mae && (
            <span className="text-xs text-destructive">{errors.nome_mae.message}</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Qual é a sua relação com a criança?</Label>
          <Controller
            name="papel"
            control={control}
            render={({ field }) => (
              <ChipGroup label="Sua relação com a criança">
                {PARENTESCOS.map((p) => (
                  <Chip
                    key={p.value}
                    selected={field.value === p.value}
                    onClick={() => field.onChange(p.value)}
                    disabled={pending}
                  >
                    {p.label}
                  </Chip>
                ))}
              </ChipGroup>
            )}
          />
          {errors.papel && (
            <span className="text-xs text-destructive">{errors.papel.message}</span>
          )}
        </div>

        {papel === "outro" && (
          <div className="flex flex-col gap-3 rounded-md border border-input bg-muted/30 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="papel_outro">Qual é o grau de parentesco?</Label>
              <Input
                id="papel_outro"
                placeholder="Ex.: tia, madrinha, tio, padrinho"
                {...register("papel_outro")}
              />
              {errors.papel_outro && (
                <span className="text-xs text-destructive">{errors.papel_outro.message}</span>
              )}
            </div>

            {generoIndefinido && (
              <div className="flex flex-col gap-2">
                <Label>Como a Ayla deve falar com você?</Label>
                <Controller
                  name="genero_responsavel"
                  control={control}
                  render={({ field }) => (
                    <ChipGroup label="Seu gênero">
                      {GENEROS_RESPONSAVEL.map((g) => (
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
                {errors.genero_responsavel && (
                  <span className="text-xs text-destructive">
                    {errors.genero_responsavel.message}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_nascimento_mae">Sua data de nascimento</Label>
          <Controller
            name="data_nascimento_mae"
            control={control}
            render={({ field }) => (
              <Input
                id="data_nascimento_mae"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(mascararDataBr(e.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />
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
              Preciso do seu WhatsApp pra te acompanhar no dia a dia. (O +55 entra automático.)
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Esses dados ficam só com você.</p>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Continuar"}
          </Button>
        </div>
      </form>
    </div>
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
