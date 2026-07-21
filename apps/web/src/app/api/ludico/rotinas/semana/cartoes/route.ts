import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveFamily } from "@/lib/auth/current-family";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { pathDeImagem } from "@/lib/storage/imagens";
import { cartoesParaPdf } from "@/lib/ludico/rotina-pdf";
import { capitalizarNome } from "@/lib/nome";

/**
 * PDF dos cartões da SEMANA toda (só os dias já gerados), em ordem de dia, pra
 * recortar e montar o varalzinho da semana.
 */
export const maxDuration = 120;

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("não autenticado", { status: 401 });
  const { data: family } = await resolveFamily(supabase);
  if (!family) return new Response("sem família", { status: 403 });

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", family.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });
  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;
  if (!ativaId) return new Response("nenhuma pessoa ativa", { status: 400 });
  const nome = capitalizarNome((membros ?? []).find((m) => m.id === ativaId)?.nome as string) ?? "";

  const { data: rotinas } = await supabase
    .from("rotinas")
    .select("id, dia_semana")
    .eq("membro_atipico_id", ativaId)
    .eq("family_account_id", family.id)
    .not("dia_semana", "is", null)
    .order("dia_semana", { ascending: true });

  const cartoes: Array<{ titulo: string; bytes: Uint8Array }> = [];
  for (const rot of rotinas ?? []) {
    const dia = rot.dia_semana as number;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto, nome_tematico, imagem_url, ordem")
      .eq("rotina_id", rot.id as string)
      .order("ordem", { ascending: true });
    const comImg = (tarefas ?? []).filter((t) => t.imagem_url);
    for (const t of comImg) {
      const path = pathDeImagem(t.imagem_url as string);
      if (!path) continue;
      const { data } = await supabase.storage.from("imagens").download(path);
      if (!data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const base = (t.nome_tematico as string | null) || (t.texto as string);
      cartoes.push({ titulo: `${DIAS[dia]}: ${base}`, bytes });
    }
  }
  if (!cartoes.length) {
    return new Response("Gere os cartões de pelo menos um dia primeiro.", { status: 400 });
  }

  const pdf = await cartoesParaPdf({ titulo: `Cartões da semana — ${nome}`, cartoes });
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="cartoes-semana.pdf"`,
    },
  });
}
