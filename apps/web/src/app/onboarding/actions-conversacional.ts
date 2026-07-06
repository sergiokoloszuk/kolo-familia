"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  salvarOnboardingConversacional,
  type RespostasConversacional,
  type SalvarResultado,
} from "@/lib/onboarding/salvar-conversacional";

/**
 * Conclui o onboarding CONVERSACIONAL: resolve a família da SESSÃO (não confia no
 * cliente) e persiste tudo. Devolve o resultado (inclui "whatsapp_duplicado" pro
 * fluxo oferecer "Entrar").
 */
export async function concluirConversacional(
  respostas: RespostasConversacional,
): Promise<SalvarResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "erro", mensagem: "Não autenticado" };

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, onboarding_completed")
    .eq("user_id", user.id)
    .single();
  if (!family) return { ok: false, motivo: "erro", mensagem: "Família não inicializada" };
  if (family.onboarding_completed) return { ok: true }; // idempotente

  const admin = createServiceRoleClient();
  return salvarOnboardingConversacional(admin, family.id as string, respostas);
}
