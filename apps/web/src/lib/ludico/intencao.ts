import type { SupabaseClient } from "@supabase/supabase-js";

export type ArtefatoLudico = "avatar" | "historia" | "rotina";
export type EtapaIntencaoLudico =
  | "revisar"
  | "aguardando_avatar"
  | "avatar_aprovado"
  | "gerando"
  | "concluida"
  | "erro"
  | "cancelada";

export type IntencaoLudico = {
  id: string;
  family_account_id: string;
  membro_atipico_id: string;
  artefato: ArtefatoLudico;
  etapa: EtapaIntencaoLudico;
  payload: Record<string, unknown>;
  avatar_id: string | null;
};

export async function criarOuReusarIntencaoLudico(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string;
    artefato: ArtefatoLudico;
    origem?: "whatsapp" | "trial" | "app";
    payload?: Record<string, unknown>;
    sourceMessageId?: string | null;
    etapa?: EtapaIntencaoLudico;
  },
): Promise<IntencaoLudico | null> {
  if (params.sourceMessageId) {
    const { data: existente, error: buscaError } = await supabase
      .from("ludico_intencoes")
      .select("id, family_account_id, membro_atipico_id, artefato, etapa, payload, avatar_id")
      .eq("source_message_id", params.sourceMessageId)
      .eq("artefato", params.artefato)
      .eq("family_account_id", params.familyId)
      .maybeSingle();
    if (buscaError) throw new Error(`Falha ao recuperar intenção do Lúdico: ${buscaError.message}`);
    if (existente) return existente as IntencaoLudico;
  }

  const { data, error } = await supabase
    .from("ludico_intencoes")
    .insert({
      family_account_id: params.familyId,
      membro_atipico_id: params.membroId,
      artefato: params.artefato,
      origem: params.origem ?? "whatsapp",
      etapa: params.etapa ?? "revisar",
      payload: params.payload ?? {},
      source_message_id: params.sourceMessageId ?? null,
    })
    .select("id, family_account_id, membro_atipico_id, artefato, etapa, payload, avatar_id")
    .single();
  if (error?.code === "23505" && params.sourceMessageId) {
    // Duas tentativas do mesmo inbound podem atravessar a leitura inicial ao
    // mesmo tempo. O índice único é a arbitragem; quem perde relê a vencedora.
    const { data: existente, error: buscaError } = await supabase
      .from("ludico_intencoes")
      .select("id, family_account_id, membro_atipico_id, artefato, etapa, payload, avatar_id")
      .eq("source_message_id", params.sourceMessageId)
      .eq("artefato", params.artefato)
      .eq("family_account_id", params.familyId)
      .maybeSingle();
    if (buscaError || !existente) {
      throw new Error(`Falha ao recuperar intenção concorrente do Lúdico: ${buscaError?.message ?? "sem retorno"}`);
    }
    return existente as IntencaoLudico;
  }
  if (error || !data) throw new Error(`Falha ao guardar intenção do Lúdico: ${error?.message ?? "sem retorno"}`);
  return data as IntencaoLudico;
}

export async function carregarIntencaoLudico(
  supabase: SupabaseClient,
  params: { id: string; familyId: string; membroId?: string },
): Promise<IntencaoLudico | null> {
  let query = supabase
    .from("ludico_intencoes")
    .select("id, family_account_id, membro_atipico_id, artefato, etapa, payload, avatar_id")
    .eq("id", params.id)
    .eq("family_account_id", params.familyId)
    .gt("expira_em", new Date().toISOString());
  if (params.membroId) query = query.eq("membro_atipico_id", params.membroId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Falha ao carregar intenção do Lúdico: ${error.message}`);
  return (data as IntencaoLudico | null) ?? null;
}

export async function atualizarIntencaoLudico(
  supabase: SupabaseClient,
  params: {
    id: string;
    familyId: string;
    membroId: string;
    etapa: EtapaIntencaoLudico;
    avatarId?: string | null;
    artefatoId?: string | null;
  },
): Promise<void> {
  const { data, error } = await supabase
    .from("ludico_intencoes")
    .update({
      etapa: params.etapa,
      avatar_id: params.avatarId,
      artefato_id: params.artefatoId,
      updated_at: new Date().toISOString(),
      ...(params.etapa === "concluida" ? { consumida_em: new Date().toISOString() } : {}),
    })
    .eq("id", params.id)
    .eq("family_account_id", params.familyId)
    .eq("membro_atipico_id", params.membroId)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(`Falha ao atualizar intenção do Lúdico: ${error?.message ?? "não encontrada"}`);
}
