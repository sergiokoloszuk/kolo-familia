"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CHAVE_AYLA_WHATSAPP, gravarConfig } from "@/lib/config/geral";

export type ResultadoNumero = { ok: true; numero: string } | { ok: false; erro: string };

/**
 * Troca o WhatsApp da Ayla — o número que aparece no botão "falar com a Ayla"
 * no fim do cadastro. Aceita o número escrito de qualquer jeito ((11) 96319-7032,
 * +55 11 96319 7032, 5511963197032) e guarda só os dígitos.
 */
export async function salvarWhatsappAyla(bruto: string): Promise<ResultadoNumero> {
  await requireAdmin();

  const num = (bruto ?? "").replace(/\D/g, "");
  if (!num) return { ok: false, erro: "Escreva o número." };
  // 12 = 55 + DDD + 8 dígitos. Menos que isso é digitação incompleta.
  if (num.length < 12) {
    return { ok: false, erro: "Faltam dígitos. Comece pelo 55, depois o DDD e o número." };
  }
  if (num.length > 15) return { ok: false, erro: "Dígitos demais — confira o número." };
  if (!num.startsWith("55")) {
    return { ok: false, erro: "Precisa começar com 55 (Brasil). Ex.: 5511963197032." };
  }

  const ok = await gravarConfig(
    createServiceRoleClient(),
    CHAVE_AYLA_WHATSAPP,
    num,
    'WhatsApp da Ayla — usado no link "falar com a Ayla". Só dígitos, com o 55.',
  );
  if (!ok) return { ok: false, erro: "Não consegui salvar agora. Tente de novo." };

  revalidatePath("/admin/ayla");
  return { ok: true, numero: num };
}
