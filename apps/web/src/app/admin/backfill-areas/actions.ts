"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarAreasDiario } from "@/lib/ia/classificar-area";

/**
 * Backfill das etiquetas de área dos diários antigos (pré-0046 / pré-Passo 1).
 * Pega diários que TÊM conquista/desafio mas ainda SEM área e roda a IA do
 * Passo 1 só pra classificar (polir:false → NÃO reescreve o texto antigo).
 * Processa em lotes pequenos pra não estourar tempo/custo. Idempotente: só
 * toca nos que faltam. Admin-only, escopo global (todas as famílias).
 */
const LOTE = 25;
// Pendente = sem nenhuma área E com pelo menos conquista ou desafio escritos.
const SEM_AREA = "conquista.not.is.null,desafio.not.is.null";

type Resultado = {
  ok: boolean;
  processados: number;
  restantes: number;
  error?: string;
};

export async function backfillAreas(): Promise<Resultado> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    const { data: pendentes, error } = await admin
      .from("diarios")
      .select("id, family_account_id, conquista, desafio")
      .is("conquista_area", null)
      .is("desafio_area", null)
      .or(SEM_AREA)
      .order("data", { ascending: false })
      .limit(LOTE);

    if (error) return { ok: false, processados: 0, restantes: 0, error: error.message };

    const linhas = (pendentes ?? []) as Array<{
      id: string;
      family_account_id: string | null;
      conquista: string | null;
      desafio: string | null;
    }>;

    let processados = 0;
    for (const d of linhas) {
      const area = await classificarAreasDiario(
        { conquista: d.conquista, desafio: d.desafio, polir: false },
        { supabase: admin, family_account_id: d.family_account_id },
      );
      const { error: upErr } = await admin
        .from("diarios")
        .update({
          conquista_area: area.conquistaArea,
          desafio_area: area.desafioArea,
        })
        .eq("id", d.id);
      if (!upErr) processados += 1;
    }

    // Quantos ainda faltam depois deste lote.
    const { count } = await admin
      .from("diarios")
      .select("id", { count: "exact", head: true })
      .is("conquista_area", null)
      .is("desafio_area", null)
      .or(SEM_AREA);

    return { ok: true, processados, restantes: count ?? 0 };
  } catch (e) {
    return {
      ok: false,
      processados: 0,
      restantes: 0,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}
