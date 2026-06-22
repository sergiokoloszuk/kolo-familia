import { cookies } from "next/headers";

export const COOKIE_CRIANCA_ATIVA = "crianca_ativa";

/** Lê o id da criança ativa do cookie (ou null). */
export async function lerCriancaAtivaId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_CRIANCA_ATIVA)?.value ?? null;
}

/**
 * Resolve a criança ativa a partir da lista da família: usa o id do cookie se
 * ele for de um membro válido; senão, a primeira. Fonte única pra todas as
 * telas seguirem "de quem a mãe está falando".
 */
export function resolverCriancaAtiva<T extends { id: string }>(
  membros: T[],
  cookieId: string | null,
): T | null {
  if (membros.length === 0) return null;
  return membros.find((m) => m.id === cookieId) ?? membros[0];
}

/** Atalho: lê o cookie e devolve o id válido (ou o da primeira criança). */
export async function resolverCriancaAtivaId(
  membros: Array<{ id: string }>,
): Promise<string | null> {
  return resolverCriancaAtiva(membros, await lerCriancaAtivaId())?.id ?? null;
}
