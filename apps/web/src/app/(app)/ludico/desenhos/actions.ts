"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { idadeAnos } from "@/lib/idade";
import { trackFeature } from "@/lib/analytics/track";
import {
  analisarDesenho,
  aprofundarComResposta,
  type MediaTypeImagem,
} from "@/lib/ludico/desenho";
import { resolveFamily } from "@/lib/auth/current-family";
import { requireActiveWrite } from "@/lib/auth/require-active-write";

type Ok<T = object> = { ok: true } & T;
type Fail = { ok: false; error: string };

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
  if (!family) throw new Error("Família não inicializada");
  // Trial vencido / assinatura inativa não escreve nem gera (isto custa IA e
  // imagem). O TrialGate esconde a TELA, mas server action é endpoint próprio:
  // aba aberta antes de vencer, ou chamada direta, passava direto. Admin/staff
  // e cortesia continuam liberados (a regra mora em requireActiveWrite).
  await requireActiveWrite(family.id);
  return { supabase, family };
}

function normalizarMedia(tipo: string): MediaTypeImagem | null {
  if (tipo === "image/jpeg" || tipo === "image/jpg") return "image/jpeg";
  if (tipo === "image/png") return "image/png";
  if (tipo === "image/webp") return "image/webp";
  if (tipo === "image/gif") return "image/gif";
  return null;
}

/**
 * Recebe a foto do desenho + contexto, sobe no Storage, cria o registro e
 * dispara a análise (Claude visão) em segundo plano. Responde rápido com o id;
 * a tela de resultado faz polling pelo status.
 */
export async function enviarDesenho(
  formData: FormData,
): Promise<Ok<{ desenhoId: string }> | Fail> {
  try {
    const { supabase, family } = await requireFamily();

    const file = formData.get("file");
    const membroId = (formData.get("membroId") as string) || null;
    const contexto = ((formData.get("contexto") as string) || "").trim() || null;

    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "Envie uma foto do desenho." };
    if (file.size > 12 * 1024 * 1024)
      return { ok: false, error: "Imagem muito grande (máx. 12 MB)." };
    const mediaType = normalizarMedia(file.type);
    if (!mediaType)
      return { ok: false, error: "Formato não suportado. Use JPG, PNG ou WebP." };

    let membroValido: string | null = null;
    let membroCtx: { nome: string; idade: number | null } | null = null;
    if (membroId) {
      const { data: m } = await supabase
        .from("membros_atipicos")
        .select("id, nome, data_nascimento")
        .eq("id", membroId)
        .eq("family_account_id", family.id)
        .maybeSingle();
      if (m) {
        membroValido = m.id as string;
        membroCtx = {
          nome: m.nome as string,
          idade: idadeAnos((m.data_nascimento as string | null) ?? null),
        };
      }
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext =
      mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : mediaType === "image/gif" ? "gif" : "jpg";
    const path = `${family.id}/desenho/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, bytes, { contentType: mediaType, upsert: false });
    if (upErr) return { ok: false, error: `Não consegui subir a imagem: ${upErr.message}` };
    const { data: pub } = supabase.storage.from("imagens").getPublicUrl(path);
    const imagemUrl = pub.publicUrl;

    const { data: row, error: insErr } = await supabase
      .from("desenhos")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroValido,
        imagem_url: imagemUrl,
        storage_path: path,
        contexto_dia: contexto,
        status: "analisando",
      })
      .select("id")
      .single();
    if (insErr || !row) return { ok: false, error: `Não consegui salvar: ${insErr?.message}` };
    const desenhoId = row.id as string;

    const base64 = bytes.toString("base64");
    const familyId = family.id;
    after(async () => {
      const svc = createServiceRoleClient();
      try {
        const analise = await analisarDesenho(
          { base64, mediaType, membro: membroCtx, contextoDia: contexto ?? undefined },
          { supabase: svc, family_account_id: familyId },
        );
        await svc.from("desenhos").update({ analise, status: "pronto" }).eq("id", desenhoId);
      } catch (e) {
        console.error("[enviarDesenho]", e);
        await svc.from("desenhos").update({ status: "erro" }).eq("id", desenhoId);
      }
    });

    after(() =>
      trackFeature({ familyId: familyId, evento: "ludico_gerado", detalhe: { tipo: "desenho" } }),
    );
    revalidatePath("/ludico/desenhos");
    return { ok: true, desenhoId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const respostaSchema = z.object({
  desenhoId: z.string().uuid(),
  resposta: z.string().trim().max(1000),
});

export async function salvarRespostaCrianca(
  input: z.infer<typeof respostaSchema>,
): Promise<Ok | Fail> {
  try {
    const { desenhoId, resposta } = respostaSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("desenhos")
      .update({ resposta_crianca: resposta || null })
      .eq("id", desenhoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/desenhos/${desenhoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Segunda camada: re-leitura a partir do que a CRIANÇA contou. Gera a partir da
 * análise inicial + da resposta da criança e guarda em analise.releitura (sem
 * migração — nested no jsonb que já existe).
 */
export async function aprofundarDesenho(input: { desenhoId: string }): Promise<Ok | Fail> {
  try {
    const desenhoId = z.string().uuid().parse(input.desenhoId);
    const { supabase, family } = await requireFamily();

    const { data: d } = await supabase
      .from("desenhos")
      .select(
        "id, analise, resposta_crianca, contexto_dia, membros_atipicos(nome, data_nascimento)",
      )
      .eq("id", desenhoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!d) return { ok: false, error: "Desenho não encontrado." };
    const analise = d.analise as {
      observamos?: string[];
      leituras?: string[];
      perguntas?: string[];
      registro?: string;
    } | null;
    if (!analise) return { ok: false, error: "A análise inicial ainda não está pronta." };

    const rel = d.membros_atipicos as
      | { nome: string; data_nascimento: string | null }
      | { nome: string; data_nascimento: string | null }[]
      | null;
    const membroRow = rel ? (Array.isArray(rel) ? rel[0] : rel) : null;
    const membro = membroRow
      ? { nome: membroRow.nome, idade: idadeAnos(membroRow.data_nascimento ?? null) }
      : null;

    const releitura = await aprofundarComResposta(
      {
        analise: {
          observamos: analise.observamos ?? [],
          leituras: analise.leituras ?? [],
          perguntas: analise.perguntas ?? [],
          registro: analise.registro ?? "",
        },
        resposta: (d.resposta_crianca as string | null) ?? "",
        membro,
        contextoDia: (d.contexto_dia as string | null) ?? null,
      },
      { supabase, family_account_id: family.id },
    );

    const { error } = await supabase
      .from("desenhos")
      .update({ analise: { ...analise, releitura } })
      .eq("id", desenhoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/ludico/desenhos/${desenhoId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function excluirDesenho(input: { desenhoId: string }): Promise<Ok | Fail> {
  try {
    const desenhoId = z.string().uuid().parse(input.desenhoId);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("desenhos")
      .delete()
      .eq("id", desenhoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ludico/desenhos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
