import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";

/**
 * A VOZ da Ayla — gera a resposta que a mãe lê no WhatsApp.
 *
 * Antes a resposta era montada de frases fixas (robótica e incapaz de
 * responder perguntas). Agora um modelo escreve a fala, com tom humano,
 * sabendo o que já conhecemos da criança e respondendo de fato quando a
 * mãe pede ajuda ou descreve uma crise.
 *
 * O parser (Haiku) continua extraindo a estrutura nos bastidores; esta
 * camada usa o modelo principal (Sonnet) porque a qualidade da voz importa.
 */

export const VOZ_AYLA_FALLBACK = `Você é a Ayla — uma presença calma, experiente e afetuosa que apoia mães e pais de crianças atípicas pelo WhatsApp. Você NÃO é um robô nem um aplicativo: fala como uma pessoa que entende de neurodivergência e do cansaço de cuidar.

# Como você fala
- Curto e quente, em português do Brasil. É WhatsApp, não e-mail: 2 a 5 frases na maioria das vezes.
- Linguagem simples, do dia a dia. Nada de jargão clínico nem frases de atendimento ("Entendi.", "Registrei como desafio").
- Varie sempre. Nunca comece igual, nunca soe formulário.
- Português do Brasil natural e correto. NUNCA invente palavras nem force diminutivos estranhos (é "uvinha", não "uvidinha"; "moranguinho", não "moranguidinho"). Na dúvida, use a palavra normal.
- Fale de perto, na 2ª pessoa: "o seu filho", "a sua casa" — não "o filho", "a casa".
- No máximo UMA pergunta — e só se ajudar a conversa a continuar.

# O que fazer em cada caso
- Ela só conta o dia (uma conquista, um perrengue): acolha primeiro o que ela SENTE, de verdade. Comemore junto ou valide o cansaço. Não precisa dar conselho se ela não pediu.
- Ela faz uma PERGUNTA ou descreve uma CRISE acontecendo AGORA ("o que eu faço?", "ele está em crise"): isso é prioridade. Responda de verdade — 1 a 3 passos práticos, gentis e possíveis naquele momento, levando em conta o que já sabemos da criança. Foque em acalmar e regular a criança antes de tudo.
- Mensagem vaga ou cumprimento ("oi", "tudo bem?"): responda no calor humano e convide de leve a contar como foi o dia. Sem soar formulário.

# Limites
- Você não dá diagnóstico, não promete resultado, não fala como médica.
- Se houver sinal de risco (machucar a si ou a outros, violência, desespero): acolha e oriente com firmeza e carinho a buscar ajuda profissional ou emergência. Nunca minimize.
- Use o que sabemos da criança pra personalizar, mas NUNCA invente fatos.

# Saída
Escreva APENAS a mensagem que a mãe vai ler — texto puro de WhatsApp. Sem aspas, sem rótulos, sem "Ayla:". NÃO use markdown (nada de **, ##, ou listas com - / •). Se precisar destacar uma palavra, use *um asterisco só* (negrito do WhatsApp), com muita parcimônia.`;

export type SinaisResposta = {
  conquista: string | null;
  desafio: string | null;
  emocao_mae: string | null;
  temSugestaoKoloVivo: boolean;
};

export type RespostaParams = {
  nomeMae: string;
  nomeMembro: string | null;
  idadeMembro?: number | null;
  perfilMembro?: string | null;
  koloVivoResumo: string;
  historico: Array<{ de: "mae" | "ayla"; texto: string }>;
  mensagem: string;
  sinais: SinaisResposta;
  precisaEscolherMembro?: { nomes: string[] } | null;
};

/**
 * Gera a resposta da Ayla. Se `onParagrafo` for passado, faz streaming e
 * dispara cada parágrafo assim que fica pronto (pra mandar no WhatsApp em
 * pedaços — efeito de "digitando", primeira parte chega rápido). Sempre
 * devolve o texto completo no fim (pra persistir uma vez só).
 */
export async function gerarRespostaAyla(
  params: RespostaParams,
  onParagrafo?: (texto: string) => Promise<void>,
): Promise<string> {
  const client = getAylaAnthropicClient();
  const system = await getSystemPrompt("voz_ayla", VOZ_AYLA_FALLBACK);

  const linhas: string[] = [];
  linhas.push(`Você está falando com ${params.nomeMae}.`);
  if (params.nomeMembro) {
    linhas.push(
      `A criança em foco é ${params.nomeMembro}${params.idadeMembro != null ? `, ${params.idadeMembro} anos` : ""}${params.perfilMembro ? `, perfil ${params.perfilMembro}` : ""}.`,
    );
  }
  if (params.koloVivoResumo.trim()) {
    linhas.push(
      `\n<o_que_ja_sabemos_da_crianca>\n${params.koloVivoResumo}\n</o_que_ja_sabemos_da_crianca>`,
    );
  }
  if (params.historico.length > 0) {
    const hist = params.historico
      .map((h) => `${h.de === "mae" ? params.nomeMae : "Ayla"}: ${h.texto}`)
      .join("\n");
    linhas.push(`\n<conversa_recente>\n${hist}\n</conversa_recente>`);
  }
  linhas.push(`\n<mensagem_de_agora>\n${params.mensagem}\n</mensagem_de_agora>`);

  const notas: string[] = [];
  if (params.precisaEscolherMembro) {
    notas.push(
      `Não ficou claro de qual filho ela fala (${params.precisaEscolherMembro.nomes.join(", ")}). Antes de tudo, pergunte com gentileza de quem é.`,
    );
  }
  if (params.sinais.desafio) {
    notas.push(
      `Nos bastidores já anotei o desafio do dia ("${params.sinais.desafio}") — não repita isso como um robô; no máximo reconheça com naturalidade.`,
    );
  }
  if (params.sinais.conquista) {
    notas.push(`Nos bastidores anotei a conquista ("${params.sinais.conquista}").`);
  }
  if (params.sinais.temSugestaoKoloVivo) {
    notas.push(
      `Apareceu algo que pode valer guardar no perfil da criança (Kolo Vivo). Se — e só se — fizer sentido no fluxo, pergunte de leve se ela quer que eu guarde. Sem insistir.`,
    );
  }
  if (notas.length > 0) {
    linhas.push(`\n<notas_internas>\n${notas.join("\n")}\n</notas_internas>`);
  }
  linhas.push(`\nResponda como a Ayla.`);

  let enviouAlgo = false;
  try {
    const stream = client.messages.stream({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 600,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: linhas.join("\n") }],
    });

    if (!onParagrafo) {
      const final = await stream.finalMessage();
      const txt = textoDe(final.content);
      return txt || fallbackSimples(params);
    }

    // Streaming: manda cada parágrafo (separado por linha em branco) assim
    // que ele fecha. A primeira parte chega bem mais rápido.
    let buffer = "";
    let full = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        buffer += event.delta.text;
        full += event.delta.text;
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const par = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (par) {
            await onParagrafo(par);
            enviouAlgo = true;
          }
        }
      }
    }
    const resto = buffer.trim();
    if (resto) {
      await onParagrafo(resto);
      enviouAlgo = true;
    }
    const fullTrim = full.trim();
    if (!enviouAlgo) {
      const fb = fallbackSimples(params);
      await onParagrafo(fb);
      return fb;
    }
    return fullTrim;
  } catch (e) {
    console.warn("[ayla:responder] falha do modelo:", e instanceof Error ? e.message : e);
    const fb = fallbackSimples(params);
    // Só manda o fallback se ainda não enviou nada (evita resposta partida).
    if (onParagrafo && !enviouAlgo) {
      try {
        await onParagrafo(fb);
      } catch {
        /* não trava o fluxo */
      }
    }
    return fb;
  }
}

function textoDe(content: Array<{ type: string }>): string {
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/** Última linha de defesa: nunca deixar a Ayla muda. */
function fallbackSimples(p: RespostaParams): string {
  const nome = p.nomeMembro ?? "ele";
  if (p.precisaEscolherMembro) {
    return `Tô aqui. Sobre qual deles você quer falar — ${p.precisaEscolherMembro.nomes.join(" ou ")}?`;
  }
  if (p.sinais.desafio) {
    return `Tô com você, ${p.nomeMae}. Respira fundo — um passo de cada vez. Me conta um pouco mais do que tá acontecendo com ${nome} agora?`;
  }
  if (p.sinais.conquista) {
    return `Que coisa boa de ouvir 🌿 Fico feliz por vocês.`;
  }
  return `Tô por aqui, ${p.nomeMae}. Como foi o dia de vocês hoje?`;
}
