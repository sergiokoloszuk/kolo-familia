import type { SupabaseClient } from "@supabase/supabase-js";
import { emailsPorFamilia } from "@/lib/analytics/emails";

/**
 * Lista dos leads que estão EM ABORDAGEM (o hub do CRM). Mostra quem está
 * sendo trabalhado, se está aguardando sua resposta e o próximo passo.
 * Agregado por família; nome da mãe (ou e-mail) — igual aos dashboards.
 */

export type CrmLeadItem = {
  familyId: string;
  nome: string;
  aguardandoResposta: boolean;
  proximoPassoEm: string | null;
  proximoPassoNota: string | null;
  ultimaMensagemEm: string | null;
  ultimaDirecao: "enviada" | "recebida" | null;
};

export async function carregarCrmLeads(admin: SupabaseClient): Promise<CrmLeadItem[]> {
  const { data: leads } = await admin
    .from("crm_leads")
    .select("family_account_id, aguardando_resposta, proximo_passo_em, proximo_passo_nota")
    .eq("em_abordagem", true);

  if (!leads || leads.length === 0) return [];
  const ids = leads.map((l) => l.family_account_id as string);

  const [{ data: profiles }, emails, { data: msgs }] = await Promise.all([
    admin.from("family_profiles").select("family_account_id, nome_mae, como_chamar").in("family_account_id", ids),
    emailsPorFamilia(admin),
    admin
      .from("crm_mensagens")
      .select("family_account_id, direcao, created_at")
      .in("family_account_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const nomeBy = new Map(
    (profiles ?? []).map((p) => [
      p.family_account_id as string,
      ((p.como_chamar as string | null)?.trim() || (p.nome_mae as string | null)?.trim() || "") as string,
    ]),
  );
  const ultimaBy = new Map<string, { direcao: string; created_at: string }>();
  for (const m of msgs ?? []) {
    const fid = m.family_account_id as string;
    if (!ultimaBy.has(fid)) ultimaBy.set(fid, { direcao: m.direcao as string, created_at: m.created_at as string });
  }

  return leads
    .map((l) => {
      const fid = l.family_account_id as string;
      const u = ultimaBy.get(fid);
      return {
        familyId: fid,
        nome: nomeBy.get(fid) || emails.get(fid) || `#${fid.slice(0, 6)}`,
        aguardandoResposta: !!l.aguardando_resposta,
        proximoPassoEm: (l.proximo_passo_em as string | null) ?? null,
        proximoPassoNota: (l.proximo_passo_nota as string | null) ?? null,
        ultimaMensagemEm: u?.created_at ?? null,
        ultimaDirecao: (u?.direcao as "enviada" | "recebida" | undefined) ?? null,
      };
    })
    .sort((a, b) => (b.ultimaMensagemEm ?? "").localeCompare(a.ultimaMensagemEm ?? ""));
}
