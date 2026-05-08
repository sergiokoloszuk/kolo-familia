/**
 * Rules Engine — orquestra avaliação de regras + criação de alertas
 * com salvaguardas. Roda por família.
 *
 * Fluxo por regra:
 *   1. Skip se silenciada (regras_overrides ativo + ainda dentro do silenciada_ate)
 *   2. Carrega alerta open existente (se houver) e cooldown ativo
 *   3. Avalia regra
 *   4. Se fired e não há open + cooldown vencido:
 *        - cria alerta + log + (se houver) adaptacao_sugerida
 *   5. Se fired e há open: atualiza last_avaliacao_em (sem dispara de novo)
 *   6. Se resolved e há open: marca resolvido + log + cooldown_ate
 *
 * Design choices:
 *   - Engine NUNCA aplica adaptação. Sempre propõe.
 *   - Cada regra é isolada — falha em uma não derruba as outras.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { REGRAS } from "./registry";
import type {
  RegraKey,
  RegraResult,
  SugestaoAdaptacao,
} from "./types";
import { logServerError } from "../log";

export type RunResultado = {
  regra_key: RegraKey;
  status: "skipped_override" | "fired_new" | "fired_existing" | "resolved" | "noop" | "error";
  motivo?: string;
};

export async function runRegrasParaFamilia(
  supabase: SupabaseClient,
  familyAccountId: string,
  agora: Date = new Date(),
): Promise<RunResultado[]> {
  const { data: definicoes } = await supabase
    .from("regras_definicoes")
    .select("key, severidade_default, cooldown_dias, parametros, ativa");

  const ativas = (definicoes ?? []).filter((d) => d.ativa);
  if (ativas.length === 0) return [];

  // Overrides ativos
  const { data: overrides } = await supabase
    .from("regras_overrides")
    .select("regra_key, silenciada_ate")
    .eq("family_account_id", familyAccountId);

  const silenciadas = new Set(
    (overrides ?? [])
      .filter(
        (o) =>
          !o.silenciada_ate ||
          new Date(o.silenciada_ate as string) > agora,
      )
      .map((o) => o.regra_key as RegraKey),
  );

  const resultados: RunResultado[] = [];

  for (const def of ativas) {
    const key = def.key as RegraKey;
    if (!REGRAS[key]) {
      resultados.push({ regra_key: key, status: "noop", motivo: "evaluator não registrado" });
      continue;
    }
    if (silenciadas.has(key)) {
      resultados.push({ regra_key: key, status: "skipped_override" });
      continue;
    }

    try {
      const r = await processarUmaRegra(supabase, {
        familyAccountId,
        agora,
        key,
        cooldownDias: def.cooldown_dias as number,
        severidadeDefault: def.severidade_default as "info" | "warn" | "high",
        parametros: (def.parametros as Record<string, unknown>) ?? {},
      });
      resultados.push(r);
    } catch (e) {
      await logServerError("regras_engine", e, {
        family_account_id: familyAccountId,
        payload: { regra_key: key },
      });
      resultados.push({
        regra_key: key,
        status: "error",
        motivo: e instanceof Error ? e.message : "erro",
      });
    }
  }

  return resultados;
}

async function processarUmaRegra(
  supabase: SupabaseClient,
  params: {
    familyAccountId: string;
    agora: Date;
    key: RegraKey;
    cooldownDias: number;
    severidadeDefault: "info" | "warn" | "high";
    parametros: Record<string, unknown>;
  },
): Promise<RunResultado> {
  // Alerta open atual (qualquer membro)
  const { data: open } = await supabase
    .from("alertas")
    .select("id, membro_atipico_id, cooldown_ate")
    .eq("family_account_id", params.familyAccountId)
    .eq("regra_key", params.key)
    .eq("estado", "open")
    .maybeSingle();

  // Último alerta resolvido pra checar cooldown global da regra+família
  const { data: ultResolvido } = await supabase
    .from("alertas")
    .select("cooldown_ate")
    .eq("family_account_id", params.familyAccountId)
    .eq("regra_key", params.key)
    .eq("estado", "resolvido")
    .order("resolvido_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cooldownAtivo =
    !open &&
    ultResolvido?.cooldown_ate &&
    new Date(ultResolvido.cooldown_ate as string) > params.agora;

  // Avalia
  const evaluator = REGRAS[params.key];
  const result: RegraResult = await evaluator(supabase, {
    family_account_id: params.familyAccountId,
    agora: params.agora,
    parametros: params.parametros,
  });

  // FIRED
  if (result.fired) {
    if (open) {
      await supabase
        .from("alertas")
        .update({ last_avaliacao_em: params.agora.toISOString() })
        .eq("id", open.id);
      return { regra_key: params.key, status: "fired_existing" };
    }
    if (cooldownAtivo) {
      return { regra_key: params.key, status: "noop", motivo: "em cooldown" };
    }

    // Cria alerta + (opcional) adaptação
    const { data: alertaCriado } = await supabase
      .from("alertas")
      .insert({
        family_account_id: params.familyAccountId,
        membro_atipico_id: result.membro_atipico_id ?? null,
        regra_key: params.key,
        severidade: result.severidade ?? params.severidadeDefault,
        estado: "open",
        contexto: result.contexto,
        mensagem: result.mensagem,
        last_avaliacao_em: params.agora.toISOString(),
      })
      .select("id")
      .single();

    if (alertaCriado) {
      await supabase.from("regras_eventos_log").insert({
        family_account_id: params.familyAccountId,
        regra_key: params.key,
        alerta_id: alertaCriado.id,
        acao: "disparou",
        detalhe: { contexto: result.contexto },
      });

      if (result.sugestaoAdaptacao) {
        await criarAdaptacao(
          supabase,
          params.familyAccountId,
          alertaCriado.id as string,
          result.sugestaoAdaptacao,
        );
      }
    }
    return { regra_key: params.key, status: "fired_new" };
  }

  // RESOLVED — só fecha se há open
  if (result.resolved) {
    if (open) {
      const cooldownAte = new Date(
        params.agora.getTime() + params.cooldownDias * 24 * 60 * 60 * 1000,
      ).toISOString();
      await supabase
        .from("alertas")
        .update({
          estado: "resolvido",
          resolvido_em: params.agora.toISOString(),
          cooldown_ate: cooldownAte,
          last_avaliacao_em: params.agora.toISOString(),
        })
        .eq("id", open.id);
      await supabase.from("regras_eventos_log").insert({
        family_account_id: params.familyAccountId,
        regra_key: params.key,
        alerta_id: open.id,
        acao: "resolveu",
        detalhe: { cooldown_dias: params.cooldownDias },
      });
      return { regra_key: params.key, status: "resolved" };
    }
    return { regra_key: params.key, status: "noop", motivo: "já estava resolvido" };
  }

  return { regra_key: params.key, status: "noop" };
}

async function criarAdaptacao(
  supabase: SupabaseClient,
  familyAccountId: string,
  alertaId: string,
  s: SugestaoAdaptacao,
): Promise<void> {
  const { data: ad } = await supabase
    .from("adaptacoes_sugeridas")
    .insert({
      family_account_id: familyAccountId,
      membro_atipico_id: s.membro_atipico_id ?? null,
      alerta_id: alertaId,
      tipo: s.tipo,
      titulo: s.titulo,
      descricao: s.descricao,
      payload_proposto: s.payload_proposto,
      estado: "pendente",
    })
    .select("id")
    .single();

  if (ad) {
    await supabase.from("regras_eventos_log").insert({
      family_account_id: familyAccountId,
      adaptacao_id: ad.id,
      acao: "adaptacao_proposta",
      detalhe: { tipo: s.tipo, titulo: s.titulo },
    });
  }
}
