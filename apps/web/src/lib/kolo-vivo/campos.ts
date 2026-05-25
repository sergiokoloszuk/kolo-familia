/**
 * Roteamento dos campos do `perfil_vivo_membro` — fonte neutra compartilhada
 * pela UI (app/(app)/kolo-vivo), pela action de salvar e pelo orquestrador da
 * Ayla (aplicar sugestão via "sim" no WhatsApp).
 *
 * - `toplevel`: coluna jsonb dedicada na tabela (campos legados, mantidos).
 * - `extras`:   chave dentro de `categorias_extras` (as skills leem via
 *   context.ts → resolveSecaoMembro). É onde moram os domínios novos.
 */

/** Campos jsonb com coluna dedicada na tabela. */
export const MEMBRO_CAMPOS_TOPLEVEL = [
  "essencial",
  "como_e",
  "corpo_rotina",
  "desafios_regulacao",
  "sensorial",
] as const;

/** Chaves dentro de categorias_extras (espelham as skills + domínios novos). */
export const MEMBRO_CAMPOS_EXTRAS = [
  "comunicacao",
  "socializacao",
  "imitacao",
  "motor",
  "autonomia",
  "aprendizado",
  "foco",
  "sono",
  "nutricional",
  "tela_midia",
  "escola",
  "saude_geral",
  "emocional",
  "rotina",
] as const;

export type MembroCampoToplevel = (typeof MEMBRO_CAMPOS_TOPLEVEL)[number];
export type MembroCampoExtras = (typeof MEMBRO_CAMPOS_EXTRAS)[number];

/** Onde um campo do membro é gravado — ou null se desconhecido. */
export function membroCampoStorage(
  campo: string,
): "toplevel" | "extras" | null {
  if ((MEMBRO_CAMPOS_TOPLEVEL as readonly string[]).includes(campo)) {
    return "toplevel";
  }
  if ((MEMBRO_CAMPOS_EXTRAS as readonly string[]).includes(campo)) {
    return "extras";
  }
  return null;
}
