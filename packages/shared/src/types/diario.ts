import { z } from "zod";

export const QuemEstava = z.enum([
  "mae",
  "pai",
  "avo_a",
  "avo_o",
  "irmao_a",
  "babá",
  "professor_a",
  "outro",
]);
export type QuemEstava = z.infer<typeof QuemEstava>;

export const EstadoAdulto = z.enum([
  "calmo",
  "firme",
  "cansado",
  "ansioso",
  "impaciente",
]);
export type EstadoAdulto = z.infer<typeof EstadoAdulto>;

export const ReacaoAdulto = z.enum([
  "acolhedor",
  "esperou",
  "interveio",
  "impositivo",
  "chamou_ajuda",
  "outro",
]);
export type ReacaoAdulto = z.infer<typeof ReacaoAdulto>;

export const CamadaA = z.object({
  conquista: z.string().nullable(),
  desafio: z.string().nullable(),
  observacao_livre: z.string().nullable(),
});
export type CamadaA = z.infer<typeof CamadaA>;

export const CamadaB = z.object({
  quem_estava: QuemEstava.nullable(),
  quem_estava_livre: z.string().nullable(),
  estado_adulto: EstadoAdulto.nullable(),
  reacao_adulto: ReacaoAdulto.nullable(),
});
export type CamadaB = z.infer<typeof CamadaB>;

export const Diario = z.object({
  id: z.string().uuid(),
  family_account_id: z.string().uuid(),
  membro_atipico_id: z.string().uuid(),
  data: z.string().date(),
  camada_a: CamadaA,
  camada_b: CamadaB.nullable(),
  origem: z.enum(["app", "ayla"]),
  incompleto: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type Diario = z.infer<typeof Diario>;
