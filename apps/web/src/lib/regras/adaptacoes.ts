/**
 * Aplicação e reversão de adaptações sugeridas.
 *
 * Cada handler:
 *   - Lê o estado atual (snapshot pré)
 *   - Aplica a mudança
 *   - Devolve snapshot pós
 *
 * Reverter usa o snapshot pré pra restaurar exatamente o que estava antes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdaptacaoTipo } from "./types";

type Snapshot = Record<string, unknown>;

type ApplyFn = (
  supabase: SupabaseClient,
  familyAccountId: string,
  payload: Record<string, unknown>,
) => Promise<{ pre: Snapshot; pos: Snapshot }>;

type RevertFn = (
  supabase: SupabaseClient,
  familyAccountId: string,
  payloadPre: Snapshot,
  payloadProposto: Record<string, unknown>,
) => Promise<void>;

const HANDLERS: Record<AdaptacaoTipo, { apply: ApplyFn; revert: RevertFn }> = {
  adicionar_kolo_vivo_desafio: {
    apply: applyAddDesafio,
    revert: revertAddDesafio,
  },
  ajustar_ayla_horario: {
    apply: applyAjustarHorario,
    revert: revertAjustarHorario,
  },
  sugerir_boa_pratica: {
    apply: async () => ({ pre: {}, pos: {} }),
    revert: async () => {
      // No-op: "sugerir" só notifica, não muda estado
    },
  },
};

/**
 * Aplica uma adaptação. Garante que está pendente e que o tipo é
 * conhecido. Persiste pre/pos pra rollback.
 */
export async function aplicarAdaptacao(
  supabase: SupabaseClient,
  adaptacaoId: string,
  userId: string,
): Promise<void> {
  const { data: ad, error: errSel } = await supabase
    .from("adaptacoes_sugeridas")
    .select("id, family_account_id, tipo, payload_proposto, estado")
    .eq("id", adaptacaoId)
    .single();
  if (errSel || !ad) throw new Error("Adaptação não encontrada.");
  if (ad.estado !== "pendente") {
    throw new Error("Adaptação não está pendente.");
  }
  const handler = HANDLERS[ad.tipo as AdaptacaoTipo];
  if (!handler) throw new Error(`Tipo desconhecido: ${ad.tipo}`);

  const { pre, pos } = await handler.apply(
    supabase,
    ad.family_account_id as string,
    ad.payload_proposto as Record<string, unknown>,
  );

  await supabase
    .from("adaptacoes_sugeridas")
    .update({
      estado: "aplicada",
      payload_pre: pre,
      payload_pos: pos,
      aplicada_em: new Date().toISOString(),
      aplicada_por_user_id: userId,
    })
    .eq("id", adaptacaoId);

  await supabase.from("regras_eventos_log").insert({
    family_account_id: ad.family_account_id,
    adaptacao_id: ad.id,
    acao: "adaptacao_aplicada",
    detalhe: { tipo: ad.tipo },
    user_id: userId,
  });
}

export async function descartarAdaptacao(
  supabase: SupabaseClient,
  adaptacaoId: string,
  userId: string,
): Promise<void> {
  const { data: ad } = await supabase
    .from("adaptacoes_sugeridas")
    .select("family_account_id, estado, tipo")
    .eq("id", adaptacaoId)
    .single();
  if (!ad) throw new Error("Adaptação não encontrada.");
  if (ad.estado !== "pendente") {
    throw new Error("Só adaptações pendentes podem ser descartadas.");
  }
  await supabase
    .from("adaptacoes_sugeridas")
    .update({ estado: "descartada" })
    .eq("id", adaptacaoId);
  await supabase.from("regras_eventos_log").insert({
    family_account_id: ad.family_account_id,
    adaptacao_id: adaptacaoId,
    acao: "adaptacao_descartada",
    detalhe: { tipo: ad.tipo },
    user_id: userId,
  });
}

export async function reverterAdaptacao(
  supabase: SupabaseClient,
  adaptacaoId: string,
  userId: string,
): Promise<void> {
  const { data: ad } = await supabase
    .from("adaptacoes_sugeridas")
    .select("family_account_id, tipo, estado, payload_pre, payload_proposto")
    .eq("id", adaptacaoId)
    .single();
  if (!ad) throw new Error("Adaptação não encontrada.");
  if (ad.estado !== "aplicada") {
    throw new Error("Só adaptações aplicadas podem ser revertidas.");
  }
  const handler = HANDLERS[ad.tipo as AdaptacaoTipo];
  if (!handler) throw new Error(`Tipo desconhecido: ${ad.tipo}`);

  await handler.revert(
    supabase,
    ad.family_account_id as string,
    (ad.payload_pre as Snapshot) ?? {},
    ad.payload_proposto as Record<string, unknown>,
  );

  await supabase
    .from("adaptacoes_sugeridas")
    .update({ estado: "revertida", revertida_em: new Date().toISOString() })
    .eq("id", adaptacaoId);
  await supabase.from("regras_eventos_log").insert({
    family_account_id: ad.family_account_id,
    adaptacao_id: adaptacaoId,
    acao: "adaptacao_revertida",
    detalhe: { tipo: ad.tipo },
    user_id: userId,
  });
}

// ============================================================
// Handlers
// ============================================================

/**
 * Adiciona texto à lista `desafios_regulacao.items` do
 * perfil_vivo_membro do membro indicado.
 *
 * Modelo do JSONB: { items: string[] }
 */
async function applyAddDesafio(
  supabase: SupabaseClient,
  familyAccountId: string,
  payload: Record<string, unknown>,
): Promise<{ pre: Snapshot; pos: Snapshot }> {
  const membroId = payload.membro_atipico_id as string;
  const valor = (payload.valor as string)?.trim();
  if (!membroId || !valor) {
    throw new Error("Payload inválido: precisa membro_atipico_id e valor.");
  }

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select("membro_atipico_id, desafios_regulacao")
    .eq("membro_atipico_id", membroId)
    .eq("family_account_id", familyAccountId)
    .maybeSingle();

  const desafiosAtuais =
    (atual?.desafios_regulacao as { items?: string[] } | null) ?? {};
  const itemsAtuais = Array.isArray(desafiosAtuais.items)
    ? desafiosAtuais.items
    : [];
  const novoSet = new Set(
    itemsAtuais.map((s) => s.trim().toLowerCase()),
  );
  const isNovo = !novoSet.has(valor.toLowerCase());
  const itemsNovos = isNovo ? [...itemsAtuais, valor] : itemsAtuais;
  const novoDesafios = { ...desafiosAtuais, items: itemsNovos };

  if (atual) {
    await supabase
      .from("perfil_vivo_membro")
      .update({ desafios_regulacao: novoDesafios })
      .eq("membro_atipico_id", membroId);
  } else {
    // Cria registro mínimo
    await supabase.from("perfil_vivo_membro").insert({
      membro_atipico_id: membroId,
      family_account_id: familyAccountId,
      desafios_regulacao: novoDesafios,
    });
  }

  return {
    pre: { desafios_regulacao: desafiosAtuais, criou_registro: !atual },
    pos: { desafios_regulacao: novoDesafios, adicionou: isNovo },
  };
}

async function revertAddDesafio(
  supabase: SupabaseClient,
  familyAccountId: string,
  payloadPre: Snapshot,
  payloadProposto: Record<string, unknown>,
): Promise<void> {
  const membroId = payloadProposto.membro_atipico_id as string;
  if (!membroId) return;
  const desafiosAnteriores =
    (payloadPre.desafios_regulacao as { items?: string[] } | null) ?? {};
  await supabase
    .from("perfil_vivo_membro")
    .update({ desafios_regulacao: desafiosAnteriores })
    .eq("membro_atipico_id", membroId)
    .eq("family_account_id", familyAccountId);
}

/**
 * Ajusta horario_preferido_inicio/fim em ayla_preferences.
 * Payload: { horario_inicio: 'HH:MM:SS', horario_fim: 'HH:MM:SS' }
 */
async function applyAjustarHorario(
  supabase: SupabaseClient,
  familyAccountId: string,
  payload: Record<string, unknown>,
): Promise<{ pre: Snapshot; pos: Snapshot }> {
  const inicio = payload.horario_inicio as string;
  const fim = payload.horario_fim as string;
  if (!inicio || !fim) throw new Error("Payload precisa horario_inicio e horario_fim.");

  const { data: atual } = await supabase
    .from("ayla_preferences")
    .select("horario_preferido_inicio, horario_preferido_fim")
    .eq("family_account_id", familyAccountId)
    .single();
  if (!atual) throw new Error("ayla_preferences não existe.");

  await supabase
    .from("ayla_preferences")
    .update({
      horario_preferido_inicio: inicio,
      horario_preferido_fim: fim,
    })
    .eq("family_account_id", familyAccountId);

  return {
    pre: {
      horario_preferido_inicio: atual.horario_preferido_inicio,
      horario_preferido_fim: atual.horario_preferido_fim,
    },
    pos: {
      horario_preferido_inicio: inicio,
      horario_preferido_fim: fim,
    },
  };
}

async function revertAjustarHorario(
  supabase: SupabaseClient,
  familyAccountId: string,
  payloadPre: Snapshot,
): Promise<void> {
  await supabase
    .from("ayla_preferences")
    .update({
      horario_preferido_inicio: payloadPre.horario_preferido_inicio,
      horario_preferido_fim: payloadPre.horario_preferido_fim,
    })
    .eq("family_account_id", familyAccountId);
}
