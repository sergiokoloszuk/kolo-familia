import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaseTrial } from "@/lib/analytics/jornada";
import { classificarFase, FASE_INFO, FASE_ORDEM } from "@/lib/analytics/fases";

const MS_DIA = 86_400_000;
const NAO_USO = new Set(["tela_visitada", "checkout_iniciado", "form_submit"]);

/** Fase de UM lead (mesma lógica do funil/jornada). Pra mostrar a sugestão da fase. */
export async function faseDoLead(admin: SupabaseClient, familyId: string): Promise<FaseTrial> {
  const [{ data: fam }, { data: sub }, { data: events }, { data: planos }, { data: aylaInbound }] =
    await Promise.all([
      admin.from("family_accounts").select("created_at, onboarding_completed").eq("id", familyId).maybeSingle(),
      admin.from("subscription_accesses").select("status, trial_ends_at").eq("family_account_id", familyId).maybeSingle(),
      admin.from("user_events").select("evento, created_at").eq("family_account_id", familyId),
      // Os MESMOS sinais do funil. Sem eles, `classificarFase` receberia false
      // e a divergência voltaria por falta de dado — ainda mais difícil de ver
      // do que por régua diferente.
      admin.from("planos").select("id").eq("family_account_id", familyId).limit(1),
      admin
        .from("ayla_messages")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("direcao", "inbound")
        .limit(1),
    ]);
  const temPlano = (planos?.length ?? 0) > 0;
  const falouComAyla = (aylaInbound?.length ?? 0) > 0;
  let total = 0;
  let usos = 0;
  let ultima = 0;
  for (const e of events ?? []) {
    total += 1;
    if (!NAO_USO.has(e.evento as string)) usos += 1;
    const t = new Date(e.created_at as string).getTime();
    if (t > ultima) ultima = t;
  }
  const agora = Date.now();
  const criado = fam?.created_at ? new Date(fam.created_at as string).getTime() : agora;
  const diaTrial = Math.min(7, Math.max(1, Math.floor((agora - criado) / MS_DIA) + 1));
  const status = (sub?.status as string | null) ?? null;
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at as string).getTime() : null;
  const trialVencido = status === "trialing" && trialEnds != null && trialEnds <= agora;
  // COLETAR é daqui; DECIDIR é de analytics/fases. Esta função tinha uma
  // cópia da régua que exigia uso no APP e ignorava plano e conversa com a
  // Ayla — o mesmo lead aparecia ativado no funil e não aparecia aqui.
  return classificarFase({
    concluiuOnboarding: !!fam?.onboarding_completed,
    usosUltimos90d: usos,
    temAtividade: total > 0,
    temPlano,
    falouComAyla,
    horasSemAtividade: ultima > 0 ? (agora - ultima) / 3600_000 : null,
    statusAssinatura: status,
    trialVencido,
    diaDoTrial: diaTrial,
  });
}

/** Fases em ORDEM CRESCENTE da jornada — usada nas abas Ayla/Abordar/Config. */
export const FASE_ORDER = FASE_ORDEM;

/** Rótulo por fase — vem da régua única; renomear lá renomeia aqui. */
export const FASE_LABEL: Record<string, string> = Object.fromEntries(
  FASE_ORDEM.map((f) => [f, FASE_INFO[f].label]),
);

/** A definição que vai PARA A TELA junto do número. Ver conceito-visivel-no-admin. */
export const FASE_DEFINICAO: Record<string, string> = Object.fromEntries(
  FASE_ORDEM.map((f) => [f, FASE_INFO[f].definicao]),
);

export type FaseScript = { fase: string; label: string; textoAyla: string; textoSugestao: string };

/** Roteiro por fase (editável em Configuração): o que a Ayla faz + sugestão sua. */
export async function carregarFaseScripts(admin: SupabaseClient): Promise<FaseScript[]> {
  const { data } = await admin
    .from("crm_fase_scripts")
    .select("fase, texto_ayla, texto_sugestao");
  const byFase = new Map((data ?? []).map((r) => [r.fase as string, r]));
  return FASE_ORDER.map((f) => {
    const r = byFase.get(f);
    return {
      fase: f,
      label: FASE_LABEL[f] ?? f,
      textoAyla: (r?.texto_ayla as string | undefined) ?? "",
      textoSugestao: (r?.texto_sugestao as string | undefined) ?? "",
    };
  });
}
