"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { idadeAnos } from "@/lib/idade";
import { gerarRoteiro, ilustrarPaginas, ilustrarComRetryPublico } from "@/lib/historias/gerar";
import { AVATAR_ESTILOS, type AvatarEstilo } from "@/lib/imagem/avatar-prompt";

/**
 * Busca os bytes do avatar com retry — o Storage às vezes dá pico de latência
 * ou 5xx transitório, e sem retry isso derrubava a história inteira ("avatar
 * fetch 544"). 3 tentativas com backoff; só falha de vez se persistir.
 */
async function fetchAvatarBytes(url: string): Promise<Buffer> {
  let ultimoErro = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      ultimoErro = `status ${res.status}`;
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
    if (tentativa < 3) await new Promise((r) => setTimeout(r, 1200 * tentativa));
  }
  throw new Error(
    `Não consegui carregar o avatar (${ultimoErro}). Tente criar de novo; se persistir, recrie o avatar em Configurações → Avatar.`,
  );
}

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

/**
 * Fluxo async: insere a história com status='gerando' e retorna o id na hora.
 * O trabalho pesado (Sonnet + N imagens) roda em after() pra escapar do
 * timeout de 60s do Vercel — o leitor mostra skeleton e revalida sozinho.
 */
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
      .eq("selecionado", true)
      .maybeSingle();
    if (!avatar?.imagem_url) {
      return {
        ok: false,
        error:
          "Crie primeiro o avatar dessa pessoa (em Configurações → Avatar). Ele é usado como personagem da história.",
      };
    }

    // Insert imediato com status='gerando' pra liberar o cliente em <1s.
    const { data: row, error: errInsert } = await supabase
      .from("historias")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: data.membroId,
        titulo: "Criando…",
        conteudo: "",
        imagens: [],
        descricao_input: data.descricao,
        estilo: avatar.estilo,
        status: "gerando",
      })
      .select("id")
      .single();
    if (errInsert || !row) {
      return { ok: false, error: `Falha ao iniciar a história: ${errInsert?.message}` };
    }
    const historiaId = row.id as string;

    // Pré-carrega o que precisa pro background (não dá pra usar `supabase`
    // dentro do after() porque o request handler já foi fechado).
    const membroSnap = {
      nome: membro.nome as string,
      idade: idadeAnos(membro.data_nascimento as string | null),
      perfil: membro.perfil as string,
    };
    const avatarUrl = avatar.imagem_url as string;
    const avatarEstilo = (avatar.estilo as AvatarEstilo) ?? "cartoon";

    // Lê Kolo Vivo (resumo + gostos) já aqui — o cliente do user ainda está vivo.
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

    after(async () => {
      const admin = createServiceRoleClient();
      try {
        const avatarBytes = await fetchAvatarBytes(avatarUrl);

        const roteiro = await gerarRoteiro(
          {
            membro: membroSnap,
            koloVivoResumo: resumo,
            gostos,
            descricao: data.descricao,
            nPaginas: data.nPaginas,
          },
          { supabase: admin, family_account_id: family.id },
        );

        const paginas = await ilustrarPaginas(admin, roteiro.paginas, {
          familyAccountId: family.id,
          avatarBytes,
          avatarEstilo,
        });

        const conteudo = paginas.map((p) => p.texto).join("\n\n");
        const imagens = paginas.map((p) => p.imagem_url).filter(Boolean);
        const capa = paginas.find((p) => p.imagem_url)?.imagem_url ?? null;
        const falhasImg = paginas.filter((p) => !p.imagem_url).length;
        const todasFalharam = falhasImg === paginas.length;

        const { error: errPag } = await admin.from("historia_paginas").insert(
          paginas.map((p) => ({
            historia_id: historiaId,
            ordem: p.ordem,
            texto: p.texto,
            fala: p.fala,
            cena: p.cena,
            imagem_url: p.imagem_url,
          })),
        );
        if (errPag) throw new Error(`páginas: ${errPag.message}`);

        await admin
          .from("historias")
          .update({
            titulo: roteiro.titulo,
            conteudo,
            imagens,
            capa_url: capa,
            status: todasFalharam ? "erro" : "pronta",
            erro: todasFalharam
              ? "Nenhuma ilustração saiu — tente criar de novo."
              : falhasImg > 0
                ? `${falhasImg} ilustraç${falhasImg === 1 ? "ão" : "ões"} falhou — você pode regerar.`
                : null,
          })
          .eq("id", historiaId);
      } catch (e) {
        console.error("[historia.after]", e);
        await admin
          .from("historias")
          .update({
            status: "erro",
            erro: e instanceof Error ? e.message : "Erro inesperado",
          })
          .eq("id", historiaId);
      } finally {
        revalidatePath("/historias");
        revalidatePath(`/historias/${historiaId}`);
      }
    });

    revalidatePath("/historias");
    return {
      ok: true,
      id: historiaId,
      enriquecimento: proximoEnriquecimento(membroSnap.nome, pref),
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
      pergunta: `Quando ${nome} senta pra criar, o que costuma escolher?`,
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

/* ============================================================
 * Operações no leitor
 * ============================================================ */

export type AcaoResult = { ok: true } | { ok: false; error: string };

const idSchema = z.object({ id: z.string().uuid() });

export async function excluirHistoria(input: { id: string }): Promise<AcaoResult> {
  try {
    const { id } = idSchema.parse(input);
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

    const { error } = await supabase
      .from("historias")
      .delete()
      .eq("id", id)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/historias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function incrementarLeituras(input: { id: string }): Promise<void> {
  try {
    const { id } = idSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!family) return;

    // Lê + escreve (sem RPC) — chamada infrequente, não vale uma migração.
    const { data } = await supabase
      .from("historias")
      .select("leituras")
      .eq("id", id)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!data) return;
    await supabase
      .from("historias")
      .update({ leituras: (Number(data.leituras) || 0) + 1 })
      .eq("id", id)
      .eq("family_account_id", family.id);
  } catch {
    // métricas não devem travar o leitor
  }
}

const regenSchema = z.object({
  historiaId: z.string().uuid(),
  ordem: z.number().int().min(1).max(6),
});

export async function regenerarPagina(
  input: z.infer<typeof regenSchema>,
): Promise<AcaoResult> {
  try {
    const data = regenSchema.parse(input);
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

    const { data: historia } = await supabase
      .from("historias")
      .select("id, membro_atipico_id, estilo")
      .eq("id", data.historiaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!historia) return { ok: false, error: "História não encontrada." };

    const { data: pagina } = await supabase
      .from("historia_paginas")
      .select("id, cena")
      .eq("historia_id", data.historiaId)
      .eq("ordem", data.ordem)
      .maybeSingle();
    if (!pagina) return { ok: false, error: "Página não encontrada." };
    const cena = (pagina.cena as string | null) ?? "";
    if (!cena.trim()) {
      return { ok: false, error: "Essa página não tem descrição de cena salva — refaça a história inteira." };
    }

    const { data: avatar } = await supabase
      .from("avatares_membros_atipicos")
      .select("estilo, imagem_url")
      .eq("membro_atipico_id", historia.membro_atipico_id as string)
      .eq("selecionado", true)
      .maybeSingle();
    if (!avatar?.imagem_url) return { ok: false, error: "Avatar não encontrado." };

    let avatarBytes: Buffer;
    try {
      avatarBytes = await fetchAvatarBytes(avatar.imagem_url as string);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Falha ao carregar avatar." };
    }

    const estilo = (historia.estilo as AvatarEstilo) ?? (avatar.estilo as AvatarEstilo) ?? "cartoon";
    const estiloPrompt =
      AVATAR_ESTILOS.find((e) => e.value === estilo)?.prompt ?? AVATAR_ESTILOS[0].prompt;

    const admin = createServiceRoleClient();
    const r = await ilustrarComRetryPublico(admin, {
      cena,
      estiloPrompt,
      avatarBytes,
      familyAccountId: family.id,
    });
    if (!r.url) return { ok: false, error: r.erro ?? "Falha ao gerar imagem." };

    const { error } = await admin
      .from("historia_paginas")
      .update({ imagem_url: r.url })
      .eq("id", pagina.id as string);
    if (error) return { ok: false, error: error.message };

    // Se a história tinha erro de ilustrações, reavalia o status.
    const { data: paginasAtuais } = await admin
      .from("historia_paginas")
      .select("imagem_url")
      .eq("historia_id", data.historiaId);
    const aindaFalta = (paginasAtuais ?? []).some((p) => !p.imagem_url);
    await admin
      .from("historias")
      .update({
        capa_url: r.url,
        status: aindaFalta ? "pronta" : "pronta",
        erro: aindaFalta
          ? `${(paginasAtuais ?? []).filter((p) => !p.imagem_url).length} ilustrações ainda faltam.`
          : null,
      })
      .eq("id", data.historiaId);

    revalidatePath(`/historias/${data.historiaId}`);
    revalidatePath("/historias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
