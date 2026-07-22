import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * Classificador de INTENÇÃO da Ayla — entende o que a mãe/pai quer, em vez de
 * casar palavras-chave (que sempre vaza: "vamos desenhar a rotina" ou "queria
 * organizar os dias dele" escapavam do regex). Roda no modelo leve (Haiku).
 *
 * Usado como sinal PRIMÁRIO no roteamento do orchestrator; os `pede*` de regex
 * ficam como reforço (OR). Em falha, devolve "outro" e o regex decide.
 */
export type IntencaoAyla =
  | "rotina_criar" // montar/criar/desenhar/organizar uma rotina visual
  | "rotina_ver" // ver/trazer uma rotina já existente de um dia
  | "rotina_editar" // ajustar uma rotina existente
  | "plano" // ajuda/estratégia/plano pra um desafio específico
  | "outro"; // desabafo, contar o dia, dúvida, cumprimento, história, desenho

const SYSTEM = `Você classifica a INTENÇÃO da última mensagem de uma mãe/pai falando com a Ayla (assistente de famílias atípicas), no WhatsApp. Entenda a INTENÇÃO, não palavras exatas.

Responda com UMA palavra só, minúscula, sem pontuação, uma destas:
- rotina_criar: quer MONTAR / criar / desenhar / organizar uma rotina visual (de um dia ou da semana). Ex.: "quero uma rotina", "vamos desenhar a rotina do Davi", "me ajuda a organizar melhor os dias dele", "preciso de rotina visual", "poderia montar um quadro pra ele?".
- rotina_ver: quer VER / que você TRAGA uma rotina JÁ montada de um dia. Ex.: "traz a rotina de hoje", "mostra a de terça", "me manda a rotina de amanhã".
- rotina_editar: quer AJUSTAR uma rotina que já existe. Ex.: "faltou o lanche na terça", "tira o vôlei da quarta", "muda a rotina de hoje".
- plano: quer ajuda / estratégia / um plano pra um DESAFIO específico (sono, birra, escola, transição, comida, crise...). Ex.: "me ajuda com o sono dele", "ele não quer ir à escola", "o que faço nas crises?", "a hora do banho tá impossível".
- outro: qualquer outra coisa — contar como foi o dia, desabafo, dúvida geral, cumprimento, pedir história ou leitura de desenho.

Regras importantes:
- "a rotina dele tá difícil / bagunçada" NÃO é rotina_criar — é desabafo/pedido de ajuda (plano ou outro). rotina_criar é quando ela quer CONSTRUIR o quadro.
- Na dúvida entre plano e outro, escolha outro.
- Responda SÓ a palavra.`;

export async function classificarIntencao(params: {
  texto: string;
  /** Última fala da Ayla, se houver — ajuda a entender respostas curtas. */
  ultimaAyla?: string | null;
}): Promise<IntencaoAyla> {
  const texto = (params.texto ?? "").trim();
  if (!texto) return "outro";
  try {
    const user = [
      params.ultimaAyla ? `(A Ayla acabou de dizer: "${params.ultimaAyla.slice(0, 220)}")` : "",
      `Mensagem da mãe/pai: "${texto.slice(0, 500)}"`,
      "Intenção:",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 8,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const b = resp.content[0];
    const raw = (b?.type === "text" ? b.text : "").toLowerCase();

    // Ordem importa: checar os específicos antes de "rotina" solto.
    if (raw.includes("rotina_criar")) return "rotina_criar";
    if (raw.includes("rotina_ver")) return "rotina_ver";
    if (raw.includes("rotina_editar")) return "rotina_editar";
    if (raw.includes("plano")) return "plano";
    return "outro";
  } catch (e) {
    console.warn("[ayla:intent] classificação falhou:", e instanceof Error ? e.message : e);
    return "outro"; // fallback seguro — o regex/reativo decide
  }
}
