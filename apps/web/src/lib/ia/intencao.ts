import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { CHAVES_TEMA } from "@/lib/conducao/temas";

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
 * O TURNO DA WEB — o que ela quer, sobre o quê, e se está aceitando uma oferta.
 *
 * Os três campos saem da MESMA chamada que já existia. O desenho é o do
 * WhatsApp (`lib/ayla/intent.ts`, formato `intencao|tema|aceite`), reusado aqui
 * porque o problema é o mesmo e a mãe não sabe que existem dois canais.
 *
 * O que NÃO foi reusado: a taxonomia de intenção. Lá ela decide qual FERRAMENTA
 * abrir (rotina_criar, plano…); aqui decide o TOM (crise, desabafo…). Copiar
 * aquela lista pra cá abriria ferramenta na web, que é justamente a arquitetura
 * paralela que não queremos.
 */
export type TurnoWeb = {
  intencao: Intencao;
  /** Chave de `lib/conducao/temas.ts`, ou null. Mantém o fio da conversa. */
  tema: string | null;
  /**
   * A mãe está ACEITANDO o que a Kolo acabou de oferecer? Uma frase com o que
   * foi aceito. "sim" não carrega conteúdo: sem o referente resolvido, o modelo
   * reconstrói o turno a partir da conversa inteira e responde outra coisa.
   */
  aceite: string | null;
};

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
  /**
   * ⚠️ SEM ISTO A WEB FICA CEGA. Até 06/08/2026 o parâmetro existia e NENHUM
   * caller o preenchia — `engine.ts` chamava `classificarIntencao({supabase,
   * familyId, texto})` e mais nada. Resultado: no meio de uma conversa, "Sim."
   * era classificado como se fosse a primeira mensagem, o referente sumia e a
   * Kolo respondia outra coisa.
   */
  historico?: { papel: "user" | "assistant"; conteudo: string }[];
  /** Tema do turno anterior — é o que impede o classificador de recomeçar. */
  temaAnterior?: string | null;
}): Promise<TurnoWeb> {
  const { supabase, familyId, texto, historico = [], temaAnterior = null } = params;
  const semModelo: TurnoWeb = { intencao: "desafio", tema: temaAnterior, aceite: null };

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return semModelo;
  }

  const contexto = [
    temaAnterior ? `(Tema do turno anterior: ${temaAnterior} — mantenha se a conversa continuar nele)` : "",
    historico
      .slice(-6)
      .map((h) => `${h.papel === "user" ? "Mãe" : "Kolo"}: ${h.conteudo}`)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);

  const system = `Você classifica a última mensagem de uma mãe/responsável de criança neurodivergente, pra a assistente Kolo responder no tom certo.

Responda em UMA linha, no formato: intencao|tema|aceite
(intenção e tema em minúscula; o aceite em texto normal, ou "-" quando não houver)

A INTENÇÃO é exatamente uma destas:

- crise: algo acontecendo AGORA, sobrecarga, colapso, desespero ("não aguento mais", "tá em crise se jogando no chão", "socorro", "ela não para de gritar agora"). Urgência emocional do momento.
- desabafo: ela quer ser ouvida, está cansada/triste, sem pedir solução ("dia difícil", "tô exausta", "ninguém entende"). Reflexivo, não urgente.
- duvida: pergunta pontual e objetiva, busca uma informação curta.
- desafio: uma dificuldade recorrente do dia a dia que ela quer ajuda pra lidar (sono, birra, escola, transições, alimentação). Este é o caso mais comum — na dúvida, escolha desafio.

⚠️ RESPOSTA CURTA NÃO RECOMEÇA A CONVERSA. "sim", "quero", "vamos", "pode ser", "faz", "essa", "a segunda", "vamos começar por isso" continuam o que já estava acontecendo — olhe a conversa acima pra saber o quê. Nunca classifique uma dessas como se fosse uma mensagem nova e solta.

O TEMA é o assunto do desenvolvimento sobre o qual se está falando. Use EXATAMENTE uma destas chaves, ou "-" se nenhuma servir:
${CHAVES_TEMA.join(", ")}
- CONTINUIDADE MANDA: se a mensagem segue o mesmo assunto, ou é curta/ambígua, REPITA o tema anterior. Não recomece.
- Nunca invente chave fora da lista.

O ACEITE responde: a Kolo OFERECEU fazer alguma coisa na última fala dela, e esta mensagem está aceitando?
- Se sim, escreva em UMA frase O QUE foi aceito, puxando da própria oferta ("montar uma história sobre chegar num grupo de crianças").
- Se a Kolo apenas PERGUNTOU pra entender melhor e a mensagem responde o conteúdo da pergunta ("ele grita", "na escola", "com alguém do lado"), NÃO é aceite: escreva "-".
- Oferta com DUAS opções + "sim" é ambíguo: escreva "-".
- Sem oferta anterior, "-".

Responda só a linha.`;

  const user = `${contexto ? `Conversa até agora:\n${contexto}\n\n` : ""}Última mensagem da mãe:\n"""${texto.slice(0, 1500)}"""\n\nResposta:`;

  let raw: string | null = null;
  let inTok = 0;
  let outTok = 0;
  try {
    const stream = client.messages.stream({
      model: MODELS.leve,
      // 8 bastavam pra uma palavra. Com tema e aceite — este último é uma
      // frase — a linha era cortada no meio e o campo saía pela metade.
      max_tokens: 100,
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
    return semModelo;
  }

  void logarUsoApi(supabase, {
    family_account_id: familyId,
    provider: "anthropic",
    model: MODELS.leve,
    feature: "classificar_intencao",
    input_tokens: inTok,
    output_tokens: outTok,
  });

  const [ladoIntencao, ladoTema, ladoAceite] = (raw ?? "").toLowerCase().split("|");
  const intencao = INTENCOES.find((i) => (ladoIntencao ?? raw ?? "").includes(i)) ?? "desafio";

  // Só chave do vocabulário. Fora da lista = como se nada tivesse sido dito, e
  // aí o tema anterior continua valendo: perder o fio é pior do que ficar um
  // turno com o tema levemente atrasado.
  const candidata = (ladoTema ?? "").trim().replace(/[^a-z_]/g, "");
  const tema = CHAVES_TEMA.includes(candidata) ? candidata : temaAnterior;

  const bruto = (ladoAceite ?? "").trim();
  const aceite = bruto && bruto !== "-" && bruto.length > 3 ? bruto.slice(0, 200) : null;

  return { intencao, tema, aceite };
}
