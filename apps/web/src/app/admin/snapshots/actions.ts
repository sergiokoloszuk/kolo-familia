"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gerarSnapshotMensal } from "@/lib/evolucao/snapshot";
import { coletarCandidatosSnapshot } from "@/lib/evolucao/snapshot-backfill";

/**
 * Backfill das FOTOS mensais retroativas (a "máquina do tempo"). Pra cada
 * membro ativo, gera os snapshots dos meses COMPLETOS (até o mês passado) que
 * têm atividade (conquista/desafio) mas ainda não têm foto. Lotes pequenos —
 * cada foto = 1 chamada de IA leve. Idempotente. Admin-only, escopo global.
 */
const LOTE = 6;

export async function backfillSnapshots(): Promise<{
  ok: boolean;
  processados: number;
  restantes: number;
  error?: string;
}> {
  try {
    await requireAdmin();
    const admin = createServiceRoleClient();

    const cand = await coletarCandidatosSnapshot(admin);
    const lote = cand.slice(0, LOTE);
    let processados = 0;
    for (const c of lote) {
      try {
        const r = await gerarSnapshotMensal(admin, {
          membroId: c.membroId,
          familyId: c.familyId,
          periodo: c.periodo,
          geradoPor: "backfill",
        });
        if (r.status !== "existe") processados += 1;
      } catch {
        // pula esta foto; segue as outras
      }
    }
    return { ok: true, processados, restantes: Math.max(0, cand.length - lote.length) };
  } catch (e) {
    return {
      ok: false,
      processados: 0,
      restantes: 0,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}
