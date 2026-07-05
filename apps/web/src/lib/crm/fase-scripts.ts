import type { SupabaseClient } from "@supabase/supabase-js";

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
