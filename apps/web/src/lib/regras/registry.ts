/**
 * Catálogo de regras avaliáveis. Cada uma respeita histerese:
 *   - condição de disparo ≠ condição de resolução
 *   - engine só fecha alerta open quando resolveCondition for true
 */

import type {
  RegraEvaluator,
  RegraEvalCtx,
  RegraKey,
  RegraResult,
} from "./types";

// ----------------------------------------------------------
// REGRA 1: Mãe emocional baixa em 3+ dos últimos 7 check-ins
// ----------------------------------------------------------

const ESTADOS_BAIXOS = ["cansada", "triste", "ansiosa_estressada"] as const;

const maeEmocionalBaixa: RegraEvaluator = async (supabase, ctx) => {
  const limiarDisparo = numParam(ctx, "limiar_disparo", 3);
  const limiarResolucao = numParam(ctx, "limiar_resolucao", 1);
  const janelaDias = numParam(ctx, "janela_dias", 7);

  const desde = new Date(
    ctx.agora.getTime() - janelaDias * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: checkins } = await supabase
    .from("ayla_daily_checkins")
    .select("emocao_mae, date")
    .eq("family_account_id", ctx.family_account_id)
    .gte("date", desde.slice(0, 10));

  const contagem =
    (checkins ?? []).filter((c) =>
      (ESTADOS_BAIXOS as ReadonlyArray<string>).includes(
        c.emocao_mae as string,
      ),
    ).length;

  if (contagem >= limiarDisparo) {
    return {
      fired: true,
      severidade: "warn",
      mensagem:
        "Você marcou cansada/triste em vários dias seguidos. Tudo bem dar um passo pra trás — Kolo Família tem botões de apoio que podem ajudar.",
      contexto: { contagem, janelaDias, limiarDisparo },
    };
  }
  if (contagem <= limiarResolucao) {
    return { fired: false, resolved: true, contexto: { contagem } };
  }
  return { fired: false, resolved: false };
};

// ----------------------------------------------------------
// REGRA 2: DASS-21 com moderado/severo em alguma dimensão
// ----------------------------------------------------------

const dass21ModeradoOuSevero: RegraEvaluator = async (supabase, ctx) => {
  const { data: ult } = await supabase
    .from("dass21_aplicacoes")
    .select(
      "id, data_aplicacao, score_depressao, score_ansiedade, score_estresse, faixa_depressao, faixa_ansiedade, faixa_estresse",
    )
    .eq("family_account_id", ctx.family_account_id)
    .order("data_aplicacao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ult) return { fired: false, resolved: false };

  const faixas = [ult.faixa_depressao, ult.faixa_ansiedade, ult.faixa_estresse];
  const grave = faixas.some(
    (f) => f === "moderada" || f === "severa" || f === "extremamente_severa",
  );

  if (grave) {
    return {
      fired: true,
      severidade: "high",
      mensagem:
        "Sua última DASS-21 mostrou pelo menos um indicador moderado. Isso é hipótese, não diagnóstico — vale conversar com um profissional.",
      contexto: {
        aplicacao_id: ult.id,
        faixa_depressao: ult.faixa_depressao,
        faixa_ansiedade: ult.faixa_ansiedade,
        faixa_estresse: ult.faixa_estresse,
      },
    };
  }
  // Resolve se a última leitura voltou a leve em todas
  return { fired: false, resolved: true };
};

// ----------------------------------------------------------
// REGRA 3: Inatividade — sem registros há N dias
// ----------------------------------------------------------

const inatividadeDiarios: RegraEvaluator = async (supabase, ctx) => {
  const limiarDias = numParam(ctx, "dias", 5);

  const { data: ult } = await supabase
    .from("diarios")
    .select("data")
    .eq("family_account_id", ctx.family_account_id)
    .order("data", { ascending: false })
    .limit(1);

  if (!ult || ult.length === 0) {
    // Sem registros nunca — não dispara, deixa onboarding cuidar
    return { fired: false, resolved: false };
  }

  const ultimo = new Date(ult[0].data as string);
  const dias = Math.floor(
    (ctx.agora.getTime() - ultimo.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dias >= limiarDias) {
    return {
      fired: true,
      severidade: "info",
      mensagem: `Faz ${dias} dias sem registros. Mesmo uma frase curta ajuda a Ayla a continuar afinando.`,
      contexto: { dias_sem: dias, ultimo: ult[0].data },
    };
  }
  if (dias <= 1) {
    return { fired: false, resolved: true, contexto: { dias_sem: dias } };
  }
  return { fired: false, resolved: false };
};

// ----------------------------------------------------------
// REGRA 4: Gatilho recorrente → sugere adicionar ao Kolo Vivo
// ----------------------------------------------------------

const gatilhoRecorrente: RegraEvaluator = async (supabase, ctx) => {
  const limiar = numParam(ctx, "limiar", 3);
  const janelaDias = numParam(ctx, "janela_dias", 14);
  const desde = new Date(
    ctx.agora.getTime() - janelaDias * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: diarios } = await supabase
    .from("diarios")
    .select("possivel_gatilho, membro_atipico_id, data")
    .eq("family_account_id", ctx.family_account_id)
    .not("possivel_gatilho", "is", null)
    .gte("data", desde.slice(0, 10));

  if (!diarios || diarios.length === 0) {
    return { fired: false, resolved: true };
  }

  // Agrupa por (membro_atipico_id, gatilho normalizado)
  const contagem = new Map<string, { qty: number; membroId: string | null; gatilho: string }>();
  for (const d of diarios) {
    const g = (d.possivel_gatilho as string).trim().toLowerCase();
    if (g.length < 4) continue;
    const m = (d.membro_atipico_id as string | null) ?? "";
    const key = `${m}|${g}`;
    const cur = contagem.get(key);
    if (cur) cur.qty++;
    else
      contagem.set(key, {
        qty: 1,
        membroId: m || null,
        gatilho: d.possivel_gatilho as string,
      });
  }

  // Pega o mais frequente que ultrapassou o limiar
  let melhor: { qty: number; membroId: string | null; gatilho: string } | null = null;
  for (const v of contagem.values()) {
    if (v.qty >= limiar && (!melhor || v.qty > melhor.qty)) melhor = v;
  }

  if (!melhor) {
    return { fired: false, resolved: true };
  }

  return {
    fired: true,
    severidade: "info",
    membro_atipico_id: melhor.membroId,
    mensagem: `Você marcou '${melhor.gatilho}' como possível gatilho ${melhor.qty} vezes nos últimos ${janelaDias} dias. Quer registrar isso no Perfil pra que a IA já chegue sabendo?`,
    contexto: {
      gatilho: melhor.gatilho,
      qty: melhor.qty,
      janelaDias,
    },
    sugestaoAdaptacao: {
      tipo: "adicionar_kolo_vivo_desafio",
      titulo: `Adicionar '${melhor.gatilho}' aos desafios do Perfil`,
      descricao:
        "Quando aceito, eu acrescento esse texto na lista 'desafios_regulacao' da camada1 do membro. Reversível — a gente desfaz depois se quiser.",
      membro_atipico_id: melhor.membroId,
      payload_proposto: {
        target: "perfil_vivo_membro",
        membro_atipico_id: melhor.membroId,
        camada: "camada1",
        campo: "desafios_regulacao",
        operacao: "append",
        valor: melhor.gatilho,
      },
    },
  };
};

// ----------------------------------------------------------

export const REGRAS: Record<RegraKey, RegraEvaluator> = {
  mae_emocional_baixa_3em7: maeEmocionalBaixa,
  dass21_moderado_ou_severo: dass21ModeradoOuSevero,
  inatividade_diarios_5d: inatividadeDiarios,
  gatilho_recorrente: gatilhoRecorrente,
};

function numParam(
  ctx: RegraEvalCtx,
  key: string,
  fallback: number,
): number {
  const v = ctx.parametros?.[key];
  return typeof v === "number" ? v : fallback;
}

export function isRegraResult(_x: unknown): _x is RegraResult {
  // Type guard placeholder — TypeScript não precisa, mas deixa explícito
  return true;
}
