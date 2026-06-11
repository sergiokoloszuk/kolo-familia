"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { gerarImagem } from "@/lib/imagem/generate";
import { montarPromptCena } from "@/lib/imagem/avatar-prompt";

async function requireFamily() {
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
  return { supabase, user, family };
}

const favoritarSchema = z.object({
  id: z.string().uuid(),
  favoritada: z.boolean(),
});

export async function favoritarImagem(
  input: z.infer<typeof favoritarSchema>,
): Promise<void> {
  const { id, favoritada } = favoritarSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { error } = await supabase
    .from("galeria_imagens")
    .update({ favoritada })
    .eq("id", id)
    .eq("family_account_id", family.id);
  if (error) throw new Error(`Falha ao favoritar: ${error.message}`);

  revalidatePath("/galeria");
}

export async function apagarImagem(id: string): Promise<void> {
  const { supabase, family } = await requireFamily();

  const { data: img } = await supabase
    .from("galeria_imagens")
    .select("url")
    .eq("id", id)
    .eq("family_account_id", family.id)
    .single();

  if (!img) throw new Error("Imagem não encontrada");

  const { error } = await supabase.from("galeria_imagens").delete().eq("id", id);
  if (error) throw new Error(`Falha ao apagar: ${error.message}`);

  // Remove do Storage também (best effort — se falhar, a row já se foi)
  // Path: imagens/{family_id}/{tipo}/{uuid}.png — extraímos do URL público.
  const path = extrairStoragePath(img.url as string);
  if (path) {
    await supabase.storage.from("imagens").remove([path]).catch(() => undefined);
  }

  revalidatePath("/galeria");
}

const gerarCenaSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  descricaoCena: z.string().trim().min(5).max(500),
  tipo: z.enum(["brincadeira", "atividade", "historia_social", "conquista", "livre"]),
});

export async function gerarCenaParaGaleria(
  input: z.infer<typeof gerarCenaSchema>,
): Promise<{ url: string; id: string }> {
  const { membroAtipicoId, descricaoCena, tipo } = gerarCenaSchema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  // Pega prompt canônico do avatar
  const { data: avatar } = await supabase
    .from("avatares_membros_atipicos")
    .select("prompt_canonico, imagem_url")
    .eq("membro_atipico_id", membroAtipicoId)
    .eq("family_account_id", family.id)
    .eq("selecionado", true)
    .maybeSingle();

  if (!avatar?.prompt_canonico) {
    throw new Error(
      "Configure o avatar do membro antes de gerar cenas. /configuracoes/avatar",
    );
  }

  const promptCena = montarPromptCena({
    promptCanonico: avatar.prompt_canonico,
    descricaoCena,
  });

  const admin = createServiceRoleClient();
  const result = await gerarImagem(admin, {
    prompt: promptCena,
    familyAccountId: family.id,
    tipo: "cena",
    feature: "galeria_cena",
  });

  const tipoBanco =
    tipo === "brincadeira"
      ? "brincadeira"
      : tipo === "atividade"
        ? "atividade"
        : tipo === "historia_social"
          ? "historia_social"
          : tipo === "conquista"
            ? "conquista"
            : "livre";

  const { data: row, error } = await supabase
    .from("galeria_imagens")
    .insert({
      family_account_id: family.id,
      membro_atipico_id: membroAtipicoId,
      url: result.url,
      tipo: tipoBanco,
      prompt_usado: promptCena,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`Falha ao salvar: ${error?.message}`);

  revalidatePath("/galeria");
  return { url: result.url, id: row.id as string };
}

function extrairStoragePath(publicUrl: string): string | null {
  // URL pública do Supabase tem o formato:
  //   https://<host>/storage/v1/object/public/imagens/<path>
  const match = publicUrl.match(/\/object\/public\/imagens\/(.+)$/);
  return match ? match[1] : null;
}
