"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { gerarImagem, gerarImagemComReferencia } from "@/lib/imagem/generate";
import { assinarImagem, pathDeImagem } from "@/lib/storage/imagens";
import {
  montarPromptCanonico,
  AVATAR_ESTILOS,
  AVATAR_ESTILO_VALUES,
  type AvatarDescricao,
} from "@/lib/imagem/avatar-prompt";
import { resolveFamily } from "@/lib/auth/current-family";

async function requireFamilyAndMembro(membroId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
  if (!family) throw new Error("Família não inicializada");
  const { data: membro } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("id", membroId)
    .eq("family_account_id", family.id)
    .single();
  if (!membro) throw new Error("Membro não encontrado");
  return { supabase, user, family, membro };
}

const descricaoSchema = z.object({
  membroId: z.string().uuid(),
  estilo: z.enum(AVATAR_ESTILO_VALUES),
  idade: z.coerce.number().int().min(0).max(120).nullable().optional(),
  generoVisual: z.enum(["menino", "menina", "neutro"]).nullable().optional(),
  tomPele: z
    .enum(["muito_clara", "clara", "media", "morena", "negra_clara", "negra"])
    .nullable()
    .optional(),
  cabeloCor: z.string().trim().max(80).nullable().optional(),
  cabeloComprimento: z.enum(["curto", "medio", "longo"]).nullable().optional(),
  cabeloTextura: z.enum(["liso", "ondulado", "cacheado", "crespo"]).nullable().optional(),
  oculos: z.coerce.boolean().optional(),
  tracosMarcantes: z.string().trim().max(300).nullable().optional(),
  roupasFrequentes: z.string().trim().max(300).nullable().optional(),
});

export type CriarAvatarInput = z.infer<typeof descricaoSchema>;

export type GerarAvatarResult =
  | { ok: true; avatarId: string; imagem_url: string; prompt_revisado?: string }
  | { ok: false; error: string };

/**
 * Cria UM NOVO avatar a partir da descrição, gera a imagem e já o deixa como
 * selecionado (o usado nas Histórias/Rotinas). Vários avatares por membro
 * convivem — este vira o escolhido.
 */
export async function criarEGerarAvatar(
  input: CriarAvatarInput,
): Promise<GerarAvatarResult> {
  try {
    const { membroId, ...desc } = descricaoSchema.parse(input);
    const { supabase, family } = await requireFamilyAndMembro(membroId);
    await requireActiveWrite(family.id);

    const descricao = desc as AvatarDescricao;
    const promptCanonico = montarPromptCanonico(descricao);

    // Gera ANTES de inserir — se a geração falhar, não fica avatar órfão.
    const admin = createServiceRoleClient();
    const result = await gerarImagem(admin, {
      prompt: promptCanonico,
      familyAccountId: family.id,
      tipo: "avatar",
      feature: "avatar_geracao",
    });

    // O novo vira o selecionado: tira a seleção dos outros, insere já marcado.
    await supabase
      .from("avatares_membros_atipicos")
      .update({ selecionado: false })
      .eq("membro_atipico_id", membroId);

    const { data: novo, error } = await supabase
      .from("avatares_membros_atipicos")
      .insert({
        membro_atipico_id: membroId,
        family_account_id: family.id,
        estilo: desc.estilo,
        descricao_textual: desc,
        imagem_url: result.url,
        prompt_canonico: promptCanonico,
        selecionado: true,
      })
      .select("id")
      .single();
    if (error || !novo) {
      return { ok: false, error: `Imagem gerada, mas falhou ao salvar: ${error?.message}` };
    }

    revalidatePath(`/configuracoes/avatar/${membroId}`);
    revalidatePath("/configuracoes/avatar");

    // Bucket privado → assina pro preview imediato no formulário.
    const previewUrl = await assinarImagem(supabase, result.url);

    return {
      ok: true,
      avatarId: novo.id as string,
      imagem_url: previewUrl ?? result.url,
      prompt_revisado: result.prompt_revisado,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const vestirSchema = z.object({
  avatarId: z.string().uuid(),
  ocasiao: z.string().trim().min(1).max(200),
});

/**
 * "Vestir" o avatar (Sérgio/Karina, jun/2026): mantém EXATAMENTE o mesmo
 * personagem (mesma cara, cabelo, estilo) e troca só a roupa/figurino pra uma
 * ocasião — festa junina, aniversário, Natal, tema do mês… Usa a imagem do
 * avatar como referência (gpt-image-1 /edits), igual às Histórias. Salva como
 * um NOVO avatar (a versão original continua na galeria) e já o deixa em uso.
 */
export async function vestirAvatar(
  input: z.infer<typeof vestirSchema>,
): Promise<GerarAvatarResult> {
  try {
    const { avatarId, ocasiao } = vestirSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado" };
    const { data: family } = await resolveFamily(supabase);
    if (!family) return { ok: false, error: "Família não inicializada" };
    await requireActiveWrite(family.id);

    const { data: base } = await supabase
      .from("avatares_membros_atipicos")
      .select("id, membro_atipico_id, estilo, descricao_textual, imagem_url")
      .eq("id", avatarId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!base) return { ok: false, error: "Avatar não encontrado." };

    const admin = createServiceRoleClient();

    // Baixa os bytes do avatar base (bucket privado) pra usar como referência.
    const path = pathDeImagem(base.imagem_url as string);
    if (!path) return { ok: false, error: "Não localizei a imagem do avatar base." };
    const { data: file, error: dErr } = await admin.storage.from("imagens").download(path);
    if (dErr || !file) {
      return { ok: false, error: `Falha ao ler a imagem do avatar: ${dErr?.message}` };
    }
    const bytes = Buffer.from(await file.arrayBuffer());

    const estiloDef = AVATAR_ESTILOS.find((e) => e.value === base.estilo) ?? AVATAR_ESTILOS[0];
    const prompt = `${estiloDef.prompt}. Mantenha EXATAMENTE o mesmo personagem da imagem de referência — mesmo rosto, cabelo, tom de pele e identidade visual. Mude APENAS a roupa/figurino para: ${ocasiao}. Corpo inteiro, expressão acolhedora, postura natural, fundo neutro claro, sem texto, sem letras, sem logotipos, ilustração 2D, NÃO fotorrealista.`;

    const result = await gerarImagemComReferencia(admin, {
      prompt,
      referencia: bytes,
      familyAccountId: family.id,
      tipo: "avatar",
      feature: "avatar_vestir",
    });

    // O novo (vestido) vira o selecionado.
    await supabase
      .from("avatares_membros_atipicos")
      .update({ selecionado: false })
      .eq("membro_atipico_id", base.membro_atipico_id);

    const desc = {
      ...((base.descricao_textual as Record<string, unknown>) ?? {}),
      roupasFrequentes: ocasiao,
    };
    const { data: novo, error } = await supabase
      .from("avatares_membros_atipicos")
      .insert({
        membro_atipico_id: base.membro_atipico_id,
        family_account_id: family.id,
        estilo: base.estilo,
        descricao_textual: desc,
        imagem_url: result.url,
        prompt_canonico: prompt,
        selecionado: true,
      })
      .select("id")
      .single();
    if (error || !novo) {
      return { ok: false, error: `Imagem gerada, mas falhou ao salvar: ${error?.message}` };
    }

    revalidatePath("/configuracoes/avatar");
    revalidatePath(`/configuracoes/avatar/${base.membro_atipico_id}`);
    const previewUrl = await assinarImagem(supabase, result.url);
    return { ok: true, avatarId: novo.id as string, imagem_url: previewUrl ?? result.url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const idSchema = z.object({ avatarId: z.string().uuid() });
export type AvatarAcaoResult = { ok: true } | { ok: false; error: string };

/** Escolhe qual avatar do membro é o usado (selecionado). */
export async function selecionarAvatar(
  input: z.infer<typeof idSchema>,
): Promise<AvatarAcaoResult> {
  try {
    const { avatarId } = idSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado" };
    const { data: family } = await resolveFamily(supabase);
    if (!family) return { ok: false, error: "Família não inicializada" };

    const { data: alvo } = await supabase
      .from("avatares_membros_atipicos")
      .select("id, membro_atipico_id")
      .eq("id", avatarId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!alvo) return { ok: false, error: "Avatar não encontrado." };

    // Tira a seleção dos outros do membro, depois marca este.
    await supabase
      .from("avatares_membros_atipicos")
      .update({ selecionado: false })
      .eq("membro_atipico_id", alvo.membro_atipico_id);
    const { error } = await supabase
      .from("avatares_membros_atipicos")
      .update({ selecionado: true })
      .eq("id", avatarId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/configuracoes/avatar/${alvo.membro_atipico_id}`);
    revalidatePath("/configuracoes/avatar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Exclui um avatar. Se era o selecionado, escolhe o mais recente restante. */
export async function excluirAvatar(
  input: z.infer<typeof idSchema>,
): Promise<AvatarAcaoResult> {
  try {
    const { avatarId } = idSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado" };
    const { data: family } = await resolveFamily(supabase);
    if (!family) return { ok: false, error: "Família não inicializada" };

    const { data: alvo } = await supabase
      .from("avatares_membros_atipicos")
      .select("id, membro_atipico_id, selecionado")
      .eq("id", avatarId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!alvo) return { ok: false, error: "Avatar não encontrado." };

    const { error } = await supabase
      .from("avatares_membros_atipicos")
      .delete()
      .eq("id", avatarId);
    if (error) return { ok: false, error: error.message };

    // Se o excluído era o selecionado, promove o mais recente restante.
    if (alvo.selecionado) {
      const { data: restante } = await supabase
        .from("avatares_membros_atipicos")
        .select("id")
        .eq("membro_atipico_id", alvo.membro_atipico_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (restante) {
        await supabase
          .from("avatares_membros_atipicos")
          .update({ selecionado: true })
          .eq("id", restante.id);
      }
    }

    revalidatePath(`/configuracoes/avatar/${alvo.membro_atipico_id}`);
    revalidatePath("/configuracoes/avatar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
