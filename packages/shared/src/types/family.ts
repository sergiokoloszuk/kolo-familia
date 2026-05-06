import { z } from "zod";

export const PerfilNeurodivergencia = z.enum([
  "TEA",
  "TDAH",
  "Dislexia",
  "AHSD",
  "Outro",
  "EmInvestigacao",
]);
export type PerfilNeurodivergencia = z.infer<typeof PerfilNeurodivergencia>;

export const MembroAtipico = z.object({
  id: z.string().uuid(),
  family_account_id: z.string().uuid(),
  nome: z.string(),
  idade: z.number().int().min(0).max(120),
  perfil: PerfilNeurodivergencia,
  diagnosticos_formais: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type MembroAtipico = z.infer<typeof MembroAtipico>;

export const FamilyAccount = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  nome_familia: z.string().nullable(),
  whatsapp_e164: z.string().regex(/^\+\d{8,15}$/),
  timezone: z.string().default("America/Sao_Paulo"),
  created_at: z.string().datetime(),
});
export type FamilyAccount = z.infer<typeof FamilyAccount>;
