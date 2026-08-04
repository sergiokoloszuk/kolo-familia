import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { gerarImagem, gerarImagemComReferencia } from "@/lib/imagem/generate";
import { logarUsoApi } from "@/lib/billing/logar";
import { pathDeImagem } from "@/lib/storage/imagens";

/**
 * Gerador de cards de ROTINA VISUAL (seção Lúdico).
 *
 * A família define o TEMA e a SEQUÊNCIA de atividades — a IA NÃO muda a rotina,
 * só veste cada atividade no universo do tema e escreve uma historinha. Depois
 * gera um MASCOTE do tema (1 imagem) e ilustra cada card usando o mascote como
 * referência (gpt-image-1 /edits), mantendo o personagem consistente — igual ao
 * que as Histórias fazem com o avatar.
 *
 * O NOME do card NÃO é queimado na imagem (o gpt-image-1 erra texto com acento):
 * a tela e o A4 desenham o nome por cima da ilustração.
 */

const ESTILO =
  "cartoon infantil fofo, traço limpo e arredondado, cores vivas porém suaves, iluminação macia, fundo claro e simples, alta legibilidade";

const CARD_QUALITY = process.env.OPENAI_IMAGE_QUALITY_ROTINA || "medium";

export type CardRoteiro = {
  atividade: string;
  nome_tematico: string;
  cena: string;
};

export type RoteiroRotina = {
  historia: string;
  mascote: string;
  cards: CardRoteiro[];
};

/**
 * ⚠️ O TEMA VESTE, NÃO SUBSTITUI. Foi a instrução daqui que quebrou o "Dia do
 * dentista" (04/08/2026): o prompt mandava "VESTIR cada atividade no universo
 * do tema" e dava como exemplo renomear as etapas (POSTO DOS CAMPEÕES,
 * LAVA-RÁPIDO TURBO). Resultado: o dentista virou "mago do sorriso", o carro
 * virou carruagem e a cadeira do dentista virou cadeira mágica.
 *
 * A rotina visual existe pra PREVISIBILIDADE. Se a criança chega no consultório
 * esperando um mago e encontra um dentista, o quadro fez o oposto do que devia.
 * A princesa pode estar lá — o dentista continua dentista.
 */
const SYSTEM = `Você cria ROTINAS VISUAIS para crianças neurodivergentes, em português do Brasil. A família te dá um TEMA e a LISTA DE ETAPAS, NA ORDEM que ela definiu. Você NÃO inventa, NÃO remove e NÃO reordena etapas.

Devolva APENAS um JSON, sem nada antes ou depois:
{
  "historia": "uma historinha curta que PREPARA a criança pro que vai acontecer — ver as regras da história abaixo",
  "mascote": "descrição visual de UM personagem do tema que aparece em TODOS os cards (ex.: 'uma princesa de vestido lilás, cabelo cacheado, sorriso amigável'). Um só, coerente do começo ao fim.",
  "cards": [
    {
      "atividade": "a etapa original, IDÊNTICA à recebida",
      "nome_tematico": "o nome da etapa, curto e em CAIXA ALTA, dizendo O QUE ACONTECE DE VERDADE (ex.: CADEIRA DO DENTISTA, HORA DO BANHO, CAFÉ DA MANHÃ)",
      "cena": "descrição VISUAL da cena: o personagem do tema vivendo aquela etapa, com os objetos REAIS e reconhecíveis da situação, fundo limpo. Em português. NÃO inclua texto na cena."
    }
  ]
}

⚠️ REGRA PRINCIPAL — O TEMA VESTE, NÃO SUBSTITUI A REALIDADE.
O tema entra no PERSONAGEM, nas roupas, nas cores e no clima do desenho. Ele NUNCA troca o que a criança vai encontrar de verdade.
- dentista continua dentista (não "mago do sorriso", não "fada dos dentes");
- consultório continua consultório, cadeira do dentista continua cadeira do dentista;
- carro continua carro (não carruagem), escola continua escola, banheiro continua banheiro.
Pode existir uma princesa indo ao dentista, de vestido, num carro. Não pode existir um mago numa carruagem quando a criança vai de carro ao dentista.
Se a criança chega ao lugar esperando o que viu no card e encontra outra coisa, o quadro fez o contrário do que existe pra fazer.

Regras dos cards:
- Use EXATAMENTE as etapas recebidas, na MESMA ordem e na mesma quantidade.
- "nome_tematico" nomeia o que acontece, não uma fantasia. Se a etapa é "Sento na cadeira" num dia de dentista, é CADEIRA DO DENTISTA — nunca CADEIRA MÁGICA.
- "cena" concreta e ilustrável, com os objetos daquela situação real; o MESMO personagem em todas.

Regras da HISTÓRIA:
- Ela COMPLEMENTA os cards, não os repete. Os cards mostram o que acontece; a história ajuda a criança a entender e a se preparar por dentro.
- Curta, concreta, na voz de um adulto lendo pra criança, adequada à idade.
- Diga o que ela vai encontrar, o que pode acontecer, o que ela pode fazer, e como pedir ajuda ou avisar que não está gostando, quando fizer sentido.
- Deixe claro que existe começo, meio e FIM ("depois acaba, e a gente vai pra casa").
- NUNCA prometa resultado: nada de "você vai ficar calmo", "não vai doer", "vai ser rápido", "vai adorar". Prometer o que você não controla quebra a confiança na próxima vez.
- Não termine sempre em dormir: a rotina pode ser um passeio, uma consulta, um momento. Feche onde ela realmente termina.
- ANTI-ABA: nada de recompensa por concluir, nada de "se fizer ganha", nada de comida ou interesse como prêmio.`;

export async function gerarRoteiroRotina(
  params: {
    tema: string;
    atividades: string[];
    idade: number | null;
    nomeRotina: string;
    /** Personagem = a própria criança (avatar) em vez de um mascote do tema. */
    usarAvatar?: boolean;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<RoteiroRotina> {
  const client = getAnthropicClient();
  const lista = params.atividades.map((a, i) => `${i + 1}. ${a}`).join("\n");
  const instrucaoAvatar = params.usarAvatar
    ? `\n\nIMPORTANTE: o personagem dos cards é a PRÓPRIA CRIANÇA (vamos usar o avatar dela como referência visual). NÃO invente um mascote temático. No campo "mascote", escreva apenas "a própria criança". Em cada "cena", descreva a CRIANÇA fazendo a atividade${params.tema ? ", com elementos do tema ao redor" : ""}.`
    : "";
  const userMsg = `Tema: ${params.tema}
Rotina: ${params.nomeRotina}${params.idade != null ? `\nIdade da criança: ${params.idade} anos` : ""}

Atividades (use exatamente estas, nesta ordem):
${lista}

Devolva o JSON com ${params.atividades.length} cards, na mesma ordem.${instrucaoAvatar}`;

  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 3000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const final = await stream.finalMessage();
  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "rotina_roteiro",
      input_tokens: final.usage.input_tokens,
      output_tokens: final.usage.output_tokens,
      meta: { n_cards: params.atividades.length, tema: params.tema },
    });
  }
  const raw = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const roteiro = parseRoteiro(raw);
  if (!roteiro) throw new Error("Não consegui montar a rotina temática. Tente outro tema.");
  return roteiro;
}

/**
 * Gera o mascote (1 imagem de referência) e ilustra cada card usando o mascote
 * como referência — personagem consistente. Concorrência limitada + retry.
 */
export async function ilustrarCards(
  supabase: SupabaseClient,
  params: {
    familyAccountId: string;
    tema: string;
    mascoteDescricao: string;
    cards: CardRoteiro[];
    /** Se vier, usa ESTA imagem (o avatar da criança) como personagem dos cards
     *  em vez de gerar um mascote do tema. */
    referenciaUrl?: string;
    /** Arte que JÁ existe, por índice de card. Índice preenchido não é
     *  redesenhado — é o caminho da edição pela Ayla, onde só os passos novos
     *  precisam de imagem (o resto já custou geração e a mãe já viu). */
    arteExistente?: Array<string | null>;
  },
): Promise<{ mascoteUrl: string; imagens: Array<string | null> }> {
  // 1. Personagem de referência: o avatar da criança (se veio referenciaUrl) ou
  //    um mascote do tema gerado na hora (pose neutra, fundo branco).
  let mascoteUrl: string;
  if (params.referenciaUrl) {
    mascoteUrl = params.referenciaUrl;
  } else {
    const mascoteRes = await gerarImagem(supabase, {
      prompt: `Personagem mascote para cards de rotina infantil, estilo ${ESTILO}. ${params.mascoteDescricao}. Corpo inteiro, pose amigável e neutra, sorrindo, centralizado, fundo branco liso. SEM nenhum texto, letra ou número.`,
      familyAccountId: params.familyAccountId,
      tipo: "cena",
      feature: "rotina_mascote",
    });
    mascoteUrl = mascoteRes.url;
  }
  const mascoteBytes = await baixarBytes(supabase, mascoteUrl);

  // 2. Ilustra cada card com o mascote como referência (2 paralelas, 1 retry).
  //    Card que já tem arte passa batido (edição pela Ayla).
  const PARALELAS = 2;
  const imagens: Array<string | null> = params.cards.map(
    (_, i) => params.arteExistente?.[i] ?? null,
  );
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= params.cards.length) return;
      if (imagens[i]) continue; // já ilustrado
      const prompt = montarPromptCard(params.tema, params.cards[i].cena);
      imagens[i] = await ilustrarComRetry(
        supabase,
        prompt,
        mascoteBytes,
        params.familyAccountId,
      );
    }
  }
  await Promise.all(Array.from({ length: PARALELAS }, () => worker()));

  return { mascoteUrl, imagens };
}

function montarPromptCard(tema: string, cena: string): string {
  return `Card quadrado de rotina visual infantil, tema "${tema}", estilo ${ESTILO}.

Use a imagem de referência APENAS para a IDENTIDADE do personagem (o MESMO mascote: mesma forma, cor e cara). NÃO copie a pose da referência.

Redesenhe o mascote fazendo a ação, integrado a uma cena simples com objetos concretos e reconhecíveis. Composição centralizada, fundo claro e limpo (quase branco), bastante legível. SEM nenhum texto, letra ou número na imagem.

Cena: ${cena}`;
}

async function ilustrarComRetry(
  supabase: SupabaseClient,
  prompt: string,
  referencia: Buffer,
  familyAccountId: string,
): Promise<string | null> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await gerarImagemComReferencia(supabase, {
        prompt,
        referencia,
        familyAccountId,
        tipo: "cena",
        quality: CARD_QUALITY,
        feature: "rotina_card",
      });
      return r.url;
    } catch (e) {
      console.warn(`[rotina.ilustrar] tentativa ${tentativa}:`, e instanceof Error ? e.message : e);
      if (tentativa === 2) return null;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

// Bucket privado → baixa o mascote via Storage (download por path), não por
// URL pública. Fallback de fetch só pra valores fora do nosso bucket (legado).
async function baixarBytes(supabase: SupabaseClient, url: string): Promise<Buffer> {
  const path = pathDeImagem(url);
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      if (path) {
        const { data, error } = await supabase.storage.from("imagens").download(path);
        if (error || !data) throw new Error(error?.message ?? "download vazio");
        return Buffer.from(await data.arrayBuffer());
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (tentativa === 3) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new Error("não baixou o mascote");
}

function parseRoteiro(s: string): RoteiroRotina | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      candidate = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as { historia?: unknown; mascote?: unknown; cards?: unknown };
  if (typeof obj.historia !== "string" || typeof obj.mascote !== "string") return null;
  if (!Array.isArray(obj.cards)) return null;
  const cards: CardRoteiro[] = [];
  for (const c of obj.cards) {
    if (!c || typeof c !== "object") continue;
    const cc = c as { atividade?: unknown; nome_tematico?: unknown; cena?: unknown };
    if (typeof cc.atividade !== "string" || typeof cc.nome_tematico !== "string") continue;
    cards.push({
      atividade: cc.atividade,
      nome_tematico: cc.nome_tematico,
      cena: typeof cc.cena === "string" ? cc.cena : cc.atividade,
    });
  }
  if (cards.length === 0) return null;
  return { historia: obj.historia, mascote: obj.mascote, cards };
}
