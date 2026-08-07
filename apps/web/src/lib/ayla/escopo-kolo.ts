import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";

/**
 * EXISTE UM ALVO KOLO NESTE PEDIDO?
 *
 * ⚠️ POR QUE EXISTE (07/08/2026, provado no código): `pedeUmPlano` só olha se
 * a mensagem tem "plano" + um verbo de pedido. "Quero um plano de
 * aposentadoria" passa. E na ponte, pedido explícito entra com `forcar`, que
 * PULA o gate de suficiência inteiro — então sairia um Plano Kolo sobre
 * previdência, em PDF, com link.
 *
 * ═══ POR QUE NÃO É UMA LISTA DE ASSUNTOS PROIBIDOS ═══
 *
 * A primeira ideia é bloquear palavras: aposentadoria, divórcio, férias,
 * negócios. Não serve, e o motivo é o coração desta regra: o mesmo assunto
 * está dentro ou fora dependendo de quem é o alvo.
 *
 *   "Vou me separar do meu marido"              → fora
 *   "Como explico a separação pro Pedro?"       → DENTRO
 *   "Quero um plano de férias"                  → fora
 *   "Nas férias ele sofre com a mudança"        → DENTRO
 *
 * Uma denylist erraria os dois de baixo, que são exatamente as horas em que a
 * família mais precisa. O que se pergunta, então, não é "o assunto é
 * permitido?" — é "o pedido é sobre a pessoa acompanhada?".
 *
 * ═══ POR QUE NÃO REUSA O GATE DE SUFICIÊNCIA ═══
 *
 * `avaliarProntidaoParaPlano` já responde algo parecido, mas exige problema
 * DEFINIDO + contexto + exemplo concreto. Rodá-lo no pedido explícito
 * devolveria o interrogatório que a regra "pedido explícito gera direto" veio
 * matar. Aqui a pergunta é mais estreita e barata: tem alvo, sim ou não.
 *
 * Consentimento e escopo são coisas diferentes. Pedido explícito dispensa
 * perguntar "quer que eu monte?"; não dispensa saber se é isso que se monta.
 */

/** O critério, em português e num lugar só — é conteúdo pra Karina ajustar. */
export const CRITERIO_ALVO_KOLO = `A Kolo apoia UMA pessoa acompanhada — bebê, criança, adolescente ou adulto — no que envolve desenvolvimento, autonomia, comunicação, aprendizagem, participação, relações, comportamento do dia a dia, regulação, habilidades funcionais, rotina, previsibilidade, transições, adaptação a mudanças e qualidade de vida cotidiana.

A PERGUNTA É UMA SÓ: este pedido é sobre a pessoa acompanhada?

SEPARE CONTEXTO DE ALVO. O que acontece na vida da família é CONTEXTO; o que aquilo muda ou exige da pessoa acompanhada é o ALVO. Um assunto pode ter os dois, e aí você atende só a parte que é sua.

TEM ALVO (gere):
- "faz um plano pro Pedro começar a lição sem eu cobrar" — a pessoa acompanhada está no centro;
- "nas férias ele sofre com a mudança de rotina" — o assunto é viagem, o alvo é adaptação;
- "como explico a separação pro Pedro?" — o assunto é separação, o alvo é comunicação e preparo;
- "vou me aposentar e ela estranha eu não sair de casa" — o alvo é mudança de referência e rotina.

NÃO TEM ALVO (não gere):
- "quero um plano de aposentadoria" — previdência, financeiro;
- "faça um plano de negócios";
- "quero um plano pras minhas férias" com destino, hotel, roteiro, orçamento;
- "vou me separar do meu marido" — decisão conjugal, jurídica, guarda, pensão, patrimônio;
- qualquer pedido cuja resposta seria sobre o adulto, o casal, dinheiro, trabalho ou processo.

NA DÚVIDA, considere que TEM alvo. Recusar um pedido legítimo custa mais que organizar algo a mais: a família veio pedir ajuda com o filho, e ser mandada embora por causa de uma palavra é pior que receber um plano que ela não precisava.

Quando NÃO houver alvo mas o assunto puder gerar necessidades da pessoa acompanhada, escreva em "ponte" a virada — o que VOCÊ pode ajudar ali, em uma frase, sem opinar sobre a parte que não é sua.`;

export type Escopo = {
  temAlvo: boolean;
  /** Uma frase que reconduz ao que é da Kolo. Vazia quando `temAlvo`. */
  ponte: string;
};

/**
 * Atalho barato: a mensagem cita a pessoa acompanhada pelo nome, ou fala dela
 * em terceira pessoa? Aí não há o que classificar — e não se paga uma chamada
 * de modelo em "faz um plano pro Pedro começar a lição".
 */
export function citaAPessoa(texto: string, nomes: readonly string[]): boolean {
  const t = texto.toLowerCase();
  if (nomes.some((n) => n && n.trim().length >= 3 && t.includes(n.trim().toLowerCase())))
    return true;
  // `pr[ao]` cobre "pro ele" e "pra ele" — a mãe escreve dos dois jeitos, e a
  // primeira versão só pegava um.
  return /\b(meu filho|minha filha|meu bebê|meu bebe|pr[ao] (ele|ela)\b|dele\b|dela\b)/.test(t);
}

/**
 * Roda SÓ no caminho do pedido explícito, onde o gate de suficiência é pulado.
 *
 * Falha aberta de propósito: se o modelo não responder, devolve `temAlvo`.
 * O custo de bloquear um pedido legítimo por causa de um timeout é maior que
 * o de gerar um plano a mais.
 */
export async function avaliarAlvoKolo(
  _supabase: SupabaseClient,
  params: { mensagem: string; nomesDosMembros?: readonly string[] },
): Promise<Escopo> {
  if (citaAPessoa(params.mensagem, params.nomesDosMembros ?? [])) {
    return { temAlvo: true, ponte: "" };
  }
  try {
    const client = getAylaAnthropicClient();
    const r = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 200,
      system: `${CRITERIO_ALVO_KOLO}\n\nResponda APENAS JSON: {"temAlvo":true|false,"ponte":"..."}`,
      messages: [{ role: "user", content: params.mensagem.slice(0, 800) }],
    });
    const b = r.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { temAlvo: true, ponte: "" };
    const o = JSON.parse(m[0]) as { temAlvo?: unknown; ponte?: unknown };
    const temAlvo = o.temAlvo !== false;
    return {
      temAlvo,
      ponte: temAlvo ? "" : String(o.ponte ?? "").trim().slice(0, 400),
    };
  } catch {
    return { temAlvo: true, ponte: "" };
  }
}
