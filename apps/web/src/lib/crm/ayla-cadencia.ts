import type { SupabaseClient } from "@supabase/supabase-js";

/** Situações da Ayla proativa, na ordem que fazem sentido na cadência. */
export const SITUACAO_ORDER = [
  "menu_do_dia",
  "convite_plano",
  "ensinar_valor",
  "feedback_plano",
  "completar_perfil",
  "voce_sabia",
  "acolhimento",
] as const;

export type CadenciaItem = { situacao: string; label: string; diretriz: string; ativo: boolean };

export async function carregarCadencia(admin: SupabaseClient): Promise<CadenciaItem[]> {
  const { data } = await admin
    .from("crm_ayla_cadencia")
    .select("situacao, label, diretriz, ativo");
  const by = new Map((data ?? []).map((r) => [r.situacao as string, r]));
  return SITUACAO_ORDER.map((s) => {
    const r = by.get(s);
    return {
      situacao: s,
      label: (r?.label as string | undefined) ?? s,
      diretriz: (r?.diretriz as string | undefined) ?? "",
      ativo: r?.ativo !== false,
    };
  });
}

/** Map situacao → {diretriz, ativo} pra injetar na geração da proativa. Fail-safe. */
export async function carregarCadenciaMap(
  admin: SupabaseClient,
): Promise<Map<string, { diretriz: string; ativo: boolean }>> {
  try {
    const { data } = await admin.from("crm_ayla_cadencia").select("situacao, diretriz, ativo");
    return new Map(
      (data ?? []).map((r) => [
        r.situacao as string,
        { diretriz: (r.diretriz as string | undefined) ?? "", ativo: r.ativo !== false },
      ]),
    );
  } catch {
    return new Map();
  }
}
