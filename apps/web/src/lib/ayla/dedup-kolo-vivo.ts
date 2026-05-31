import { z } from "zod";
import { getAylaAnthropicClient, AYLA_MODEL, AYLA_MODEL_FALLBACK } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import type { UsageTracking } from "./responder";

/**
 * Dedup semântico antes de aplicar uma sugestão no Kolo Vivo (caminho da
 * Ayla WhatsApp). Compara o fato novo com o texto que JÁ existe na mesma
 * seção e decide entre `adicionar` / `reescrever` / `skip`.
 *
 * Rodado em background (dentro de `after()`), depois que a Ayla já respondeu
 * à mãe — não afeta latência percebida.
 *
 * Fallback seguro: se o modelo falhar, devolve `adicionar` com o texto
 * original (preserva info ao invés de perder).
 */

const Schema = z.object({
  operacao: z.enum(["adicionar", "reescrever", "skip"]).default("adicionar"),
  texto: z.string().default(""),
});
export type DedupOperacao = z.infer<typeof Schema>["operacao"];
export type DedupResult = z.infer<typeof Schema>;

const SYSTEM = `Você decide o que fazer com um fato NOVO sobre uma criança atípica, comparando com o texto que JÁ existe na mesma área do perfil (Kolo Vivo).

Devolva APENAS JSON: { "operacao": "adicionar" | "reescrever" | "skip", "texto": "..." }

- "skip" → o fato JÁ está claramente expresso no texto atual (mesmo parafraseado). texto = "".
- "adicionar" → fato genuinamente novo, sem sobreposição. texto = a frase curta nova (1 frase, do jeito que o fato veio).
- "reescrever" → o assunto se SOBREPÕE ou CONTRADIZ o existente; é refinamento. texto = TEXTO COMPLETO E COMPACTO da seção, integrando o velho + o novo, SEM repetir.

# Exemplos
Atual: "Adora dinossauros." | Novo: "Tem hiperfoco em dinossauros e Lego."
→ {"operacao":"reescrever","texto":"Adora dinossauros e Lego — virou hiperfoco."}

Atual: "Não come verdura." | Novo: "Recusa verduras de forma consistente — não aceita nenhum tipo."
→ {"operacao":"skip","texto":""}

Atual: "Fala em 2-3 palavras." | Novo: "Aprendeu a cantar Parabéns."
→ {"operacao":"adicionar","texto":"Aprendeu a cantar Parabéns."}

Atual: "" | Novo: "Faz birra ao trocar de atividade."
→ {"operacao":"adicionar","texto":"Faz birra ao trocar de atividade."}`;

export async function decidirDedup(
  params: {
    campo: string;
    textoSugerido: string;
    textoAtual: string;
  },
  tracking?: UsageTracking,
): Promise<DedupResult> {
  const userMsg = `Campo: ${params.campo}

<texto_atual_da_secao>
${params.textoAtual || "(vazio)"}
</texto_atual_da_secao>

<fato_novo>
${params.textoSugerido}
</fato_novo>

Devolva o JSON.`;

  const client = getAylaAnthropicClient();

  const tentar = async (model: string): Promise<DedupResult | null> => {
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 400,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      });
      const finalMessage = await stream.finalMessage();
      const raw = finalMessage.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (tracking) {
        await logarUsoApi(tracking.supabase, {
          family_account_id: tracking.family_account_id,
          provider: "anthropic",
          model,
          feature: tracking.feature,
          input_tokens: finalMessage.usage.input_tokens,
          output_tokens: finalMessage.usage.output_tokens,
        });
      }
      const json = parseJsonLoose(raw);
      if (!json) return null;
      const safe = Schema.safeParse(json);
      return safe.success ? safe.data : null;
    } catch (e) {
      console.warn(
        `[dedup-kolo-vivo] falha do modelo ${model}:`,
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  };

  const decisao = (await tentar(AYLA_MODEL)) ?? (await tentar(AYLA_MODEL_FALLBACK));
  // Fallback seguro: melhor anexar do que descartar info.
  return decisao ?? { operacao: "adicionar", texto: params.textoSugerido };
}

function parseJsonLoose(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}
