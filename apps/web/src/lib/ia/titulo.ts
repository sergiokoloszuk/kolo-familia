import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Título curto e bem-escrito pra uma conversa, a partir da 1ª mensagem da
 * família. Substitui o "texto cru cortado em 80 chars" por uma frase limpa
 * (assunto, acentuação correta). IA leve, graceful: erro/sem chave → null
 * (o placeholder cru fica). Roda em background (after()), sem travar a
 * resposta da conversa.
 */

const SYSTEM = `Você resume a mensagem de um adulto responsável (sobre o filho neurodivergente) num TÍTULO curto pra uma lista de conversas.

Regras:
- 3 a 6 palavras, em português do Brasil, com ACENTUAÇÃO e ortografia CORRETAS.
- Capte o ASSUNTO/desafio, não a emoção crua nem o nome da pessoa. Ex.: "Birra na hora de dormir", "Recusa de comida nova", "Transição da escola pra casa".
- Sem aspas, sem ponto final, sem a palavra "conversa" ou "plano". Não invente nomes nem fatos.
- Devolva APENAS o título, nada antes ou depois.`;

export async function gerarTituloConversa(
  admin: SupabaseClient,
  familyId: string | null,
  texto: string,
): Promise<string | null> {
  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return null;
  }

  try {
    const msg = await client.messages.create({
      model: MODELS.leve,
      max_tokens: 32,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: texto.slice(0, 600) }],
    });
    void logarUsoApi(admin, {
      family_account_id: familyId,
      provider: "anthropic",
      model: MODELS.leve,
      feature: "conversa_titulo",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
    const raw = msg.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    // Limpa aspas/ponto final que o modelo às vezes adiciona; corta exageros.
    let t = raw.replace(/^["'“”]+|["'“”]+$/g, "").replace(/[.\s]+$/g, "").trim();
    if (!t) return null;
    if (t.length > 70) t = `${t.slice(0, 70).trim()}…`;
    return t;
  } catch {
    return null;
  }
}
