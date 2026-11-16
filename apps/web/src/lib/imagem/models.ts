/**
 * Cadeia comum a TODO o Lúdico que gera imagens. Sunburst vem primeiro pela
 * precisão em edições; Flare mantém o fluxo com menor latência; GPT-Image-2
 * evita que a família 2.5 inteira seja um ponto único de falha.
 */
export const DEFAULT_IMAGE_MODELS = [
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "gpt-image-2",
] as const;

const MODELOS_DESLIGADOS = new Set(["gpt-image-1"]);

export function resolverModelosImagem(params?: {
  lista?: string | null;
  legado?: string | null;
}): string[] {
  const lista = params?.lista ?? process.env.OPENAI_IMAGE_MODELS ?? null;
  const legado = params?.legado ?? process.env.OPENAI_IMAGE_MODEL ?? null;
  const configurados = lista
    ? lista.split(",").map((modelo) => modelo.trim()).filter(Boolean)
    : legado?.trim()
      ? [legado.trim()]
      : [];
  return Array.from(
    new Set(
      [...configurados, ...DEFAULT_IMAGE_MODELS].filter(
        (modelo) => !MODELOS_DESLIGADOS.has(modelo),
      ),
    ),
  );
}

/**
 * Failover é continuidade operacional, não uma forma de contornar segurança
 * ou mascarar contrato inválido. Só avança em indisponibilidade técnica ou
 * quando o provider removeu o modelo.
 */
export function deveTentarProximoModelo(status: number, corpo: string): boolean {
  if (status === 429 || status >= 500) return true;
  return /model.{0,120}(does not exist|not found|unavailable|deprecated|shut down)|unknown model/i.test(
    corpo,
  );
}
