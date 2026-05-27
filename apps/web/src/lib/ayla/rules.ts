/**
 * Regras duras de não-colisão e limite — PRD §12.5 + decisões 2026-05-27.
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
 *
 * NOVO (Sprint C):
 *  - Se a mãe escreveu qualquer coisa hoje, NÃO mandar proativa nova.
 *    "Já conversamos hoje" = não preciso te chamar. (boas_vindas é exceção)
 *  - Respeitar horario_preferido_inicio/fim da família (timezone BR).
 *    Proativas só saem dentro da janela. (boas_vindas é exceção — sai na
 *    hora que termina o onboarding)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { horaLocalHHMM } from "@/lib/idade";
import type { AylaTipoProativa } from "./types";

const COMERCIAL: ReadonlyArray<AylaTipoProativa> = [
  "trial_d3",
  "trial_d0",
  "campanha_promocional",
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
  // 1. Consentimento explícito + não desativada + janela preferida
  const { data: prefs } = await supabase
    .from("ayla_preferences")
    .select(
      "consentimento_em, pausada_ate, desativada, horario_preferido_inicio, horario_preferido_fim",
    )
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

  const inicioDoDia = startOfDay(ctx.agora);

  // 2. "Já conversamos hoje" — se ela escreveu qualquer coisa no dia,
  //    a Ayla não inicia uma nova conversa. Boas-vindas é exceção (é a
  //    primeira mensagem que ela vai receber).
  if (tipo !== "boas_vindas") {
    const { data: inboundHoje } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", ctx.family_account_id)
      .eq("direcao", "inbound")
      .gte("created_at", inicioDoDia.toISOString())
      .limit(1);
    if ((inboundHoje?.length ?? 0) > 0) {
      return {
        permitido: false,
        motivo: "Já conversamos hoje — sem espontânea.",
      };
    }
  }

  // 3. Janela preferida da mãe (timezone BR). Fora dela, a Ayla cala.
  //    Boas-vindas é exceção (dispara no fim do onboarding, qualquer hora).
  if (tipo !== "boas_vindas") {
    const inicio = (prefs.horario_preferido_inicio as string | null)?.slice(0, 5);
    const fim = (prefs.horario_preferido_fim as string | null)?.slice(0, 5);
    if (inicio && fim) {
      const horaAtual = horaLocalHHMM(ctx.agora);
      if (horaAtual < inicio || horaAtual > fim) {
        return {
          permitido: false,
          motivo: `Fora da janela preferida (${inicio}–${fim}).`,
        };
      }
    }
  }

  // 4. Limite duro: máx 2 proativas hoje
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

  // 5. Comercial não dispara em janela de 48h após menção de crise/exaustão
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

  // 6. Insight não dispara no mesmo dia que comercial
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

  // 7. Engajamento: última mensagem da Ayla há menos de 36h cancela
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

  // 8. Silêncio total após 10 dias sem resposta
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
