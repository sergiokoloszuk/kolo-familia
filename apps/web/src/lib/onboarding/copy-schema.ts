import { z } from "zod";
import type { OnboardingCopy } from "./copy-default";

/**
 * Schema do OnboardingCopy — valida o JSON que a IA devolve ao editar a copy,
 * pra ela nunca conseguir quebrar a estrutura (ids, tipos). Se não bater, a
 * edição é rejeitada e o rascunho anterior fica intacto.
 */

const chip = z.object({
  value: z.string(),
  label: z.string(),
  livre: z.boolean().optional(),
});

const passo = z.object({
  id: z.string(),
  ayla: z.string(),
  tipo: z.enum(["texto", "data", "chips_multi", "chips_uni", "whatsapp", "aceites"]),
  placeholder: z.string().optional(),
  nota: z.string().optional(),
  opcoes: z.array(chip).optional(),
  opcional: z.boolean().optional(),
});

const tourCard = z.object({ emoji: z.string(), titulo: z.string(), texto: z.string() });

export const onboardingCopySchema = z.object({
  intro: z.object({ titulo: z.string(), subtitulo: z.string() }),
  passos: z.array(passo).min(1),
  garfo: z.object({ titulo: z.string(), ajuda: z.string(), explorar: z.string() }),
  tour: z.object({ titulo: z.string(), final: z.string(), cards: z.array(tourCard).min(1) }),
  desafio: z.object({ pergunta: z.string(), abertura: z.string() }),
});

/** Valida um objeto desconhecido como OnboardingCopy (ou null se inválido). */
export function parseCopy(raw: unknown): OnboardingCopy | null {
  const r = onboardingCopySchema.safeParse(raw);
  return r.success ? (r.data as OnboardingCopy) : null;
}
