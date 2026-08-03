import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { nucleoConducao } from "@/lib/conducao/diretrizes";
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
    // O gerador oficial carrega o NÚCLEO. Até 03/08/2026 `SYSTEM_ROTINA` era um
    // prompt solto: sem identidade, sem piso, sem fronteira diagnóstica nem
    // clínica. Era a mesma "segunda Ayla" que matamos no condutor do WhatsApp,
    // viva do lado do app — e é por ali que a rotina da Clarinha teria passado
    // ainda mais desprotegida.
    system: `${nucleoConducao()}

${SYSTEM_ROTINA}`,
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
