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
  "gostos",
] as const;

export type MembroCampoToplevel = (typeof MEMBRO_CAMPOS_TOPLEVEL)[number];
export type MembroCampoExtras = (typeof MEMBRO_CAMPOS_EXTRAS)[number];

/** Todos os campos do membro (toplevel + extras), pra varreduras. */
export const MEMBRO_CAMPOS_TODOS = [
  ...MEMBRO_CAMPOS_TOPLEVEL,
  ...MEMBRO_CAMPOS_EXTRAS,
] as const;

/** Rótulo legível de cada campo — fonte única pra UI, relatório e Ayla. */
export const MEMBRO_CAMPO_LABEL: Record<string, string> = {
  essencial: "O essencial",
  como_e: "Como é / interesses",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios",
  sensorial: "Sensorial",
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  imitacao: "Imitação",
  motor: "Motor",
  autonomia: "Autonomia",
  aprendizado: "Aprendizado",
  foco: "Foco e atenção",
  sono: "Sono",
  nutricional: "Alimentação",
  tela_midia: "Tela e mídia",
  escola: "Escola",
  saude_geral: "Saúde geral",
  emocional: "Regulação emocional",
  rotina: "Rotina",
  gostos: "Gostos e interesses",
};

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
