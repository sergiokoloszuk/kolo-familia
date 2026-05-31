"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { gerarImagem } from "@/lib/imagem/generate";
import {
  montarPromptCanonico,
  AVATAR_ESTILO_VALUES,
  type AvatarDescricao,
} from "@/lib/imagem/avatar-prompt";

async function requireFamilyAndMembro(membroId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();
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

export type SalvarDescricaoInput = z.infer<typeof descricaoSchema> & {
  membroId: string;
};

export type SalvarResult = { ok: true } | { ok: false; error: string };

export async function salvarDescricao(
  input: SalvarDescricaoInput,
): Promise<SalvarResult> {
  try {
    const data = descricaoSchema.parse(input);
    const { supabase, family } = await requireFamilyAndMembro(input.membroId);

    const { error } = await supabase.from("avatares_membros_atipicos").upsert(
      {
        membro_atipico_id: input.membroId,
        family_account_id: family.id,
        estilo: data.estilo,
        descricao_textual: data,
      },
      { onConflict: "membro_atipico_id" },
    );
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

    revalidatePath(`/configuracoes/avatar/${input.membroId}`);
    revalidatePath("/configuracoes/avatar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export type GerarAvatarResult =
  | { ok: true; imagem_url: string; prompt_canonico: string; prompt_revisado?: string }
  | { ok: false; error: string };

export async function gerarAvatar(membroId: string): Promise<GerarAvatarResult> {
  try {
    const { supabase, family } = await requireFamilyAndMembro(membroId);
    await requireActiveWrite(family.id);

    const { data: avatar } = await supabase
      .from("avatares_membros_atipicos")
      .select("estilo, descricao_textual")
      .eq("membro_atipico_id", membroId)
      .single();

    if (!avatar) {
      return { ok: false, error: "Salve a descrição antes de gerar o avatar." };
    }

    const descricao: AvatarDescricao = {
      estilo: (avatar.estilo as AvatarDescricao["estilo"]) ?? "cartoon",
      ...((avatar.descricao_textual as Record<string, unknown>) ?? {}),
    };
    const promptCanonico = montarPromptCanonico(descricao);

    // Geração com service role pra escrever no Storage.
    const admin = createServiceRoleClient();
    const result = await gerarImagem(admin, {
      prompt: promptCanonico,
      familyAccountId: family.id,
      tipo: "avatar",
      feature: "avatar_geracao",
    });

    const { error: updErr } = await supabase
      .from("avatares_membros_atipicos")
      .update({ imagem_url: result.url, prompt_canonico: promptCanonico })
      .eq("membro_atipico_id", membroId);
    if (updErr) return { ok: false, error: `Imagem gerada, mas falhou ao salvar: ${updErr.message}` };

    revalidatePath(`/configuracoes/avatar/${membroId}`);
    revalidatePath("/configuracoes/avatar");

    return {
      ok: true,
      imagem_url: result.url,
      prompt_canonico: promptCanonico,
      prompt_revisado: result.prompt_revisado,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
