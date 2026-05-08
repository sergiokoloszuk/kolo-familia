/**
 * Geração e validação de códigos de convite Beta.
 *
 * Formato: 8 caracteres alfanuméricos uppercase, sem caracteres
 * confusos (0/O/1/I/L). Fácil de digitar/falar por telefone.
 */

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars
const TAMANHO = 8;

export function gerarCodigo(): string {
  let r = "";
  // crypto.getRandomValues funciona em edge/node 19+; fallback Math.random ok pra MVP
  const bytes = new Uint8Array(TAMANHO);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < TAMANHO; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < TAMANHO; i++) {
    r += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return r;
}

const VALIDO_RE = new RegExp(`^[${ALFABETO}]{${TAMANHO}}$`);

export function normalizarCodigo(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function validarFormatoCodigo(codigo: string): boolean {
  return VALIDO_RE.test(codigo);
}

export function isBetaGateAtivo(): boolean {
  return process.env.BETA_GATE_ENABLED === "true";
}
