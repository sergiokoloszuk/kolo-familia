import type { SupabaseClient } from "@supabase/supabase-js";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Geração de imagem via OpenAI (modelo gpt-image-1).
 *
 * Fluxo:
 *   1. Chama POST /v1/images/generations (gpt-image-1 → devolve base64)
 *   2. Decodifica o base64 em bytes
 *   3. Faz upload pro bucket 'imagens' do Supabase Storage
 *   4. Retorna a URL pública (permanente)
 *
 * Path: imagens/{family_id}/{tipo}/{uuid}.png
 *
 * Nota: trocamos dall-e-3 → gpt-image-1 porque a conta OpenAI atual não
 * tem acesso ao dall-e-3 (só aos modelos gpt-image-*). Modelo e qualidade
 * são sobrescrevíveis por env.
 */

const OPENAI_BASE = "https://api.openai.com/v1";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";

// Formato de SAÍDA — JPEG comprimido corta ~6x o peso vs PNG (1024px vira
// ~150-250KB no lugar de ~1,5MB). Resolve a lentidão pra CARREGAR as imagens
// no navegador (rotina com 9 cartões: ~1,8MB no lugar de ~13MB). Escolhemos
// JPEG (não WebP) porque os cartões vão pra PDF (varalzinho) e o pdf-lib só
// embute PNG/JPEG — WebP quebraria o PDF. Ilustrações têm fundo, não precisam
// de transparência. O /edits do gpt-image-1 aceita JPEG como referência.
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

  // 1. Gera a imagem (gpt-image-1 devolve base64 direto, sem URL temporária)
  const genRes = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      n: 1,
      size,
      quality: IMAGE_QUALITY,
      output_format: IMAGE_FORMAT,
      ...(FORMAT_COMPRIMIVEL ? { output_compression: IMAGE_COMPRESSION } : {}),
    }),
  });

  if (!genRes.ok) {
    const t = await genRes.text().catch(() => "");
    throw new Error(`OpenAI imagem ${genRes.status}: ${t.slice(0, 500)}`);
  }

  const genJson = (await genRes.json()) as {
    data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const item = genJson.data?.[0];
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
    model: IMAGE_MODEL,
    feature: params.feature ?? `imagem_${params.tipo}`,
    quantidade: 1,
    meta: { size, quality: IMAGE_QUALITY, tipo: params.tipo },
  });

  return { url, prompt_revisado: item.revised_prompt, storage_path };
}

/**
 * Gera uma imagem usando UMA imagem de referência (o avatar) — mantém o
 * personagem consistente em cenas novas. Usa /v1/images/edits do gpt-image-1.
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
  const fd = new FormData();
  fd.append("model", IMAGE_MODEL);
  fd.append("image", new Blob([new Uint8Array(params.referencia)], { type: refMime }), `ref.${refExt}`);
  fd.append("prompt", params.prompt);
  fd.append("size", params.size ?? "1024x1024");
  fd.append("quality", quality);
  fd.append("output_format", IMAGE_FORMAT);
  if (FORMAT_COMPRIMIVEL) fd.append("output_compression", String(IMAGE_COMPRESSION));

  const res = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI imagem(ref) ${res.status}: ${t.slice(0, 500)}`);
  }
  const json = (await res.json()) as { data: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
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
    model: IMAGE_MODEL,
    feature: params.feature ?? `imagem_${params.tipo}`,
    quantidade: 1,
    meta: { size: params.size ?? "1024x1024", quality, tipo: params.tipo, com_referencia: true },
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
