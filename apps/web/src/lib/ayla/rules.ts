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
import { assinaturaLiberada } from "@/lib/auth/assinatura";
import type { AylaTipoProativa } from "./types";
import { criancaPendente } from "./crianca-especifica";

const COMERCIAL: ReadonlyArray<AylaTipoProativa> = [
  "trial_d3",
  "trial_d0",
  "campanha_promocional",
] as const;

// Proativas de ENGAJAMENTO — só pra quem TEM acesso (trial ativo, assinante,
// cortesia, ou dunning na graça). Trial VENCIDO sem assinar (status ainda
// "trialing", só a data passou) ou assinatura inativa → NÃO recebe estas (era o
// bug: a Ayla voltava a mandar "Sexta chegou / como tá?" pra quem já perdeu o
// acesso). O COMERCIAL (assine) segue podendo — é justamente o convite a voltar.
const REQUER_ACESSO: ReadonlyArray<AylaTipoProativa> = [
  "rotina",
  "engajamento_2dias",
  "engajamento_5dias",
  "insight",
  "repertorio_sugestao",
  "emocional_streak",
  "emocional_conquista",
  "plano_seguimento",
  "recuperacao_plano",
  "fim_de_semana",
] as const;

// Proativas que FALAM DA CRIANÇA — não saem enquanto não houver uma criança
// específica definida. O comercial (trial/assine) e o operacional seguem: não
// dependem de saber de quem se fala.
const ENGAJAMENTO_PRECISA_CRIANCA: ReadonlyArray<AylaTipoProativa> = [
  "rotina",
  "engajamento_2dias",
  "engajamento_5dias",
  "insight",
  "repertorio_sugestao",
  "emocional_streak",
  "emocional_conquista",
  "plano_seguimento",
  "recuperacao_plano",
  "fim_de_semana",
  "boas_vindas",
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

  // 1b. ACESSO: engajamento proativo só pra quem tem acesso liberado (fonte única
  // assinaturaLiberada — trial vencido, past_due sem graça, canceled → bloqueia).
  if ((REQUER_ACESSO as ReadonlyArray<string>).includes(tipo)) {
    const { data: sub } = await supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em")
      .eq("family_account_id", ctx.family_account_id)
      .maybeSingle();
    if (!assinaturaLiberada(sub)) {
      return { permitido: false, motivo: "Sem acesso liberado (trial vencido / assinatura inativa) — engajamento não sai." };
    }
  }

  // 1c. CRIANÇA DEFINIDA: se nenhum membro tem nome de gente (o campo veio com
  // recado — "Cuido de Várias Crianças. Sou Terapeuta!"), o engajamento não faz
  // sentido: falaria de uma criança que não existe. Bloqueia tudo menos o
  // próprio convite, que é o que destrava a conversa (crianca-especifica.ts).
  if (tipo !== "crianca_especifica" && (ENGAJAMENTO_PRECISA_CRIANCA as ReadonlyArray<string>).includes(tipo)) {
    const pendente = await criancaPendente(supabase, ctx.family_account_id);
    if (pendente) {
      return {
        permitido: false,
        motivo: `Sem criança específica definida (nome="${pendente.nomeCru}") — a Ayla precisa resolver isso primeiro.`,
      };
    }
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
