"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, loadFamilyContext } from "@/lib/auth/require-user";
import {
  aplicarAdaptacao,
  descartarAdaptacao,
  reverterAdaptacao,
} from "@/lib/regras/adaptacoes";

// ============================================================
// Alertas
// ============================================================

export async function snoozeAlerta(
  alertaId: string,
  dias: number,
): Promise<void> {
  if (dias < 1 || dias > 90) throw new Error("dias entre 1 e 90.");
  const { supabase } = await requireUser();
  const ate = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

  const { data: a } = await supabase
    .from("alertas")
    .update({ estado: "snoozed", snoozed_ate: ate })
    .eq("id", alertaId)
    .eq("estado", "open")
    .select("id, regra_key, family_account_id")
    .single();
  if (!a) throw new Error("Alerta não encontrado ou não está open.");

  await supabase.from("regras_eventos_log").insert({
    family_account_id: a.family_account_id,
    regra_key: a.regra_key,
    alerta_id: a.id,
    acao: "snoozed",
    detalhe: { dias },
  });
  revalidatePath("/configuracoes/regras");
  revalidatePath("/painel");
}

export async function descartarAlerta(alertaId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data: a } = await supabase
    .from("alertas")
    .update({
      estado: "descartado",
      resolvido_em: new Date().toISOString(),
    })
    .eq("id", alertaId)
    .in("estado", ["open", "snoozed"])
    .select("id, regra_key, family_account_id")
    .single();
  if (!a) throw new Error("Alerta não pode ser descartado neste estado.");

  await supabase.from("regras_eventos_log").insert({
    family_account_id: a.family_account_id,
    regra_key: a.regra_key,
    alerta_id: a.id,
    acao: "descartou_alerta",
    detalhe: { motivo: "descartado_manualmente" },
  });
  revalidatePath("/configuracoes/regras");
  revalidatePath("/painel");
}

// ============================================================
// Overrides — silenciar tipo de regra
// ============================================================

const silenciarSchema = z.object({
  regra_key: z.string().min(1).max(80),
  ate_iso: z.string().datetime().optional().nullable(),
  motivo: z.string().trim().max(300).optional(),
});

export async function silenciarRegra(
  input: z.infer<typeof silenciarSchema>,
): Promise<void> {
  const { regra_key, ate_iso, motivo } = silenciarSchema.parse(input);
  const { user, supabase } = await requireUser();
  const { family } = await loadFamilyContext();
  if (!family) throw new Error("Sem família.");

  await supabase.from("regras_overrides").upsert(
    {
      family_account_id: family.id,
      regra_key,
      silenciada_ate: ate_iso ?? null,
      motivo: motivo ?? null,
      created_by_user_id: user.id,
    },
    { onConflict: "family_account_id,regra_key" },
  );

  await supabase.from("regras_eventos_log").insert({
    family_account_id: family.id,
    regra_key,
    acao: "silenciou",
    detalhe: { ate_iso: ate_iso ?? null, motivo: motivo ?? null },
    user_id: user.id,
  });
  revalidatePath("/configuracoes/regras");
}

export async function dessilenciarRegra(regra_key: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { family } = await loadFamilyContext();
  if (!family) throw new Error("Sem família.");

  await supabase
    .from("regras_overrides")
    .delete()
    .eq("family_account_id", family.id)
    .eq("regra_key", regra_key);

  await supabase.from("regras_eventos_log").insert({
    family_account_id: family.id,
    regra_key,
    acao: "dessilenciou",
    detalhe: {},
    user_id: user.id,
  });
  revalidatePath("/configuracoes/regras");
}

// ============================================================
// Adaptações
// ============================================================

export async function aplicarAdaptacaoAction(adaptacaoId: string): Promise<void> {
  const { user, supabase } = await requireUser();
  await aplicarAdaptacao(supabase, adaptacaoId, user.id);
  revalidatePath("/configuracoes/regras");
  revalidatePath("/kolo-vivo");
}

export async function descartarAdaptacaoAction(
  adaptacaoId: string,
): Promise<void> {
  const { user, supabase } = await requireUser();
  await descartarAdaptacao(supabase, adaptacaoId, user.id);
  revalidatePath("/configuracoes/regras");
}

export async function reverterAdaptacaoAction(
  adaptacaoId: string,
): Promise<void> {
  const { user, supabase } = await requireUser();
  await reverterAdaptacao(supabase, adaptacaoId, user.id);
  revalidatePath("/configuracoes/regras");
  revalidatePath("/kolo-vivo");
}
