import type { SupabaseClient } from "@supabase/supabase-js";
import { logarUsoApi } from "@/lib/billing/logar";
import { logEvent } from "@/lib/log";
import { deveTentarProximoModelo, resolverModelosImagem } from "./models";

/**
 * Geração de imagem via OpenAI (família GPT Image).
 *
 * Fluxo:
 *   1. Chama POST /v1/images/generations (devolve base64)
 *   2. Decodifica o base64 em bytes
 *   3. Faz upload pro bucket 'imagens' do Supabase Storage
 *   4. Retorna a URL pública (permanente)
 *
 * Path: imagens/{family_id}/{tipo}/{uuid}.png
 *
 * O modelo não é um ponto único de falha. A OpenAI desligou `gpt-image-1` em
 * 23/10/2026; por isso, geração e edição usam a mesma cadeia de modelos
 * compatíveis e avançam automaticamente só em falha técnica/modelo removido.
 * Moderação NÃO faz failover: trocar de modelo não pode contornar segurança.
 */

const OPENAI_BASE = "https://api.openai.com/v1";
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";

/**
 * Sunburst primeiro porque o Lúdico depende de edição precisa para preservar
 * a identidade do avatar. Flare é o segundo caminho rápido, e GPT-Image-2 é o
 * fallback de família diferente. Todos suportam generation + edits e o mesmo
 * contrato de saída usado aqui.
 *
 * `OPENAI_IMAGE_MODELS` aceita uma lista separada por vírgula. O legado
 * `OPENAI_IMAGE_MODEL` continua aceito, mas nunca consegue prender produção ao
 * `gpt-image-1` desligado. Os padrões são anexados à lista configurada para que
 * uma troca de env não recrie um ponto único de falha.
 */
const IMAGE_MODELS = resolverModelosImagem();

// Formato de SAÍDA — JPEG comprimido corta ~6x o peso vs PNG (1024px vira
// ~150-250KB no lugar de ~1,5MB). Resolve a lentidão pra CARREGAR as imagens
// no navegador (rotina com 9 cartões: ~1,8MB no lugar de ~13MB). Escolhemos
// JPEG (não WebP) porque os cartões vão pra PDF (varalzinho) e o pdf-lib só
// embute PNG/JPEG — WebP quebraria o PDF. Ilustrações têm fundo, não precisam
// de transparência. Os modelos GPT Image aceitam JPEG como referência.
const IMAGE_FORMAT = (process.env.OPENAI_IMAGE_FORMAT || "jpeg").toLowerCase();
const IMAGE_COMPRESSION = Number(process.env.OPENAI_IMAGE_COMPRESSION || "78");
const FORMAT_COMPRIMIVEL = IMAGE_FORMAT === "webp" || IMAGE_FORMAT === "jpeg";

/** Sniff simples do MIME de uma imagem, pra rotular a referência do /edits. */
function sniffMime(b: Buffer): "image/webp" | "image/jpeg" | "image/png" {
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return "image/png";
}

export type GerarImagemParams = {
  prompt: string;
  familyAccountId: string;
  tipo: "avatar" | "cena" | "historia_social";
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  /** Label da feature pra o log em api_calls. Default: "imagem_<tipo>". */
  feature?: string;
};

export type GerarImagemResult = {
  url: string;
  prompt_revisado?: string;
  storage_path: string;
};


/**
 * O ERRO DE IMAGEM QUE A FAMÍLIA LÊ.
 *
 * A mensagem crua da OpenAI ia direto pra tela: em 04/08/2026 uma mãe viu
 * `OpenAI imagem(ref) 400: {"error":{"message":"Your request was rejected by
 * the safety system…","code":"moderation_blocked"…` na página do avatar. Ela
 * não fez nada errado, e um JSON em inglês não diz o que fazer.
 *
 * A moderação de imagem é estrita com personagem infantil, e o bloqueio quase
 * sempre é do RESULTADO, não do pedido — costuma bastar tentar outra descrição.
 * O detalhe técnico continua no log; o que muda é o que ela lê.
 */
type ErroImagem = Error & {
  status?: number;
  code?: string | null;
  requestId?: string | null;
  modelosTentados?: string[];
};

function codigoDoErro(corpo: string): string | null {
  try {
    const parsed = JSON.parse(corpo) as { error?: { code?: unknown } };
    return typeof parsed.error?.code === "string" ? parsed.error.code : null;
  } catch {
    return null;
  }
}

function erroDeImagem(
  status: number,
  corpo: string,
  onde: string,
  detalhes?: { requestId?: string | null; modelosTentados?: string[] },
): ErroImagem {
  console.warn(`[imagem] ${onde} ${status}: ${corpo.slice(0, 500)}`);
  let mensagem: string;
  if (/moderation_blocked|safety system/i.test(corpo)) {
    mensagem =
      "A geração dessa imagem foi bloqueada pelo filtro de conteúdo — costuma acontecer com fantasias e personagens conhecidos, e não é nada que você tenha feito de errado. Tente descrever de outro jeito (por exemplo, \"capa de super-herói\" em vez do nome de um personagem).";
  } else if (status === 429 || status >= 500) {
    mensagem = "O gerador de imagens está congestionado agora. Tenta de novo em um minutinho?";
  } else {
    mensagem = "Não consegui gerar a imagem agora. Tenta de novo — e se continuar, me avisa.";
  }
  return Object.assign(new Error(mensagem), {
    status,
    code: codigoDoErro(corpo),
    requestId: detalhes?.requestId ?? null,
    modelosTentados: detalhes?.modelosTentados ?? [],
  });
}

type UsoImagem = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
};

type RespostaImagemApi = {
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  usage?: UsoImagem;
};

async function chamarImagemComFailover(
  onde: string,
  executar: (modelo: string) => Promise<Response>,
): Promise<{ resposta: RespostaImagemApi; modelo: string; modelosTentados: string[] }> {
  const modelosTentados: string[] = [];
  let ultimoErro: ErroImagem | null = null;

  for (const modelo of IMAGE_MODELS) {
    modelosTentados.push(modelo);
    const res = await executar(modelo);
    if (res.ok) {
      return {
        resposta: (await res.json()) as RespostaImagemApi,
        modelo,
        modelosTentados,
      };
    }

    const corpo = await res.text().catch(() => "");
    ultimoErro = erroDeImagem(res.status, corpo, `${onde}/${modelo}`, {
      requestId: res.headers.get("x-request-id"),
      modelosTentados: [...modelosTentados],
    });
    if (!deveTentarProximoModelo(res.status, corpo)) throw ultimoErro;
  }

  throw ultimoErro ?? new Error("Nenhum modelo de imagem está configurado.");
}

function custoImagem25(modelo: string, uso?: UsoImagem): number | undefined {
  if (!modelo.startsWith("gpt-image-2.5-") || !uso) return undefined;
  const texto = uso.input_tokens_details?.text_tokens ?? 0;
  const imagem = uso.input_tokens_details?.image_tokens ?? 0;
  const saida = uso.output_tokens ?? 0;
  return (texto * 5 + imagem * 8 + saida * 30) / 1_000_000;
}

async function registrarFalhaImagem(params: {
  familyAccountId: string;
  feature: string;
  endpoint: "generations" | "edits";
  erro: unknown;
}): Promise<void> {
  const erro = params.erro as ErroImagem;
  await logEvent({
    kind: "imagem_geracao_falhou",
    severity: "error",
    family_account_id: params.familyAccountId,
    message: `${params.feature} falhou em /images/${params.endpoint}`,
    payload: {
      feature: params.feature,
      endpoint: params.endpoint,
      status: erro.status ?? null,
      code: erro.code ?? null,
      request_id: erro.requestId ?? null,
      modelos_tentados: erro.modelosTentados ?? [],
    },
  });
}

async function registrarFailoverImagem(params: {
  familyAccountId: string;
  feature: string;
  endpoint: "generations" | "edits";
  modelo: string;
  modelosTentados: string[];
}): Promise<void> {
  if (params.modelosTentados.length < 2) return;
  await logEvent({
    kind: "imagem_modelo_fallback",
    severity: "warn",
    family_account_id: params.familyAccountId,
    message: `${params.feature} continuou com ${params.modelo}`,
    payload: {
      feature: params.feature,
      endpoint: params.endpoint,
      modelo_usado: params.modelo,
      modelos_tentados: params.modelosTentados,
    },
  });
}

export async function gerarImagem(
  supabase: SupabaseClient,
  params: GerarImagemParams,
): Promise<GerarImagemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Adicione em apps/web/.env.local.",
    );
  }

  const size = params.size ?? "1024x1024";

  let chamada: Awaited<ReturnType<typeof chamarImagemComFailover>>;
  try {
    chamada = await chamarImagemComFailover("geração", (modelo) =>
      fetch(`${OPENAI_BASE}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelo,
          prompt: params.prompt,
          n: 1,
          size,
          quality: IMAGE_QUALITY,
          output_format: IMAGE_FORMAT,
          ...(FORMAT_COMPRIMIVEL ? { output_compression: IMAGE_COMPRESSION } : {}),
        }),
      }),
    );
  } catch (erro) {
    await registrarFalhaImagem({
      familyAccountId: params.familyAccountId,
      feature: params.feature ?? `imagem_${params.tipo}`,
      endpoint: "generations",
      erro,
    });
    throw erro;
  }

  const item = chamada.resposta.data?.[0];
  if (!item?.b64_json) throw new Error("O modelo de imagem não retornou conteúdo.");

  // 2. Decodifica + sobe no Storage
  const bytes = Buffer.from(item.b64_json, "base64");
  const { url, storage_path } = await uploadImagem(
    supabase,
    bytes,
    params.familyAccountId,
    params.tipo,
    IMAGE_FORMAT,
  );

  await logarUsoApi(supabase, {
    family_account_id: params.familyAccountId,
    provider: "openai",
    model: chamada.modelo,
    feature: params.feature ?? `imagem_${params.tipo}`,
    input_tokens: chamada.resposta.usage?.input_tokens,
    output_tokens: chamada.resposta.usage?.output_tokens,
    custo_usd: custoImagem25(chamada.modelo, chamada.resposta.usage),
    meta: {
      size,
      quality: IMAGE_QUALITY,
      tipo: params.tipo,
      modelos_tentados: chamada.modelosTentados,
      usage: chamada.resposta.usage ?? null,
    },
  });

  await registrarFailoverImagem({
    familyAccountId: params.familyAccountId,
    feature: params.feature ?? `imagem_${params.tipo}`,
    endpoint: "generations",
    modelo: chamada.modelo,
    modelosTentados: chamada.modelosTentados,
  });

  return { url, prompt_revisado: item.revised_prompt, storage_path };
}

/**
 * Gera uma imagem usando UMA imagem de referência (o avatar) — mantém o
 * personagem consistente em cenas novas. Usa /v1/images/edits.
 * É o que dá ao "livro de histórias" o mesmo personagem em todas as páginas.
 */
export async function gerarImagemComReferencia(
  supabase: SupabaseClient,
  params: {
    prompt: string;
    referencia: Buffer;
    familyAccountId: string;
    tipo: "avatar" | "cena" | "historia_social";
    size?: GerarImagemParams["size"];
    /** Sobrescreve a qualidade (ex.: "high" pras histórias). Default: env. */
    quality?: string;
    feature?: string;
  },
): Promise<GerarImagemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const quality = params.quality ?? IMAGE_QUALITY;
  const refMime = sniffMime(params.referencia);
  const refExt = refMime === "image/webp" ? "webp" : refMime === "image/jpeg" ? "jpg" : "png";
  let chamada: Awaited<ReturnType<typeof chamarImagemComFailover>>;
  try {
    chamada = await chamarImagemComFailover("geração com referência", (modelo) => {
      // FormData não pode ser reaproveitado depois de uma tentativa; cada
      // modelo recebe um corpo novo com os mesmos bytes e parâmetros.
      const fd = new FormData();
      fd.append("model", modelo);
      fd.append(
        "image",
        new Blob([new Uint8Array(params.referencia)], { type: refMime }),
        `ref.${refExt}`,
      );
      fd.append("prompt", params.prompt);
      fd.append("size", params.size ?? "1024x1024");
      fd.append("quality", quality);
      fd.append("output_format", IMAGE_FORMAT);
      if (FORMAT_COMPRIMIVEL) fd.append("output_compression", String(IMAGE_COMPRESSION));
      return fetch(`${OPENAI_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });
    });
  } catch (erro) {
    await registrarFalhaImagem({
      familyAccountId: params.familyAccountId,
      feature: params.feature ?? `imagem_${params.tipo}`,
      endpoint: "edits",
      erro,
    });
    throw erro;
  }

  const b64 = chamada.resposta.data?.[0]?.b64_json;
  if (!b64) throw new Error("O modelo de imagem não retornou conteúdo (ref).");

  const bytes = Buffer.from(b64, "base64");
  const { url, storage_path } = await uploadImagem(
    supabase,
    bytes,
    params.familyAccountId,
    params.tipo,
    IMAGE_FORMAT,
  );

  await logarUsoApi(supabase, {
    family_account_id: params.familyAccountId,
    provider: "openai",
    model: chamada.modelo,
    feature: params.feature ?? `imagem_${params.tipo}`,
    input_tokens: chamada.resposta.usage?.input_tokens,
    output_tokens: chamada.resposta.usage?.output_tokens,
    custo_usd: custoImagem25(chamada.modelo, chamada.resposta.usage),
    meta: {
      size: params.size ?? "1024x1024",
      quality,
      tipo: params.tipo,
      com_referencia: true,
      modelos_tentados: chamada.modelosTentados,
      usage: chamada.resposta.usage ?? null,
    },
  });

  await registrarFailoverImagem({
    familyAccountId: params.familyAccountId,
    feature: params.feature ?? `imagem_${params.tipo}`,
    endpoint: "edits",
    modelo: chamada.modelo,
    modelosTentados: chamada.modelosTentados,
  });

  return { url, storage_path };
}

async function uploadImagem(
  supabase: SupabaseClient,
  bytes: Buffer,
  familyAccountId: string,
  tipo: string,
  ext: string = "png",
): Promise<{ url: string; storage_path: string }> {
  const extLimpa = ext === "jpg" ? "jpeg" : ext;
  const contentType =
    extLimpa === "webp" ? "image/webp" : extLimpa === "jpeg" ? "image/jpeg" : "image/png";
  const filename = `${crypto.randomUUID()}.${extLimpa === "jpeg" ? "jpg" : extLimpa}`;
  const path = `${familyAccountId}/${tipo}/${filename}`;
  const { error: uploadErr } = await supabase.storage
    .from("imagens")
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadErr) {
    throw new Error(`Storage upload falhou: ${uploadErr.message}`);
  }
  const { data: pub } = supabase.storage.from("imagens").getPublicUrl(path);
  if (!pub.publicUrl) {
    throw new Error("Não foi possível obter URL pública do Storage.");
  }
  return { url: pub.publicUrl, storage_path: path };
}
