"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  cpMembro,
  cpWhatsapp,
  cpAceites,
  cpConcluir,
  cpRascunho,
  type MembroInput,
  type RascunhoOnboarding,
  type ResponsavelInput,
  type SalvarResultado,
} from "@/lib/onboarding/salvar-conversacional";

/** Resolve a família da SESSÃO (nunca confia no cliente). */
async function resolverFamilia(): Promise<{ admin: ReturnType<typeof createServiceRoleClient>; familyId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) return null;
  return { admin: createServiceRoleClient(), familyId: family.id as string };
}

/**
 * Rascunho a cada resposta — dispara em segundo plano, sem `await` na UI. Falha
 * em silêncio de propósito: perder um rascunho é irrelevante perto de travar a
 * pessoa no meio do cadastro.
 */
export async function salvarRascunhoAction(r: RascunhoOnboarding): Promise<void> {
  const ctx = await resolverFamilia();
  if (!ctx) return;
  await cpRascunho(ctx.admin, ctx.familyId, r);
}

export async function salvarMembroAction(m: MembroInput, desafios: string[]): Promise<SalvarResultado> {
  const ctx = await resolverFamilia();
  if (!ctx) return { ok: false, motivo: "erro", mensagem: "Sessão expirada" };
  return cpMembro(ctx.admin, ctx.familyId, m, desafios);
}

export async function salvarWhatsappAction(whatsapp: string): Promise<SalvarResultado> {
  const ctx = await resolverFamilia();
  if (!ctx) return { ok: false, motivo: "erro", mensagem: "Sessão expirada" };
  return cpWhatsapp(ctx.admin, ctx.familyId, whatsapp);
}

export async function salvarAceitesAction(aceites: { termos: boolean; ayla: boolean }): Promise<{ ok: boolean }> {
  const ctx = await resolverFamilia();
  if (!ctx) return { ok: false };
  await cpAceites(ctx.admin, ctx.familyId, aceites);
  return { ok: true };
}

export async function concluirAction(
  r: ResponsavelInput,
  horario: string | null,
): Promise<SalvarResultado> {
  const ctx = await resolverFamilia();
  if (!ctx) return { ok: false, motivo: "erro", mensagem: "Sessão expirada" };
  return cpConcluir(ctx.admin, ctx.familyId, r, horario);
}
