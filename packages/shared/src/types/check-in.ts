import { z } from "zod";

/**
 * Escalas de check-in — PRD §7.15.4
 */
export const EscalaEmocional = z.enum([
  "muito_bem",
  "bem",
  "neutro",
  "dificil",
  "muito_dificil",
]);
export type EscalaEmocional = z.infer<typeof EscalaEmocional>;

export const EscalaEnergia = z.enum([
  "cheia",
  "descansada",
  "razoavel",
  "cansada",
  "exausta",
]);
export type EscalaEnergia = z.infer<typeof EscalaEnergia>;

export const CheckInDiario = z.object({
  id: z.string().uuid(),
  family_account_id: z.string().uuid(),
  membro_atipico_id: z.string().uuid().nullable(),
  data: z.string().date(),
  escala_emocional_mae: EscalaEmocional,
  escala_emocional_membro: EscalaEmocional.nullable(),
  origem: z.enum(["app", "ayla"]),
  created_at: z.string().datetime(),
});
export type CheckInDiario = z.infer<typeof CheckInDiario>;

export const CheckInSemanal = z.object({
  id: z.string().uuid(),
  family_account_id: z.string().uuid(),
  membro_atipico_id: z.string().uuid().nullable(),
  semana_inicio: z.string().date(),
  emocional_mae: EscalaEmocional,
  energia_mae: EscalaEnergia,
  emocional_membro: EscalaEmocional.nullable(),
  energia_membro: EscalaEnergia.nullable(),
  comentario: z.string().nullable(),
  reflexao_o_que_faria_diferente: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type CheckInSemanal = z.infer<typeof CheckInSemanal>;

/**
 * DASS-21 — PRD §7.15.3
 * 21 itens, escala 0-3, três dimensões.
 */
export const DASS21Faixa = z.enum([
  "normal",
  "leve",
  "moderada",
  "severa",
  "extremamente_severa",
]);
export type DASS21Faixa = z.infer<typeof DASS21Faixa>;

export const DASS21Aplicacao = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  family_account_id: z.string().uuid(),
  data_aplicacao: z.string().date(),
  respostas: z.array(z.number().int().min(0).max(3)).length(21),
  score_depressao: z.number().int().min(0),
  score_ansiedade: z.number().int().min(0),
  score_estresse: z.number().int().min(0),
  faixa_depressao: DASS21Faixa,
  faixa_ansiedade: DASS21Faixa,
  faixa_estresse: DASS21Faixa,
  created_at: z.string().datetime(),
});
export type DASS21Aplicacao = z.infer<typeof DASS21Aplicacao>;
