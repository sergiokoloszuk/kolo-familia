import { z } from "zod";
import { EstadoAdulto, QuemEstava, ReacaoAdulto } from "./diario";

export const EmocaoMae = z.enum([
  "muito_bem",
  "bem",
  "neutro",
  "triste",
  "cansada",
  "ansiosa_estressada",
]);
export type EmocaoMae = z.infer<typeof EmocaoMae>;

/**
 * Contrato de saída do parser da Ayla — PRD §12.7
 */
export const ParserResult = z.object({
  membro_atipico_id: z.string().uuid().nullable(),
  confianca_identificacao: z.number().min(0).max(100),

  conquista: z.string().nullable(),
  desafio: z.string().nullable(),
  emocao_mae: EmocaoMae.nullable(),
  possivel_gatilho: z.string().nullable(),
  observacao_livre: z.string().nullable(),

  quem_estava_id: z.string().uuid().nullable(),
  quem_estava: QuemEstava.nullable(),
  estado_adulto: EstadoAdulto.nullable(),
  reacao_adulto: ReacaoAdulto.nullable(),
  confianca_camada_adulto: z.number().min(0).max(100),

  sugestao_kolo_vivo: z.boolean(),
  campo_kolo_vivo_sugerido: z.string().optional(),
  texto_kolo_vivo_sugerido: z.string().optional(),

  confianca: z.number().min(0).max(100),
  precisa_clarificar: z.string().optional(),
});
export type ParserResult = z.infer<typeof ParserResult>;

export const AylaMessageCategory = z.enum(["proativa", "reativa"]);
export type AylaMessageCategory = z.infer<typeof AylaMessageCategory>;

export const AylaMessageType = z.enum([
  "rotina",
  "engajamento_2dias",
  "engajamento_5dias",
  "insight",
  "trial_d3",
  "trial_d0",
  "emocional_streak",
  "emocional_conquista",
  "dass21_convite",
  "dass21_resultado_moderado",
  "dass21_resultado_severo",
  "resposta_registro",
  "clarificacao_identificacao",
  "clarificacao_conteudo",
  "resposta_comando",
  "confirmacao_sugestao",
]);
export type AylaMessageType = z.infer<typeof AylaMessageType>;
