"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { lerOfertaBlackFridayNoStripe } from "@/lib/billing/oferta-black-friday";
import { CHAVE_PROVA_BACKUP_BLACK_FRIDAY } from "@/lib/billing/estado-black-friday";

export type AcaoBlackFriday = { ok: true; mensagem: string } | { ok: false; erro: string };

export async function registrarProvaBackup(formData: FormData): Promise<void> {
  const prova = String(formData.get("prova") ?? "").trim();
  if (prova.length < 12 || prova.length > 500) {
    throw new Error("Informe uma referência verificável do teste de restauração.");
  }
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("configuracao_geral").upsert({
    chave: CHAVE_PROVA_BACKUP_BLACK_FRIDAY,
    valor: prova,
    descricao: "Referência da prova de backup restaurado antes da ativação",
    updated_at: new Date().toISOString(),
  }, { onConflict: "chave" });
  if (error) throw new Error(`Não foi possível registrar a prova: ${error.message}`);
  revalidatePath("/admin/black-friday");
}

export async function ativarBlackFriday(): Promise<void> {
  const { supabase } = await requireAdmin();
  const preco = await lerOfertaBlackFridayNoStripe();
  if (!preco.ok) throw new Error(preco.problema ?? "Preço promocional não validado.");

  const { data, error } = await supabase.rpc("ativar_black_friday_2026");
  if (error) throw new Error(`A campanha permaneceu desligada: ${error.message}`);
  if (!data) throw new Error("A campanha não confirmou a ativação.");
  revalidatePath("/admin/black-friday");
  revalidatePath("/precos");
  revalidatePath("/assinatura");
}

export async function pausarBlackFriday(): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("pausar_black_friday_2026");
  if (error) throw new Error(`Não foi possível pausar: ${error.message}`);
  if (data !== "pausada") throw new Error(`Estado inesperado ao pausar: ${String(data)}`);
  revalidatePath("/admin/black-friday");
  revalidatePath("/precos");
  revalidatePath("/assinatura");
}
