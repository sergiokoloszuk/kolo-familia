import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarJornadaTrial, type FaseTrial } from "@/lib/analytics/jornada";

/**
 * Radar do CRM: todos os leads reais com a FASE, o que a AYLA já fez (nutrição
 * automática) e a sinalização de quais precisam de AÇÃO SUA. É a porta de
 * entrada — abre e já mostra quem trabalhar.
 *
 * "Precisa de você" (por enquanto, por sinais de comportamento/fase; o
 * classificador de intenção — perguntou preço, objeção — entra depois):
 *   - respondeu uma abordagem e está aguardando (mais urgente)
 *   - oportunidade (reta final do teste, com uso)
 *   - em risco (parou 24h+)
 *   - expirou sem assinar (recuperar)
 */

export type RadarLead = {
  familyId: string;
  nome: string;
  fase: FaseTrial;
  faseLabel: string;
  diaTrial: number;
  aylaMsgs: number;
  aylaUltima: string | null;
  emAbordagem: boolean;
  aguardando: boolean;
  precisaVoce: boolean;
  motivo: string | null;
  prioridade: number; // menor = mais urgente
};

export type RadarData = {
  precisam: RadarLead[];
  resto: RadarLead[];
  fasesPresentes: { key: FaseTrial; label: string }[];
};

export async function carregarRadarCrm(admin: SupabaseClient): Promise<RadarData> {
  const j = await carregarJornadaTrial(admin);
  const fams = j.todasFamilias;
  const ids = fams.map((f) => f.id);

  const [{ data: aylaOut }, { data: crmLeads }] = await Promise.all([
    ids.length
      ? admin.from("ayla_messages").select("family_account_id, created_at").eq("direcao", "outbound").in("family_account_id", ids)
      : Promise.resolve({ data: [] as { family_account_id: string; created_at: string }[] }),
    admin.from("crm_leads").select("family_account_id, em_abordagem, aguardando_resposta, excluido"),
  ]);

  const excluidos = new Set(
    (crmLeads ?? []).filter((c) => c.excluido).map((c) => c.family_account_id as string),
  );

  const aylaBy = new Map<string, { n: number; ultima: string | null }>();
  for (const m of aylaOut ?? []) {
    const fid = m.family_account_id as string;
    const cur = aylaBy.get(fid) ?? { n: 0, ultima: null };
    cur.n += 1;
    const t = m.created_at as string;
    if (!cur.ultima || t > cur.ultima) cur.ultima = t;
    aylaBy.set(fid, cur);
  }
  const crmBy = new Map(
    (crmLeads ?? []).map((c) => [
      c.family_account_id as string,
      { em: !!c.em_abordagem, ag: !!c.aguardando_resposta },
    ]),
  );

  const items: RadarLead[] = fams
    .filter((f) => !excluidos.has(f.id))
    .map((f) => {
    const ayla = aylaBy.get(f.id) ?? { n: 0, ultima: null };
    const crm = crmBy.get(f.id) ?? { em: false, ag: false };
    let precisa = false;
    let motivo: string | null = null;
    let prioridade = 99;
    if (crm.ag) {
      precisa = true;
      motivo = "Respondeu — aguardando você";
      prioridade = 0;
    } else if (f.fase === "oportunidade") {
      precisa = true;
      motivo = "Oportunidade — reta final do teste";
      prioridade = 1;
    } else if (f.fase === "em_risco") {
      precisa = true;
      motivo = "Parou 24h+ — resgatar";
      prioridade = 2;
    } else if (f.fase === "expirado") {
      precisa = true;
      motivo = "Expirou sem assinar — recuperar";
      prioridade = 3;
    }
    return {
      familyId: f.id,
      nome: f.nomeMae || f.email || `#${f.id.slice(0, 6)}`,
      fase: f.fase,
      faseLabel: j.fases[f.fase]?.label ?? f.fase,
      diaTrial: f.diaTrial,
      aylaMsgs: ayla.n,
      aylaUltima: ayla.ultima,
      emAbordagem: crm.em,
      aguardando: crm.ag,
      precisaVoce: precisa,
      motivo,
      prioridade,
    };
  });

  const precisam = items
    .filter((i) => i.precisaVoce)
    .sort((a, b) => a.prioridade - b.prioridade || b.diaTrial - a.diaTrial);
  const resto = items.filter((i) => !i.precisaVoce).sort((a, b) => b.diaTrial - a.diaTrial);

  const vistas = new Set<string>();
  const fasesPresentes: { key: FaseTrial; label: string }[] = [];
  for (const i of items) {
    if (!vistas.has(i.fase)) {
      vistas.add(i.fase);
      fasesPresentes.push({ key: i.fase, label: i.faseLabel });
    }
  }

  return { precisam, resto, fasesPresentes };
}
