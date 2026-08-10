/**
 * PROVIDER CONVERSACIONAL — a única peça que sabe que existe mais de uma API.
 *
 * Responsabilidade EXCLUSIVA: traduzir a chamada de resposta conversacional
 * entre Anthropic e OpenAI, e normalizar o que volta. Nada mais.
 *
 * ⚠️ O QUE NÃO PODE ENTRAR AQUI, e o motivo é a lição desta base inteira:
 * regra da Ayla, classificação, prontidão, geração de artefato, validação de
 * negócio, roteamento. Se qualquer uma dessas descer pra cá, o produto passa a
 * ter DUAS Aylas — uma por provider — e elas divergem. Foi exatamente assim
 * que a web ficou com um motor morto e um vivo.
 *
 * O prompt continua sendo montado por `nucleoConducao()` e
 * `buildSystemTextConversa()`, iguais para os dois braços. Aqui a variável é o
 * MODELO, e só ele.
 *
 * Por que `fetch` cru e não SDK: as chamadas OpenAI que já existem no produto
 * (imagem, transcrição) são `fetch`, não há dependência `openai` instalada, e
 * a superfície usada aqui é uma rota só. Somar um SDK por isso seria pagar
 * risco de versão (esta base já tem o conflito Zod 3/4) sem ganho.
 */

export type Provider = "anthropic" | "openai";

export type MensagemConversa = {
  role: "user" | "assistant";
  /**
   * Texto puro, ou blocos multimodais NO FORMATO ANTHROPIC — que é o formato
   * canônico do produto, porque foi nele que o código nasceu. O provider
   * traduz para a OpenAI; quem chama não precisa saber com quem está falando.
   */
  content: unknown;
};

/** Bloco de imagem como `responder.ts` monta hoje. */
type BlocoImagemAnthropic = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};

/**
 * TRADUZ CONTEÚDO MULTIMODAL — Anthropic → OpenAI.
 *
 * ⚠️ SEM ISTO, TODA MENSAGEM COM FOTO QUEBRA. A Ayla enxerga imagem desde
 * julho: a mãe manda a lição da escola ou o rótulo de um alimento e recebe
 * ajuda sobre AQUILO. `responder.ts` monta o bloco no formato da Anthropic
 * (`{type:"image", source:{type:"base64", media_type, data}}`); a OpenAI usa
 * `{type:"image_url", image_url:{url:"data:<mime>;base64,<dados>"}}`.
 *
 * Repassar cru devolveria 400 do provedor — e a mãe receberia o texto de
 * fallback no lugar de uma resposta sobre a foto dela.
 *
 * O que esta função NÃO faz: mudar como a imagem é interpretada. Ela troca o
 * envelope, nada mais. O prompt que ensina a Ayla a ler a foto continua em
 * `responder.ts`, igual para os dois providers.
 */
function conteudoParaOpenAI(content: unknown): unknown {
  if (typeof content === "string" || !Array.isArray(content)) return content;
  return content.map((bloco) => {
    if (!bloco || typeof bloco !== "object") return bloco;
    const b = bloco as Partial<BlocoImagemAnthropic> & { type?: string };
    if (b.type !== "image" || b.source?.type !== "base64") return bloco;
    const { media_type, data } = b.source;
    // Sem mime ou sem dados o bloco é inútil dos dois lados — deixa passar
    // como estava, e o provedor reclama de forma legível em vez de a gente
    // montar um data-URI quebrado.
    if (!media_type || !data) return bloco;
    return { type: "image_url", image_url: { url: `data:${media_type};base64,${data}` } };
  });
}

export type EntradaConversacional = {
  provider: Provider;
  model: string;
  /** O system prompt já montado. O provider NÃO o modifica. */
  system: string;
  messages: MensagemConversa[];
  maxTokens: number;
  /**
   * Cache do system. Só a Anthropic marca explicitamente; na OpenAI o cache é
   * automático e este campo é ignorado (por isso é opcional e não um `if` no
   * chamador).
   */
  cacheSystem?: boolean;
};

export type SaidaConversacional = {
  texto: string;
  tokensIn: number;
  tokensOut: number;
  /** Tokens de entrada servidos de cache. Os dois providers reportam. */
  cacheRead: number;
  /** Só a Anthropic cobra escrita de cache; na OpenAI vem 0. */
  cacheWrite: number;
  ms: number;
  provider: Provider;
  model: string;
};

/** Modelo conversacional de cada provider, por env, com o default do produto. */
export const MODELO_CONVERSA: Record<Provider, string> = {
  anthropic: process.env.ANTHROPIC_MODEL_PRINCIPAL || "claude-sonnet-4-6",
  // Escolhido com medição registrada em scripts/bancada/ab-conversa/rodar.mjs
  // (o mais novo disponível e 2,5× mais rápido que os irmãos sob o prompt real).
  openai: process.env.OPENAI_MODEL_PRINCIPAL || "gpt-5.6-luna",
};

/**
 * OS TRÊS ESTADOS DO ROLLOUT — uma variável só, e nenhum estado ambíguo.
 *
 *   (ausente) | anthropic | qualquer outra coisa → TODAS as famílias no Claude
 *   openai_teste                                 → SÓ a allowlist no GPT
 *   openai                                       → TODAS as famílias no GPT
 *
 * ⚠️ POR QUE O ESTADO DE TESTE É UM VALOR PRÓPRIO, e não "openai + uma lista
 * que restringe". A segunda forma é menor de escrever e é uma armadilha: a
 * lista passa a ser o que SEGURA o rollout, então esvaziar a variável por
 * engano — apagar, renomear, um deploy que não a carrega — promove todas as
 * famílias pra 100% em silêncio. O acidente mais provável vira o resultado
 * mais perigoso.
 *
 * Aqui é o contrário: sob `openai_teste`, lista vazia = ninguém no GPT. Ir pra
 * 100% exige alguém digitar `openai`, que é uma decisão, não um descuido.
 *
 * O valor é comparado com o texto EXATO (só espaços em volta são tolerados,
 * porque espaço invisível colado num painel não é decisão de ninguém).
 * "OpenAI", "gpt", "opemai" caem no Claude — pior caso é "continua como
 * estava", nunca "para de responder" nem "vai pra todo mundo".
 */
export type ModoConversacional = "anthropic" | "openai_teste" | "openai";

export function modoConversacional(): ModoConversacional {
  const v = (process.env.IA_PROVIDER ?? "").trim();
  if (v === "openai") return "openai";
  if (v === "openai_teste") return "openai_teste";
  return "anthropic";
}

/**
 * As famílias autorizadas no modo de teste — por `family_account_id`, que é o
 * identificador ESTRUTURAL. Nunca por nome, telefone ou qualquer coisa que o
 * modelo possa inferir: a lista precisa ser conferível por quem a escreveu.
 *
 * Separadores aceitos: vírgula, espaço, quebra de linha. Entradas vazias caem
 * fora — "id1,,id2 " é uma lista de dois, e uma lista só de vírgulas é vazia.
 *
 * ⚠️ DUPLICAÇÃO DELIBERADA, e é bom que esteja escrita. Em 10/08/2026 a Fase
 * 4A precisou do mesmo comportamento e extraiu o padrão para
 * `lib/conducao/rollout.ts` (`listaDeFamilias`, `estadoDeRollout`,
 * `alcancaFamilia`). Importá-lo daqui foi tentado e REVERTIDO: este arquivo é
 * defendido por teste como transporte puro, com ZERO imports, e a razão é a
 * lição desta base — quando o provider ganha vizinhos, o produto ganha duas
 * Aylas. Reusar o PADRÃO sem importar a função é o que §4 do protocolo chama
 * de reuso quando a função carrega semântica que não serve.
 *
 * Se estas seis linhas mudarem, mudar as duas. O teste 8 de
 * `conducao/piloto.test.ts` guarda que as duas existem e não divergiram.
 */
function familiasDeTeste(): string[] {
  return (process.env.OPENAI_TEST_FAMILY_IDS ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A DECISÃO, em um lugar só — os dois canais (WhatsApp e Estratégias) chamam
 * ESTA função. Regra duplicada em `responder.ts` e na rota da web seria a
 * forma mais fácil de uma família receber GPT num canal e Claude no outro,
 * dentro da mesma conversa.
 *
 * FAIL CLOSED, sem exceção: id ausente, vazio, não-string ou fora da lista →
 * Claude. Não se escolhe GPT por inferência, e a dúvida sempre resolve pro
 * lado de quem já está funcionando.
 */
export function providerConversacionalParaFamilia(
  familyAccountId?: string | null,
): Provider {
  const modo = modoConversacional();
  if (modo === "anthropic") return "anthropic";
  if (modo === "openai") return "openai";

  // openai_teste — daqui pra baixo, só entra quem está explicitamente na lista.
  const id = typeof familyAccountId === "string" ? familyAccountId.trim() : "";
  if (!id) return "anthropic";
  return familiasDeTeste().includes(id) ? "openai" : "anthropic";
}

/**
 * O provider do rollout GLOBAL — o que uma família sem id identificada recebe.
 * Serve pra contexto sem família (o /api/admin/provider-check) e é a MESMA
 * regra, não uma segunda: no modo de teste devolve Claude, porque é isso que
 * qualquer um fora da lista recebe.
 */
export function providerConversacionalAtivo(): Provider {
  return providerConversacionalParaFamilia(null);
}

class ErroDeProvider extends Error {
  constructor(provider: Provider, status: number | string, detalhe: string) {
    super(`${provider} ${status}: ${detalhe.slice(0, 300)}`);
    this.name = "ErroDeProvider";
  }
}

async function chamarAnthropic(e: EntradaConversacional): Promise<SaidaConversacional> {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: e.model,
      max_tokens: e.maxTokens,
      system: [
        {
          type: "text",
          text: e.system,
          ...(e.cacheSystem ? { cache_control: { type: "ephemeral" } } : {}),
        },
      ],
      messages: e.messages,
    }),
  });
  const j = (await r.json()) as Record<string, any>;
  if (!r.ok || j.error) throw new ErroDeProvider("anthropic", r.status, j?.error?.message ?? "");
  return {
    texto: (j.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join(""),
    tokensIn: j.usage?.input_tokens ?? 0,
    tokensOut: j.usage?.output_tokens ?? 0,
    cacheRead: j.usage?.cache_read_input_tokens ?? 0,
    cacheWrite: j.usage?.cache_creation_input_tokens ?? 0,
    ms: Date.now() - t0,
    provider: "anthropic",
    model: e.model,
  };
}

async function chamarOpenAI(e: EntradaConversacional): Promise<SaidaConversacional> {
  const t0 = Date.now();
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: e.model,
      // ⚠️ `max_completion_tokens`, não `max_tokens`: os modelos de raciocínio
      // rejeitam o nome antigo. E o teto precisa acomodar os tokens de
      // raciocínio, que são cobrados como saída e não aparecem no texto.
      max_completion_tokens: e.maxTokens,
      // O system vira uma MENSAGEM — não é parâmetro separado como na Anthropic.
      // E o conteúdo multimodal muda de envelope: ver `conteudoParaOpenAI`.
      messages: [
        { role: "system", content: e.system },
        ...e.messages.map((m) => ({ role: m.role, content: conteudoParaOpenAI(m.content) })),
      ],
    }),
  });
  const j = (await r.json()) as Record<string, any>;
  if (!r.ok || j.error) throw new ErroDeProvider("openai", r.status, j?.error?.message ?? "");
  return {
    texto: j.choices?.[0]?.message?.content ?? "",
    tokensIn: j.usage?.prompt_tokens ?? 0,
    tokensOut: j.usage?.completion_tokens ?? 0,
    cacheRead: j.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    // O cache da OpenAI é automático: não se marca e não se cobra escrita.
    cacheWrite: 0,
    ms: Date.now() - t0,
    provider: "openai",
    model: e.model,
  };
}

/**
 * Uma resposta conversacional, de qualquer provider, normalizada.
 *
 * Os campos de uso saem com o MESMO nome nos dois casos justamente para que o
 * chamador possa passá-los direto pra `logarUsoApi` sem um `if` de provider —
 * que é como o custo começa a divergir da realidade.
 */
export async function gerarConversacional(
  e: EntradaConversacional,
): Promise<SaidaConversacional> {
  return e.provider === "openai" ? chamarOpenAI(e) : chamarAnthropic(e);
}
