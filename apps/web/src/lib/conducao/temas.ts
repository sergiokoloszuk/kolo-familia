/**
 * OS TEMAS DA KOLO — vocabulário único.
 *
 * O mesmo eixo aparecia em quatro lugares, escrito quatro vezes e já divergindo:
 *
 *   - `DOMINIO_KEYS` (onboarding)                    → 15 chaves
 *   - `desafios_onboarding` (o que a família marcou) → as mesmas 15
 *   - `DESAFIO_FRASE` (boas-vindas)                  → 11, em frase
 *   - `extrasLabels` (o que a Ayla LÊ do perfil)     → 9, em rótulo
 *
 * A divergência tinha consequência real: `escola` e `aprendizado` existiam no
 * onboarding e no perfil, mas não estavam no mapa de leitura — a família marcava
 * "escola" no cadastro e a Ayla, no WhatsApp, não enxergava nada disso.
 *
 * Aqui é UM lugar. Quem escreve, quem lê e quem conversa usam esta lista.
 *
 * `chave`  — o que vai pro banco (`categorias_extras`, `desafios_onboarding`).
 * `rotulo` — cabeçalho na leitura do perfil ("Alimentação: ...").
 * `frase`  — como se fala disso numa conversa ("a alimentação tem pesado").
 */
export type Tema = {
  chave: string;
  rotulo: string;
  frase: string;
  /** Onde o texto vive no perfil: coluna própria ou dentro de categorias_extras. */
  storage: "toplevel" | "extras";
};

export const TEMAS: readonly Tema[] = [
  { chave: "sensorial", rotulo: "Sensorial", frase: "a parte sensorial", storage: "toplevel" },
  { chave: "nutricional", rotulo: "Alimentação", frase: "a alimentação", storage: "extras" },
  { chave: "comunicacao", rotulo: "Comunicação", frase: "a comunicação", storage: "extras" },
  { chave: "emocional", rotulo: "Regulação emocional", frase: "as emoções e as crises", storage: "extras" },
  { chave: "foco", rotulo: "Foco", frase: "o foco", storage: "extras" },
  { chave: "sono", rotulo: "Sono", frase: "o sono", storage: "extras" },
  { chave: "socializacao", rotulo: "Socialização", frase: "a socialização", storage: "extras" },
  { chave: "motor", rotulo: "Motor", frase: "a parte motora", storage: "extras" },
  { chave: "rotina", rotulo: "Rotina", frase: "a rotina e as transições", storage: "extras" },
  { chave: "autonomia", rotulo: "Autonomia", frase: "a autonomia", storage: "extras" },
  { chave: "aprendizado", rotulo: "Aprendizado", frase: "o aprendizado", storage: "extras" },
  { chave: "imitacao", rotulo: "Imitação", frase: "a imitação", storage: "extras" },
  { chave: "tela_midia", rotulo: "Telas e mídia", frase: "as telas", storage: "extras" },
  { chave: "escola", rotulo: "Escola", frase: "a escola", storage: "extras" },
  { chave: "saude_geral", rotulo: "Saúde geral", frase: "a saúde no geral", storage: "extras" },
] as const;

/** Só as chaves — o que o onboarding grava e o classificador pode devolver. */
export const CHAVES_TEMA: readonly string[] = TEMAS.map((t) => t.chave);

const POR_CHAVE = new Map(TEMAS.map((t) => [t.chave, t]));

export function tema(chave: string | null | undefined): Tema | null {
  return chave ? (POR_CHAVE.get(chave) ?? null) : null;
}

/** "a alimentação" — pra escrever numa frase. Fallback neutro, nunca vazio. */
export function fraseDoTema(chave: string): string {
  return POR_CHAVE.get(chave)?.frase ?? "esse ponto que você marcou";
}

/** "Alimentação" — pra encabeçar um bloco na leitura do perfil. */
export function rotuloDoTema(chave: string): string | null {
  return POR_CHAVE.get(chave)?.rotulo ?? null;
}

/**
 * Lista humana: "a alimentação, o foco e a rotina e as transições".
 * Usada na introdução, com os desafios que a PRÓPRIA família marcou.
 */
export function listarTemas(chaves: string[], limite = 3): string {
  const frases = chaves
    .map((c) => POR_CHAVE.get(c)?.frase)
    .filter((f): f is string => Boolean(f))
    .slice(0, limite);
  if (frases.length === 0) return "";
  if (frases.length === 1) return frases[0];
  return `${frases.slice(0, -1).join(", ")} e ${frases[frases.length - 1]}`;
}
