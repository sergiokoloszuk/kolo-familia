import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveFamily } from "@/lib/auth/current-family";
import { pathDeImagem } from "@/lib/storage/imagens";
import { cartoesParaPdf } from "@/lib/ludico/rotina-pdf";
import { capitalizarNome } from "@/lib/nome";

/**
 * PDF dos CARTÕES ILUSTRADOS de uma rotina, pra recortar e pendurar num
 * varalzinho. Só entra o que já foi gerado (tem imagem). Baixa os bytes do
 * bucket privado e monta o PDF em grade de recorte.
 */
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("não autenticado", { status: 401 });
  const { data: family } = await resolveFamily(supabase);
  if (!family) return new Response("sem família", { status: 403 });

  const { data: rotina } = await supabase
    .from("rotinas")
    .select("id, nome")
    .eq("id", id)
    .eq("family_account_id", family.id)
    .maybeSingle();
  if (!rotina) return new Response("rotina não encontrada", { status: 404 });

  const { data: tarefas } = await supabase
    .from("rotina_tarefas")
    .select("texto, nome_tematico, imagem_url, ordem")
    .eq("rotina_id", id)
    .order("ordem", { ascending: true });
  const comImg = (tarefas ?? []).filter((t) => t.imagem_url);
  if (!comImg.length) {
    return new Response("Gere os cartões ilustrados primeiro.", { status: 400 });
  }

  const cartoes: Array<{ titulo: string; bytes: Uint8Array }> = [];
  for (const t of comImg) {
    const path = pathDeImagem(t.imagem_url as string);
    if (!path) continue;
    const { data } = await supabase.storage.from("imagens").download(path);
    if (!data) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    cartoes.push({ titulo: (t.nome_tematico as string | null) || (t.texto as string), bytes });
  }
  if (!cartoes.length) return new Response("Não consegui carregar as imagens.", { status: 500 });

  const nome = capitalizarNome(rotina.nome as string);
  const pdf = await cartoesParaPdf({ titulo: `Cartões — ${nome}`, cartoes });
  const fileName = `cartoes-${(rotina.nome as string).replace(/[^\w-]+/g, "-").slice(0, 40) || "rotina"}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
