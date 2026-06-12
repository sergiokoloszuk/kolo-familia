import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Helper central de URLs do bucket `imagens`.
 *
 * O bucket é PRIVADO (dado de criança: desenhos, fotos, avatares). Em vez de
 * URL pública permanente, servimos uma URL ASSINADA de curta duração, gerada
 * na hora da leitura. Funciona com o cliente de sessão do usuário — a policy
 * de SELECT do storage autoriza a própria família —, então não precisa de
 * service role aqui.
 *
 * Os valores guardados no banco hoje são URLs públicas inteiras
 * (`/object/public/imagens/<path>`); `pathDeImagem` extrai o path de qualquer
 * formato (URL pública, URL assinada ou path nu), então nada precisa ser
 * remigrado: assina-se a partir do que já está salvo.
 */

const BUCKET = "imagens";
/** 2h — folga confortável pra uma sessão; o re-render gera URLs novas. */
const TTL_PADRAO = 60 * 60 * 2;

/**
 * Extrai o storage path (`familyId/tipo/uuid.ext`) de um valor salvo, seja ele
 * URL pública, URL assinada ou já um path nu. Devolve null quando não é do
 * nosso bucket (ex.: URL externa) — aí o chamador mantém o valor original.
 */
export function pathDeImagem(urlOuPath: string | null | undefined): string | null {
  if (!urlOuPath) return null;
  const s = urlOuPath.trim();
  if (!s) return null;
  // URL pública ou assinada do Supabase: .../object/{public|sign}/imagens/<path>?...
  const m = s.match(/\/object\/(?:public|sign)\/imagens\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  // Qualquer outra URL absoluta (host/bucket diferente) → não mexe.
  if (/^https?:\/\//i.test(s)) return null;
  // Path nu.
  return s.replace(/^\/+/, "");
}

/** Assina UMA imagem. Sem path válido, devolve o valor como veio (fallback). */
export async function assinarImagem(
  supabase: SupabaseClient,
  urlOuPath: string | null | undefined,
  ttl: number = TTL_PADRAO,
): Promise<string | null> {
  const path = pathDeImagem(urlOuPath);
  if (!path) return typeof urlOuPath === "string" ? urlOuPath : null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

/**
 * Assina VÁRIAS imagens numa só chamada (listas). Preserva a ordem e o
 * tamanho do array de entrada; para itens sem path válido, devolve o valor
 * original (ou null se não era string).
 */
export async function assinarImagens(
  supabase: SupabaseClient,
  valores: Array<string | null | undefined>,
  ttl: number = TTL_PADRAO,
): Promise<Array<string | null>> {
  const paths = valores.map(pathDeImagem);
  const unicos = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unicos.length === 0) {
    return valores.map((v) => (typeof v === "string" ? v : null));
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, ttl);
  const mapa = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return paths.map((p, i) => {
    if (p && mapa.has(p)) return mapa.get(p)!;
    const orig = valores[i];
    return typeof orig === "string" ? orig : null;
  });
}
