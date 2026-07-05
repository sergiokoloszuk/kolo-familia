import type { SupabaseClient } from "@supabase/supabase-js";
import { emailsPorFamilia } from "./emails";

/**
 * Feedbacks capturados (elogio / sugestão / reclamação) pra aba de Feedback nos
 * dashboards. Nome da mãe (ou e-mail) — igual ao resto. Agência vê; só admin age.
 */

export type FeedbackItem = {
  id: string;
  familyId: string | null;
  nome: string;
  tipo: "elogio" | "sugestao" | "reclamacao" | "duvida";
  texto: string;
  status: "nova" | "respondida" | "implementar" | "arquivada";
  criadoEm: string;
};

export async function carregarFeedbacks(admin: SupabaseClient): Promise<FeedbackItem[]> {
  const { data } = await admin
    .from("feedbacks")
    .select("id, family_account_id, tipo, texto, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (!data || data.length === 0) return [];

  const ids = [...new Set(data.map((f) => f.family_account_id as string | null).filter(Boolean))] as string[];
  const [{ data: profiles }, emails] = await Promise.all([
    ids.length
      ? admin.from("family_profiles").select("family_account_id, nome_mae, como_chamar").in("family_account_id", ids)
      : Promise.resolve({ data: [] as { family_account_id: string; nome_mae: string | null; como_chamar: string | null }[] }),
    emailsPorFamilia(admin),
  ]);

  const nomeBy = new Map(
    (profiles ?? []).map((p) => [
      p.family_account_id as string,
      ((p.como_chamar as string | null)?.trim() || (p.nome_mae as string | null)?.trim() || "") as string,
    ]),
  );

  return data.map((f) => {
    const fid = f.family_account_id as string | null;
    return {
      id: f.id as string,
      familyId: fid,
      nome: (fid && (nomeBy.get(fid) || emails.get(fid))) || "Anônimo",
      tipo: f.tipo as FeedbackItem["tipo"],
      texto: f.texto as string,
      status: f.status as FeedbackItem["status"],
      criadoEm: f.created_at as string,
    };
  });
}
