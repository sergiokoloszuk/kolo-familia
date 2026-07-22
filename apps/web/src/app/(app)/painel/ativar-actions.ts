"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Mesma validação do onboarding (tela-1): E.164 brasileiro.
const schema = z.object({
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+55\d{10,11}$/, "Informe o DDD + número, ex: (11) 99999-9999"),
});

export type AtivarResultado = { ok: true } | { ok: false; erro: string };

/**
 * Ativa a Ayla no WhatsApp a partir da Home: grava o número (se informado) e
 * dá o consentimento (desativada=false, consentimento_em=agora). Reusa a mesma
 * escrita do opt-in do onboarding (saveTela5) — a Ayla passa a poder escrever.
 *
 * OBS: a unicidade do WhatsApp entre famílias ainda não é garantida por
 * constraint (ver pendência whatsapp-único). O RLS impede checar aqui pelo
 * client; a garantia real virá do UNIQUE no banco.
 */
export async function ativarAyla(input: { whatsapp_e164: string }): Promise<AtivarResultado> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Número inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!family) return { ok: false, erro: "Conta não encontrada." };

  const now = new Date().toISOString();

  const { error: eNum } = await supabase
    .from("family_accounts")
    .update({ whatsapp_e164: parsed.data.whatsapp_e164 })
    .eq("id", family.id);
  if (eNum) return { ok: false, erro: "Não consegui salvar o número. Tente de novo." };

  const { error: ePref } = await supabase
    .from("ayla_preferences")
    .upsert(
      {
        family_account_id: family.id,
        desativada: false,
        consentimento_em: now,
      },
      { onConflict: "family_account_id" },
    );
  if (ePref) return { ok: false, erro: "Não consegui ativar a Ayla. Tente de novo." };

  revalidatePath("/painel");
  return { ok: true };
}
