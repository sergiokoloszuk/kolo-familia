import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocalISO } from "@/lib/idade";
import { inicioDoMes } from "./snapshot";

export type CandidatoSnapshot = {
  membroId: string;
  familyId: string | null;
  periodo: string;
};

/**
 * Meses (por membro ativo) com atividade de diário (conquista/desafio) e ainda
 * SEM foto, anteriores ao mês atual. Base do backfill da "máquina do tempo".
 */
export async function coletarCandidatosSnapshot(
  admin: SupabaseClient,
): Promise<CandidatoSnapshot[]> {
  const mesAtual = inicioDoMes(hojeLocalISO());
  const { data: membros } = await admin
    .from("membros_atipicos")
    .select("id, family_account_id")
    .eq("ativo", true);

  const cand: CandidatoSnapshot[] = [];
  for (const m of membros ?? []) {
    const membroId = m.id as string;
    const { data: ds } = await admin
      .from("diarios")
      .select("data")
      .eq("membro_atipico_id", membroId)
      .or("conquista.not.is.null,desafio.not.is.null");
    const meses = new Set<string>();
    for (const d of ds ?? []) {
      const p = inicioDoMes(d.data as string);
      if (p < mesAtual) meses.add(p);
    }
    if (meses.size === 0) continue;

    const { data: snaps } = await admin
      .from("evolucao_snapshots")
      .select("periodo")
      .eq("membro_atipico_id", membroId)
      .eq("periodo_tipo", "mensal");
    const existentes = new Set((snaps ?? []).map((s) => s.periodo as string));

    for (const p of meses) {
      if (!existentes.has(p)) {
        cand.push({
          membroId,
          familyId: (m.family_account_id as string | null) ?? null,
          periodo: p,
        });
      }
    }
  }
  cand.sort((a, b) => a.periodo.localeCompare(b.periodo)); // mais antigos primeiro
  return cand;
}
