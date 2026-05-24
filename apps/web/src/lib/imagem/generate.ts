import type { SupabaseClient } from "@supabase/supabase-js";

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

export type GerarImagemParams = {
  prompt: string;
  familyAccountId: string;
  tipo: "avatar" | "cena" | "historia_social";
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
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

  // 2. Decodifica o base64 em bytes
  const bytes = Buffer.from(item.b64_json, "base64");

  // 3. Upload no Storage
  const filename = `${crypto.randomUUID()}.png`;
  const path = `${params.familyAccountId}/${params.tipo}/${filename}`;

  const { error: uploadErr } = await supabase.storage
    .from("imagens")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (uploadErr) {
    throw new Error(`Storage upload falhou: ${uploadErr.message}`);
  }

  // 4. URL pública
  const { data: pub } = supabase.storage.from("imagens").getPublicUrl(path);
  if (!pub.publicUrl) {
    throw new Error("Não foi possível obter URL pública do Storage.");
  }

  return {
    url: pub.publicUrl,
    prompt_revisado: item.revised_prompt,
    storage_path: path,
  };
}
