"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { idadeAnos } from "@/lib/idade";
import { gerarHistoria } from "@/lib/historias/gerar";
import type { AvatarEstilo } from "@/lib/imagem/avatar-prompt";

export type CriarHistoriaResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const schema = z.object({
  membroId: z.string().uuid(),
  descricao: z.string().trim().min(5, "Descreva um pouco mais a história").max(1500),
  nPaginas: z.coerce.number().int().min(3).max(6).default(5),
});

const CAMPOS_KV: Record<string, string> = {
  essencial: "O essencial",
  como_e: "Como é / interesses",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios e regulação",
  sensorial: "Sensorial",
};

export async function criarHistoria(
  input: z.infer<typeof schema>,
): Promise<CriarHistoriaResult> {
  try {
    const data = schema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Não autenticado." };
    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!family) return { ok: false, error: "Família não inicializada." };
    await requireActiveWrite(family.id);

    // Criança + avatar (precisa de avatar com imagem pra manter o personagem)
    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, perfil")
      .eq("id", data.membroId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Criança não encontrada." };

    const { data: avatar } = await supabase
      .from("avatares_membros_atipicos")
      .select("estilo, imagem_url")
      .eq("membro_atipico_id", data.membroId)
      .maybeSingle();
    if (!avatar?.imagem_url) {
      return {
        ok: false,
        error:
          "Crie primeiro o avatar dessa criança (em Configurações → Avatar). Ele é usado como personagem da história.",
      };
    }

    // Baixa o avatar (referência pra consistência)
    const avRes = await fetch(avatar.imagem_url as string);
    if (!avRes.ok) return { ok: false, error: "Não consegui carregar o avatar da criança." };
    const avatarBytes = Buffer.from(await avRes.arrayBuffer());

    // Resumo do Kolo Vivo (contexto pra história)
    const { data: kv } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
      .eq("membro_atipico_id", data.membroId)
      .maybeSingle();
    const resumo = kv
      ? Object.entries(CAMPOS_KV)
          .map(([campo, label]) => {
            const t = ((kv as Record<string, { texto?: string } | null>)[campo]?.texto ?? "").trim();
            return t ? `${label}: ${t}` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "";

    // Gera (texto + ilustrações) usando service-role pro Storage
    const admin = createServiceRoleClient();
    const historia = await gerarHistoria(admin, {
      familyAccountId: family.id,
      membro: {
        nome: membro.nome as string,
        idade: idadeAnos(membro.data_nascimento as string | null),
        perfil: membro.perfil as string,
      },
      koloVivoResumo: resumo,
      descricao: data.descricao,
      nPaginas: data.nPaginas,
      avatarBytes,
      avatarEstilo: (avatar.estilo as AvatarEstilo) ?? "cartoon",
    });

    const conteudo = historia.paginas.map((p) => p.texto).join("\n\n");
    const imagens = historia.paginas.map((p) => p.imagem_url).filter(Boolean);
    const capa = historia.paginas.find((p) => p.imagem_url)?.imagem_url ?? null;

    const { data: row, error: errHist } = await supabase
      .from("historias")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: data.membroId,
        titulo: historia.titulo,
        conteudo,
        imagens,
        descricao_input: data.descricao,
        estilo: avatar.estilo,
        status: "pronta",
        capa_url: capa,
      })
      .select("id")
      .single();
    if (errHist || !row) {
      return { ok: false, error: `Falha ao salvar a história: ${errHist?.message}` };
    }

    const { error: errPag } = await supabase.from("historia_paginas").insert(
      historia.paginas.map((p) => ({
        historia_id: row.id,
        ordem: p.ordem,
        texto: p.texto,
        fala: p.fala,
        imagem_url: p.imagem_url,
      })),
    );
    if (errPag) {
      return { ok: false, error: `História criada, mas falhou ao salvar páginas: ${errPag.message}` };
    }

    revalidatePath("/historias");
    return { ok: true, id: row.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
