import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * Tradução das mensagens PROATIVAS/template da Ayla (geradas em PT) para o
 * idioma da família. É chamada só quando idioma !== 'pt' — o português não
 * passa por aqui (zero custo/latência/risco pro Brasil).
 *
 * Centraliza a multilinguagem no único ponto de envio (enviarEPersistir):
 * boas-vindas, rotina, engajamento, streak, comandos, fim de semana etc. saem
 * traduzidos sem precisar manter versões ES/EN de cada template. A conversa
 * reativa NÃO passa por aqui — ela já é gerada no idioma de quem escreve.
 *
 * Fail-safe: qualquer falha devolve o texto original (nunca bloqueia o envio).
 */

const ALVO: Record<"es" | "en", string> = {
  es: "espanhol latino-americano neutro (trate por \"tú\", sem regionalismos marcados e SEM lusismos — pronome enclítico \"darte/ayudarte\", sem artigo antes de nome próprio)",
  en: "inglês natural e caloroso",
};

export async function traduzirProativa(
  texto: string,
  idioma: "es" | "en",
): Promise<string> {
  try {
    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 700,
      system: `Você traduz mensagens curtas de WhatsApp da Ayla (uma presença calma e acolhedora que apoia famílias de pessoas atípicas) do português para ${ALVO[idioma]}.

Regras:
- Mantenha EXATAMENTE o mesmo tom caloroso, humano e a mesma intenção. Não é tradução literal — é a mesma mensagem, natural na outra língua.
- Preserve como estão: quebras de linha, emojis, nomes próprios, números, horários e QUALQUER link/URL.
- Preserve SEM traduzir as palavras-comando em CAIXA ALTA (ex.: PAUSAR, AJUDA, SAIR, MUDAR HORARIO) — a pessoa digita esses comandos exatamente assim.
- Não adicione, não remova, não explique nada.

Responda APENAS com a tradução, nada mais.`,
      messages: [{ role: "user", content: texto }],
    });
    const bloco = resp.content[0];
    const out = bloco?.type === "text" ? bloco.text.trim() : "";
    return out || texto;
  } catch (e) {
    console.warn(
      "[ayla:traduzir] falha, mantendo português:",
      e instanceof Error ? e.message : e,
    );
    return texto;
  }
}
