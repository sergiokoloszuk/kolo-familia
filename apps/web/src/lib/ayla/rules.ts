/**
 * Regras duras de não-colisão e limite — PRD §12.5.
 *
 * MÁXIMO 2 MENSAGENS PROATIVAS POR DIA, qualquer tipo.
 * Reativas (resposta a inputs da mãe) NÃO contam.
 *
 * Comercial não dispara em janela de 48h após mensagem que mencionou
 * crise/exaustão.
 *
 * Insight não dispara no mesmo dia que comercial.
 *
 * Engajamento não dispara se a última mensagem da Ayla foi há menos de 36h.
 *
 * Se mãe não responder por 10 dias, Ayla cala completamente até ela voltar
 * a responder qualquer coisa.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AylaTipoProativa } from "./types";

const COMERCIAL: ReadonlyArray<AylaTipoProativa> = [
  "trial_d3",
  "trial_d0",
] as const;

export type RulesContext = {
  family_account_id: string;
  agora: Date;
};

export type RuleCheckResult =
  | { permitido: true }
  | { permitido: false; motivo: string };

/**
 * Regras checadas antes de enviar uma mensagem proativa.
 * Reativas pulam todas exceto LGPD-básico (consentimento + desativada).
 */
export async function podeEnviarProativa(
  supabase: SupabaseClient,
  ctx: RulesContext,
  tipo: AylaTipoProativa,
): Promise<RuleCheckResult> {
  // 1. Consentimento explícito + não desativada
  const { data: prefs } = await supabase
    .from("ayla_preferences")
    .select("consentimento_em, pausada_ate, desativada")
    .eq("family_account_id", ctx.family_account_id)
    .maybeSingle();
  if (!prefs) {
    return { permitido: false, motivo: "Sem ayla_preferences (LGPD)." };
  }
  if (!prefs.consentimento_em) {
    return { permitido: false, motivo: "Sem consentimento explícito (LGPD)." };
  }
  if (prefs.desativada) {
    return { permitido: false, motivo: "Mãe desativou a Ayla." };
  }
  if (prefs.pausada_ate && new Date(prefs.pausada_ate) > ctx.agora) {
    return { permitido: false, motivo: "Pausa em vigor." };
  }

  // 2. Limite duro: máx 2 proativas hoje
  const inicioDoDia = startOfDay(ctx.agora);
  const { data: enviadasHoje } = await supabase
    .from("ayla_messages")
    .select("id, tipo")
    .eq("family_account_id", ctx.family_account_id)
    .eq("category", "proativa")
    .eq("direcao", "outbound")
    .gte("created_at", inicioDoDia.toISOString());

  const totalHoje = enviadasHoje?.length ?? 0;
  if (totalHoje >= 2) {
    return { permitido: false, motivo: "Limite de 2 proativas/dia atingido." };
  }

  // 3. Comercial não dispara em janela de 48h após menção de crise/exaustão
  if ((COMERCIAL as ReadonlyArray<string>).includes(tipo)) {
    const limite = new Date(ctx.agora.getTime() - 48 * 60 * 60 * 1000);
    const { data: criseRecente } = await supabase
      .from("ayla_daily_checkins")
      .select("id")
      .eq("family_account_id", ctx.family_account_id)
      .in("emocao_mae", ["cansada", "ansiosa_estressada", "triste"])
      .gte("created_at", limite.toISOString())
      .limit(1);
    if ((criseRecente?.length ?? 0) > 0) {
      return {
        permitido: false,
        motivo: "Janela de 48h após crise/exaustão — comercial bloqueada.",
      };
    }
  }

  // 4. Insight não dispara no mesmo dia que comercial
  if (tipo === "insight") {
    const comercialHoje = enviadasHoje?.some((m) =>
      (COMERCIAL as ReadonlyArray<string>).includes(m.tipo as string),
    );
    if (comercialHoje) {
      return {
        permitido: false,
        motivo: "Comercial já saiu hoje — insight não dispara junto.",
      };
    }
  }

  // 5. Engajamento: última mensagem da Ayla há menos de 36h cancela
  if (tipo === "engajamento_2dias" || tipo === "engajamento_5dias") {
    const limite = new Date(ctx.agora.getTime() - 36 * 60 * 60 * 1000);
    const { data: ultima } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", ctx.family_account_id)
      .eq("direcao", "outbound")
      .gte("created_at", limite.toISOString())
      .limit(1);
    if ((ultima?.length ?? 0) > 0) {
      return {
        permitido: false,
        motivo: "Última mensagem da Ayla foi há <36h — engajamento adiado.",
      };
    }
  }

  // 6. Silêncio total após 10 dias sem resposta
  const { data: ultimaResposta } = await supabase
    .from("ayla_messages")
    .select("created_at")
    .eq("family_account_id", ctx.family_account_id)
    .eq("direcao", "inbound")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: primeiraOutbound } = await supabase
    .from("ayla_messages")
    .select("created_at")
    .eq("family_account_id", ctx.family_account_id)
    .eq("direcao", "outbound")
    .order("created_at", { ascending: true })
    .limit(1);

  const semResposta = (ultimaResposta?.length ?? 0) === 0;
  const referencia = semResposta
    ? primeiraOutbound?.[0]?.created_at
    : ultimaResposta![0].created_at;

  if (referencia) {
    const dias =
      (ctx.agora.getTime() - new Date(referencia).getTime()) /
      (1000 * 60 * 60 * 24);
    if (dias > 10) {
      return {
        permitido: false,
        motivo: "Mais de 10 dias sem resposta — silêncio total até ela voltar.",
      };
    }
  }

  return { permitido: true };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
