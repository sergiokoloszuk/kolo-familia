import type { SupabaseClient } from "@supabase/supabase-js";
import type { FaseTrial } from "@/lib/analytics/jornada";

const MS_DIA = 86_400_000;
const NAO_USO = new Set(["tela_visitada", "checkout_iniciado", "form_submit"]);

/** Fase de UM lead (mesma lógica do funil/jornada). Pra mostrar a sugestão da fase. */
export async function faseDoLead(admin: SupabaseClient, familyId: string): Promise<FaseTrial> {
  const [{ data: fam }, { data: sub }, { data: events }] = await Promise.all([
    admin.from("family_accounts").select("created_at, onboarding_completed").eq("id", familyId).maybeSingle(),
    admin.from("subscription_accesses").select("status, trial_ends_at").eq("family_account_id", familyId).maybeSingle(),
    admin.from("user_events").select("evento, created_at").eq("family_account_id", familyId),
  ]);
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
  const temAtividade = total > 0;
  const ativadoBool = !!fam?.onboarding_completed && usos >= 1;
  const engajadoBool = usos >= 2;
  const inativo = temAtividade && ultima > 0 && agora - ultima > MS_DIA;
  if (status === "active") return "convertido";
  if (trialVencido || status === "canceled" || status === "paused") return "expirado";
  if (status === "trialing") {
    if (diaTrial >= 6 && usos >= 1) return "oportunidade";
    if (inativo && usos >= 1) return "em_risco";
    if (engajadoBool) return "engajado";
    if (ativadoBool) return "ativado";
    if (temAtividade) return "ativou_teste";
    return "cadastrou";
  }
  return "cadastrou";
}

/** Fases em ORDEM CRESCENTE da jornada — usada nas abas Ayla/Abordar/Config. */
export const FASE_ORDER = [
  "cadastrou",
  "ativou_teste",
  "ativado",
  "engajado",
  "oportunidade",
  "em_risco",
  "expirado",
  "convertido",
] as const;

export const FASE_LABEL: Record<string, string> = {
  cadastrou: "Cadastrou",
  ativou_teste: "Ativou o teste",
  ativado: "Ativado",
  engajado: "Engajado",
  oportunidade: "Oportunidade",
  em_risco: "Em risco",
  expirado: "Expirou sem assinar",
  convertido: "Converteu",
};

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
