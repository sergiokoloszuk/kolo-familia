import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Intenção por trás da mensagem da mãe (Fase 2 — roteador de intenção).
 *
 * - crise: algo acontecendo AGORA, sobrecarga/colapso — acolher primeiro,
 *   não despejar plano.
 * - desafio: dificuldade do dia a dia que ela quer ajuda pra lidar (padrão).
 * - duvida: pergunta pontual, objetiva.
 * - desabafo: ela quer ser ouvida, sem pedir solução.
 */
export type Intencao = "crise" | "desafio" | "duvida" | "desabafo";

const INTENCOES: readonly Intencao[] = ["crise", "desafio", "duvida", "desabafo"];

/**
 * Classifica a intenção da última mensagem com o modelo leve (Haiku). É
 * barato e roda antes da resposta pra moldar o tom (crise ≠ desafio).
 *
 * Degradação graciosa: sem chave, erro do modelo ou saída inesperada →
 * "desafio" (o caminho padrão, nunca trava o fluxo).
 */
export async function classificarIntencao(params: {
  supabase: SupabaseClient;
  familyId: string;
  texto: string;
  historico?: { papel: "user" | "assistant"; conteudo: string }[];
}): Promise<Intencao> {
  const { supabase, familyId, texto, historico = [] } = params;

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return "desafio";
  }

  const contexto = historico
    .slice(-4)
    .map((h) => `${h.papel === "user" ? "Mãe" : "Kolo"}: ${h.conteudo}`)
    .join("\n")
    .slice(0, 1200);

  const system = `Você classifica a INTENÇÃO da última mensagem de uma mãe/responsável de criança neurodivergente, pra a assistente Kolo responder no tom certo. Responda com UMA palavra só, exatamente uma destas:

- crise: algo acontecendo AGORA, sobrecarga, colapso, desespero ("não aguento mais", "tá em crise se jogando no chão", "socorro", "ela não para de gritar agora"). Urgência emocional do momento.
- desabafo: ela quer ser ouvida, está cansada/triste, sem pedir solução ("dia difícil", "tô exausta", "ninguém entende"). Reflexivo, não urgente.
- duvida: pergunta pontual e objetiva, busca uma informação curta.
- desafio: uma dificuldade recorrente do dia a dia que ela quer ajuda pra lidar (sono, birra, escola, transições, alimentação). Este é o caso mais comum — na dúvida, escolha desafio.

Responda só a palavra, sem pontuação, sem explicação.`;

  const user = `${contexto ? `Conversa até agora:\n${contexto}\n\n` : ""}Última mensagem da mãe:\n"""${texto.slice(0, 1500)}"""\n\nIntenção (uma palavra):`;

  let raw: string | null = null;
  let inTok = 0;
  let outTok = 0;
  try {
    const stream = client.messages.stream({
      model: MODELS.leve,
      max_tokens: 8,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const final = await stream.finalMessage();
    raw = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    inTok = final.usage.input_tokens;
    outTok = final.usage.output_tokens;
  } catch {
    return "desafio";
  }

  void logarUsoApi(supabase, {
    family_account_id: familyId,
    provider: "anthropic",
    model: MODELS.leve,
    feature: "classificar_intencao",
    input_tokens: inTok,
    output_tokens: outTok,
  });

  const lower = (raw ?? "").toLowerCase();
  const achou = INTENCOES.find((i) => lower.includes(i));
  return achou ?? "desafio";
}
