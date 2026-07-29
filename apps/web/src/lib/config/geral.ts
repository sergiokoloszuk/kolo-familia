import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Configuração geral (chave/valor), editável pelo admin sem deploy — mesma
 * ideia de `configuracao_precos`. Ver migração 0068.
 *
 * Degrada com graça em toda leitura: se a tabela ainda não existe ou a chave
 * não foi preenchida, devolve null e quem chama esconde o recurso. Nada aqui
 * pode derrubar uma página.
 */

export const CHAVE_AYLA_WHATSAPP = "ayla_whatsapp";

export async function lerConfig(
  supabase: SupabaseClient,
  chave: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("configuracao_geral")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    const v = (data?.valor as string | null)?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

export async function gravarConfig(
  supabase: SupabaseClient,
  chave: string,
  valor: string,
  descricao?: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("configuracao_geral").upsert(
      { chave, valor, descricao, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * O WhatsApp da Ayla, só dígitos, ou null se não configurado/implausível.
 * 12 = 55 + DDD + 8 dígitos; abaixo disso é engano de digitação, não número.
 */
export async function whatsappDaAyla(supabase: SupabaseClient): Promise<string | null> {
  const bruto = await lerConfig(supabase, CHAVE_AYLA_WHATSAPP);
  const num = (bruto ?? "").replace(/\D/g, "");
  return num.length >= 12 ? num : null;
}
