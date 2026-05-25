"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { idadeAnos } from "@/lib/idade";
import { gerarHistoria } from "@/lib/historias/gerar";
import type { AvatarEstilo } from "@/lib/imagem/avatar-prompt";

/**
 * Compreensão ativa (Fatia 3.2): depois de criar a história, a Ayla faz UMA
 * perguntinha de leve pra enriquecer os Gostos da área mais vazia. `area` é a
 * chave em categorias_extras.preferencias; `opcoes` são sugestões de 1 toque.
 */
export type Enriquecimento = {
  area: "materiais" | "temas";
  pergunta: string;
  opcoes: string[];
};

export type CriarHistoriaResult =
  | { ok: true; id: string; enriquecimento?: Enriquecimento | null }
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
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
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

    // Gostos & Preferências (personaliza a história)
    const pref =
      (kv?.categorias_extras as { preferencias?: Record<string, unknown> } | null)
        ?.preferencias ?? {};
    const lista = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").join(", ") : "";
    const gostos = [
      lista(pref.midia) && `Personagens/desenhos favoritos: ${lista(pref.midia)}`,
      lista(pref.temas) && `Temas que ama: ${lista(pref.temas)}`,
      lista(pref.materiais) && `Materiais/brincadeiras favoritos: ${lista(pref.materiais)}`,
      lista(pref.musicas) && `Músicas/sons: ${lista(pref.musicas)}`,
    ]
      .filter(Boolean)
      .join("\n");

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
      gostos,
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
    return {
      ok: true,
      id: row.id as string,
      enriquecimento: proximoEnriquecimento(membro.nome as string, pref),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Escolhe a próxima perguntinha de enriquecimento pela área de Gostos mais
 * vazia. Retorna null quando já temos materiais e temas (não fica insistindo).
 */
function proximoEnriquecimento(
  nome: string,
  pref: Record<string, unknown>,
): Enriquecimento | null {
  const temItens = (v: unknown) =>
    Array.isArray(v) && v.some((x) => typeof x === "string" && x.trim().length > 0);

  if (!temItens(pref.materiais)) {
    return {
      area: "materiais",
      pergunta: `Quando ${nome} vai criar, o que cai melhor na mão?`,
      opcoes: ["giz de cera", "guache", "massinha", "lápis de cor"],
    };
  }
  if (!temItens(pref.temas)) {
    return {
      area: "temas",
      pergunta: `Que mundo encanta ${nome} agora?`,
      opcoes: ["dinossauros", "animais", "espaço", "carrinhos", "contos e princesas"],
    };
  }
  return null;
}

const enriquecimentoSchema = z.object({
  membroId: z.string().uuid(),
  area: z.enum(["materiais", "temas"]),
  valor: z.string().trim().min(1).max(60),
});

export type EnriquecimentoResult = { ok: true } | { ok: false; error: string };

/**
 * Salva a resposta da perguntinha de enriquecimento: anexa `valor` à lista
 * `area` dentro de categorias_extras.preferencias, sem perder o resto.
 */
export async function responderEnriquecimento(
  input: z.infer<typeof enriquecimentoSchema>,
): Promise<EnriquecimentoResult> {
  try {
    const data = enriquecimentoSchema.parse(input);
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

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", data.membroId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Criança não encontrada." };

    const { data: atual } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", data.membroId)
      .maybeSingle();

    const extras = { ...((atual?.categorias_extras as Record<string, unknown>) ?? {}) };
    const pref = { ...((extras.preferencias as Record<string, unknown>) ?? {}) };
    const listaAtual = Array.isArray(pref[data.area])
      ? (pref[data.area] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (!listaAtual.some((x) => x.toLowerCase() === data.valor.toLowerCase())) {
      listaAtual.push(data.valor);
    }
    pref[data.area] = listaAtual;
    extras.preferencias = pref;

    const { error } = await supabase
      .from("perfil_vivo_membro")
      .upsert(
        {
          membro_atipico_id: data.membroId,
          family_account_id: family.id,
          categorias_extras: extras,
        },
        { onConflict: "membro_atipico_id" },
      );
    if (error) return { ok: false, error: `Não consegui salvar: ${error.message}` };

    revalidatePath("/configuracoes/preferencias");
    revalidatePath("/kolo-vivo");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
