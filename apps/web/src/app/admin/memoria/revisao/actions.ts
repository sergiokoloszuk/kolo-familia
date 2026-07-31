"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { decidirCaso, type Decisao } from "@/lib/memoria-viva/revisao";

/**
 * As quatro decisões, do lado do servidor.
 *
 * A interface NÃO é a camada de segurança: `requireAdmin()` roda aqui, e é ele
 * que decide. Esconder botão no cliente não protege nada.
 */

const schema = z.object({
  fatoId: z.string().uuid(),
  decisao: z.enum(["aprovar", "pessoa_errada", "descartar", "em_duvida"]),
});

export type ResultadoAcao =
  | { ok: true; jaResolvido: boolean }
  | { ok: false; error: string };

export async function decidir(input: z.infer<typeof schema>): Promise<ResultadoAcao> {
  try {
    const { fatoId, decisao } = schema.parse(input);
    const { user } = await requireAdmin();

    // Service role: a revisão é operação de sistema sobre o fact store, não
    // escrita de usuário. O RLS da família não se aplica aqui.
    const admin = createServiceRoleClient();
    const r = await decidirCaso(admin, {
      fatoId,
      decisao: decisao as Decisao,
      revisorId: user.id,
    });

    if (!r.ok) return { ok: false, error: r.erro };

    revalidatePath("/admin/memoria/revisao");
    // `jaResolvido` não é erro: é o clique duplo, e a tela trata como sucesso.
    return { ok: true, jaResolvido: r.jaResolvido };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
