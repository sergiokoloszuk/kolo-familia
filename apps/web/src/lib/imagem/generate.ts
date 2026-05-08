import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Geração de imagem via OpenAI DALL-E 3.
 *
 * Fluxo:
 *   1. Chama POST /v1/images/generations
 *   2. Baixa o PNG da URL temporária da OpenAI
 *   3. Faz upload pro bucket 'imagens' do Supabase Storage
 *   4. Retorna a URL pública (permanente)
 *
 * Path: imagens/{family_id}/{tipo}/{uuid}.png
 *
 * Em caso de OPENAI_API_KEY ausente, throw — UI traduz pra mensagem
 * amigável.
 */

const OPENAI_BASE = "https://api.openai.com/v1";

export type GerarImagemParams = {
  prompt: string;
  familyAccountId: string;
  tipo: "avatar" | "cena" | "historia_social";
  size?: "1024x1024" | "1792x1024" | "1024x1792";
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

  // 1. Pede pra DALL-E 3
  const dallRes = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: params.prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "url",
    }),
  });

  if (!dallRes.ok) {
    const t = await dallRes.text().catch(() => "");
    throw new Error(`DALL-E ${dallRes.status}: ${t.slice(0, 500)}`);
  }

  const dallJson = (await dallRes.json()) as {
    data: Array<{ url: string; revised_prompt?: string }>;
  };
  const item = dallJson.data?.[0];
  if (!item?.url) throw new Error("DALL-E não retornou URL.");

  // 2. Baixa o arquivo
  const imgRes = await fetch(item.url);
  if (!imgRes.ok) {
    throw new Error(`Falha ao baixar imagem da OpenAI: ${imgRes.status}`);
  }
  const blob = await imgRes.blob();

  // 3. Upload no Storage
  const filename = `${crypto.randomUUID()}.png`;
  const path = `${params.familyAccountId}/${params.tipo}/${filename}`;

  const { error: uploadErr } = await supabase.storage
    .from("imagens")
    .upload(path, blob, { contentType: "image/png", upsert: false });
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
