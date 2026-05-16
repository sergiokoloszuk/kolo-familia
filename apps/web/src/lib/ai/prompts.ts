import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Lê o system prompt da tabela public.ai_prompts, com fallback hardcoded
 * pra garantir que a IA não pare se o DB falhar/estiver vazio.
 *
 * Usa service-role internamente (a tabela é admin-only via RLS, mas as
 * chamadas vêm de contextos diversos — cron, action, parser, etc.).
 */
export async function getSystemPrompt(
  key: string,
  fallback: string,
): Promise<string> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("ai_prompts")
      .select("system_text")
      .eq("key", key)
      .eq("ativo", true)
      .maybeSingle();
    const text = data?.system_text as string | undefined;
    if (text && text.trim().length > 0) return text;
  } catch (e) {
    console.warn(`[ai-prompts] DB error for '${key}', usando fallback:`, e);
  }
  return fallback;
}
