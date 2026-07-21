import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import {
  SYSTEM_ROTINA,
  montarUserPromptRotina,
  parseProposta,
  type PropostaRotina,
  type RotinaProposta,
} from "./rotina-ia-core";

/**
 * CÉREBRO da rotina assistida por IA — lado APP (web). Usa o cliente e o log de
 * uso do app. A lógica (prompt + parse) vem do NÚCLEO PURO (rotina-ia-core),
 * compartilhado com a Ayla no WhatsApp. Ver [[rotina-ia-core]].
 */

export type { PropostaRotina, RotinaProposta, TarefaProposta } from "./rotina-ia-core";

export async function interpretarRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string | null;
    nome: string;
    idade: number | null;
    historico: Array<{ de: "mae" | "kolo"; texto: string }>;
    propostaAtual?: RotinaProposta[] | null;
  },
): Promise<PropostaRotina> {
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 2200,
    system: SYSTEM_ROTINA,
    messages: [{ role: "user", content: montarUserPromptRotina(params) }],
  });

  try {
    await logarUsoApi(supabase, {
      family_account_id: params.familyId,
      feature: "ludico_rotina_ia",
      provider: "anthropic",
      model: MODELS.principal,
      input_tokens: msg.usage?.input_tokens ?? 0,
      output_tokens: msg.usage?.output_tokens ?? 0,
    });
  } catch {
    /* logging é best-effort */
  }

  const bloco = msg.content[0];
  const raw = bloco?.type === "text" ? bloco.text : "";
  return parseProposta(raw);
}
