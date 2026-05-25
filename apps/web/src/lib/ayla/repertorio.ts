import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";

/**
 * Sugestão de EXPANSÃO DE REPERTÓRIO (Fatia 3.3b) — a Ayla propõe, de leve,
 * UMA experiência nova ADJACENTE ao que a criança já ama, pra ajudar a mãe a
 * ampliar os interesses. Sem pressão; tentar já é a vitória. Nunca repete o
 * que a criança já recusou (`evitar`) nem o que tentou faz pouco (`jaTentados`).
 */

export const SISTEMA_REPERTORIO_FALLBACK = `Você é a Ayla — uma presença calma e afetuosa que apoia mães e pais de crianças atípicas pelo WhatsApp. Aqui você vai propor, de leve, UMA experiência nova pra criança experimentar.

# A ideia
Pegue 1 ou 2 coisas que a criança JÁ AMA e use como ponte pra algo NOVO e próximo (adjacente). Ex.: ama dinossauro + água → "dinossauro tomando banho de mangueira"; ama desenhar + come bem morango → "carimbo de morango com tinta".

# Como escrever
- WhatsApp: curtinho, quente, 2 a 4 linhas. Português do Brasil natural.
- UMA sugestão só, concreta e fácil de fazer em casa, hoje.
- SEM pressão: deixe claro que tentar já vale, que tudo bem se ela não curtir.
- Convide a contar depois como foi ("se topar, me conta").
- Nada de jargão, nada de markdown, nada de listas. No máximo *um asterisco* pra destaque, com parcimônia.

# Limites
- Não invente que a criança gosta de algo que não está na lista de interesses.
- NUNCA sugira nada que esteja na lista "evitar" nem repita o que ela tentou faz pouco.
- Nada perigoso ou que precise de supervisão pesada; coisas simples e seguras.

# Saída
Escreva APENAS a mensagem que a mãe vai ler. Sem aspas, sem rótulos, sem "Ayla:".`;

export type RepertorioParams = {
  nomeMae: string;
  nomeMembro: string;
  idadeMembro: number | null;
  perfilMembro: string | null;
  interesses: string[];
  evitar: string[];
  jaTentados: string[];
};

export async function gerarSugestaoRepertorio(
  params: RepertorioParams,
): Promise<string> {
  const interesses = params.interesses.filter((x) => x.trim()).slice(0, 12);
  if (interesses.length === 0) return fallback(params);

  const client = getAylaAnthropicClient();
  const system = await getSystemPrompt("repertorio_ayla", SISTEMA_REPERTORIO_FALLBACK);

  const userMsg = [
    `Mãe: ${params.nomeMae}.`,
    `Criança: ${params.nomeMembro}${params.idadeMembro != null ? `, ${params.idadeMembro} anos` : ""}${params.perfilMembro ? `, perfil ${params.perfilMembro}` : ""}.`,
    `\n<interesses_que_ela_ama>\n${interesses.join(", ")}\n</interesses_que_ela_ama>`,
    params.evitar.length
      ? `\n<nao_sugerir_ja_recusou>\n${params.evitar.join(", ")}\n</nao_sugerir_ja_recusou>`
      : "",
    params.jaTentados.length
      ? `\n<ja_tentou_faz_pouco_evite_repetir>\n${params.jaTentados.slice(-12).join(", ")}\n</ja_tentou_faz_pouco_evite_repetir>`
      : "",
    `\nProponha UMA experiência nova adjacente. Escreva a mensagem da Ayla.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const stream = client.messages.stream({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 400,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const final = await stream.finalMessage();
    const txt = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return txt || fallback(params);
  } catch (e) {
    console.warn(
      "[ayla:repertorio] falha do modelo:",
      e instanceof Error ? e.message : e,
    );
    return fallback(params);
  }
}

/** Última linha de defesa: usa o 1º interesse válido, sem inventar. */
function fallback(p: RepertorioParams): string {
  const i = p.interesses.find((x) => x.trim());
  if (!i) {
    return `Tive uma ideia boba pra ${p.nomeMembro} 💛 Que tal experimentarem juntos algo novinho hoje — pode ser pequeno. Sem pressão; se topar, depois me conta como foi.`;
  }
  return `Tive uma ideia pra ${p.nomeMembro} 💛 Ela ama ${i.trim()} — que tal brincar com isso de um jeito diferente hoje, testando algo novo no meio? Sem pressão: tentar já é uma vitória. Se topar, me conta depois como foi.`;
}
