"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_CRIANCA_ATIVA } from "@/lib/crianca-ativa";

/**
 * Define a criança ativa (de quem a mãe está falando) — grava num cookie que
 * TODAS as telas leem. O cliente chama isto e depois faz router.refresh().
 * Não valida contra a família aqui: a resolução (resolverCriancaAtiva) ignora
 * ids inválidos e cai na primeira; e o RLS protege os dados de qualquer jeito.
 */
export async function selecionarCriancaAtiva(id: string): Promise<void> {
  const ok = z.string().uuid().safeParse(id);
  if (!ok.success) return;
  const c = await cookies();
  c.set(COOKIE_CRIANCA_ATIVA, id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
