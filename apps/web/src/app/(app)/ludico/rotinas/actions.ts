"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { idadeAnos } from "@/lib/idade";
import { gerarRoteiroRotina, ilustrarCards } from "@/lib/ludico/gerar";
import { resolveFamily } from "@/lib/auth/current-family";
import { trackFeature } from "@/lib/analytics/track";

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
  return { supabase, family };
}

/** A rotina pertence à família? (defesa em profundidade além do RLS) */
async function rotinaDaFamilia(
  supabase: Awaited<ReturnType<typeof requireFamily>>["supabase"],
  familyId: string,
  rotinaId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("rotinas")
    .select("id")
    .eq("id", rotinaId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  return Boolean(data);
}

// ---------- Rotinas ----------

const criarSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  nome: z.string().trim().min(1, "Dê um nome pra rotina").max(80),
});

export async function criarRotina(
  input: z.infer<typeof criarSchema>,
): Promise<Ok<{ rotinaId: string }> | Fail> {
  try {
    const { membroAtipicoId, nome } = criarSchema.parse(input);
    const { supabase, family } = await requireFamily();

    // O membro é da família?
    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    const { data, error } = await supabase
      .from("rotinas")
      .insert({ family_account_id: family.id, membro_atipico_id: membroAtipicoId, nome })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Não consegui criar: ${error?.message}` };

    revalidatePath("/ludico/rotinas");
    return { ok: true, rotinaId: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const criarDiaSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  diaSemana: z.number().int().min(0).max(6),
});

/** Cria (ou reusa) a rotina de um DIA da semana pra a criança ativa. */
export async function criarRotinaDia(
  input: z.infer<typeof criarDiaSchema>,
): Promise<Ok<{ rotinaId: string }> | Fail> {
  try {
    const { membroAtipicoId, diaSemana } = criarDiaSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    // Não duplica: se já existe a rotina desse dia, reusa.
    const { data: existe } = await supabase
      .from("rotinas")
      .select("id")
      .eq("membro_atipico_id", membroAtipicoId)
      .eq("dia_semana", diaSemana)
      .maybeSingle();
    if (existe?.id) return { ok: true, rotinaId: existe.id as string };

    const { data, error } = await supabase
      .from("rotinas")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroAtipicoId,
        nome: DIAS_SEMANA[diaSemana],
        dia_semana: diaSemana,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Não consegui criar: ${error?.message}` };

    revalidatePath("/ludico/rotinas/semana");
    return { ok: true, rotinaId: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const copiarSchema = z.object({
  rotinaId: z.string().uuid(),
  paraDias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

/** Copia a sequência de um dia pra outros dias da semana (substitui a deles). */
export async function copiarDiaRotina(
  input: z.infer<typeof copiarSchema>,
): Promise<Ok<{ copiados: number }> | Fail> {
  try {
    const { rotinaId, paraDias } = copiarSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: origem } = await supabase
      .from("rotinas")
      .select("id, membro_atipico_id, dia_semana, tema")
      .eq("id", rotinaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!origem) return { ok: false, error: "Rotina não encontrada." };
    const membroId = origem.membro_atipico_id as string;

    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto, icone, hora, ordem")
      .eq("rotina_id", rotinaId)
      .order("ordem", { ascending: true });
    const base = tarefas ?? [];

    let copiados = 0;
    for (const dia of paraDias) {
      if (dia === origem.dia_semana) continue;
      // rotina do dia destino (cria se não existe)
      const { data: dest } = await supabase
        .from("rotinas")
        .select("id")
        .eq("membro_atipico_id", membroId)
        .eq("dia_semana", dia)
        .maybeSingle();
      let destId = dest?.id as string | undefined;
      if (!destId) {
        const { data: nova } = await supabase
          .from("rotinas")
          .insert({
            family_account_id: family.id,
            membro_atipico_id: membroId,
            nome: DIAS_SEMANA[dia],
            dia_semana: dia,
            tema: (origem.tema as string | null) ?? null,
          })
          .select("id")
          .single();
        destId = nova?.id as string | undefined;
      }
      if (!destId) continue;

      // Substitui as tarefas do destino pelas da origem; cartões voltam a "nenhum".
      await supabase.from("rotina_tarefas").delete().eq("rotina_id", destId);
      if (base.length) {
        await supabase.from("rotina_tarefas").insert(
          base.map((t, i) => ({
            rotina_id: destId,
            texto: t.texto as string,
            icone: (t.icone as string | null) ?? null,
            hora: (t.hora as string | null) ?? null,
            ordem: i,
          })),
        );
      }
      await supabase.from("rotinas").update({ cards_status: "nenhum" }).eq("id", destId);
      copiados += 1;
    }

    revalidatePath("/ludico/rotinas/semana");
    return { ok: true, copiados };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const temaSemanaSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  tema: z.string().trim().max(60),
});

/** Define UM tema pra a semana toda — aplica a todas as rotinas de dia da criança. */
export async function definirTemaSemana(
  input: z.infer<typeof temaSemanaSchema>,
): Promise<Ok | Fail> {
  try {
    const { membroAtipicoId, tema } = temaSemanaSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    // Tema mudou → os cartões (temáticos) precisam ser gerados de novo.
    const { error } = await supabase
      .from("rotinas")
      .update({ tema: tema || null, cards_status: "nenhum" })
      .eq("membro_atipico_id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .not("dia_semana", "is", null);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/ludico/rotinas/semana");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const renomearSchema = z.object({
  rotinaId: z.string().uuid(),
  nome: z.string().trim().min(1).max(80),
});

export async function renomearRotina(
  input: z.infer<typeof renomearSchema>,
): Promise<Ok | Fail> {
  try {
    const { rotinaId, nome } = renomearSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("rotinas")
      .update({ nome })
      .eq("id", rotinaId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    revalidatePath("/ludico/rotinas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function excluirRotina(input: { rotinaId: string }): Promise<Ok | Fail> {
  try {
    const rotinaId = z.string().uuid().parse(input.rotinaId);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("rotinas")
      .delete()
      .eq("id", rotinaId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ludico/rotinas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ---------- Tarefas ----------

const addTarefaSchema = z.object({
  rotinaId: z.string().uuid(),
  texto: z.string().trim().min(1, "Escreva a tarefa").max(120),
  icone: z.string().trim().max(40).optional().nullable(),
  hora: z.string().trim().max(10).optional().nullable(),
});

export async function adicionarTarefa(
  input: z.infer<typeof addTarefaSchema>,
): Promise<Ok<{ tarefaId: string }> | Fail> {
  try {
    const { rotinaId, texto, icone, hora } = addTarefaSchema.parse(input);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };

    const { count } = await supabase
      .from("rotina_tarefas")
      .select("id", { count: "exact", head: true })
      .eq("rotina_id", rotinaId);

    const { data, error } = await supabase
      .from("rotina_tarefas")
      .insert({ rotina_id: rotinaId, texto, icone: icone || null, hora: hora || null, ordem: count ?? 0 })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Não consegui adicionar: ${error?.message}` };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true, tarefaId: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const addVariasSchema = z.object({
  rotinaId: z.string().uuid(),
  textos: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
});

/**
 * Adiciona vários passos de uma vez (uma atividade por linha). Mantém a ordem
 * recebida, anexando ao fim da lista. O cliente faz refresh pra recarregar.
 */
export async function adicionarVariasTarefas(
  input: z.infer<typeof addVariasSchema>,
): Promise<Ok<{ quantidade: number }> | Fail> {
  try {
    const { rotinaId, textos } = addVariasSchema.parse(input);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };

    const { count } = await supabase
      .from("rotina_tarefas")
      .select("id", { count: "exact", head: true })
      .eq("rotina_id", rotinaId);
    const base = count ?? 0;

    const rows = textos.map((texto, i) => ({
      rotina_id: rotinaId,
      texto,
      icone: null,
      ordem: base + i,
    }));
    const { error } = await supabase.from("rotina_tarefas").insert(rows);
    if (error) return { ok: false, error: `Não consegui adicionar: ${error.message}` };

    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true, quantidade: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const editTarefaSchema = z.object({
  rotinaId: z.string().uuid(),
  tarefaId: z.string().uuid(),
  texto: z.string().trim().min(1).max(120),
  icone: z.string().trim().max(40).optional().nullable(),
  hora: z.string().trim().max(10).optional().nullable(),
});

export async function editarTarefa(
  input: z.infer<typeof editTarefaSchema>,
): Promise<Ok | Fail> {
  try {
    const { rotinaId, tarefaId, texto, icone, hora } = editTarefaSchema.parse(input);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };
    // hora undefined = não mexe (edição de texto não apaga a hora já salva).
    const patch: Record<string, unknown> = { texto, icone: icone || null };
    if (hora !== undefined) patch.hora = hora || null;
    const { error } = await supabase
      .from("rotina_tarefas")
      .update(patch)
      .eq("id", tarefaId)
      .eq("rotina_id", rotinaId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function excluirTarefa(input: {
  rotinaId: string;
  tarefaId: string;
}): Promise<Ok | Fail> {
  try {
    const rotinaId = z.string().uuid().parse(input.rotinaId);
    const tarefaId = z.string().uuid().parse(input.tarefaId);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };
    const { error } = await supabase
      .from("rotina_tarefas")
      .delete()
      .eq("id", tarefaId)
      .eq("rotina_id", rotinaId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const toggleSchema = z.object({
  rotinaId: z.string().uuid(),
  tarefaId: z.string().uuid(),
  concluida: z.boolean(),
});

export async function toggleTarefa(input: z.infer<typeof toggleSchema>): Promise<Ok | Fail> {
  try {
    const { rotinaId, tarefaId, concluida } = toggleSchema.parse(input);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };
    const { error } = await supabase
      .from("rotina_tarefas")
      .update({ concluida })
      .eq("id", tarefaId)
      .eq("rotina_id", rotinaId);
    if (error) return { ok: false, error: error.message };
    // Sem revalidatePath: o cliente já atualizou (otimista).
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const reordenarSchema = z.object({
  rotinaId: z.string().uuid(),
  ordemIds: z.array(z.string().uuid()).max(50),
});

/** Reescreve a ordem das tarefas a partir da lista de ids (índice = ordem). */
export async function reordenarTarefas(
  input: z.infer<typeof reordenarSchema>,
): Promise<Ok | Fail> {
  try {
    const { rotinaId, ordemIds } = reordenarSchema.parse(input);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };
    await Promise.all(
      ordemIds.map((id, i) =>
        supabase.from("rotina_tarefas").update({ ordem: i }).eq("id", id).eq("rotina_id", rotinaId),
      ),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const modoSchema = z.object({
  rotinaId: z.string().uuid(),
  modo: z.enum(["cartoes", "lista"]),
});

/** Define como a rotina é exibida: cartões (imagem) ou lista. Persiste por rotina. */
export async function definirModoExibicao(
  input: z.infer<typeof modoSchema>,
): Promise<Ok | Fail> {
  try {
    const { rotinaId, modo } = modoSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("rotinas")
      .update({ modo_exibicao: modo })
      .eq("id", rotinaId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function resetarRotina(input: { rotinaId: string }): Promise<Ok | Fail> {
  try {
    const rotinaId = z.string().uuid().parse(input.rotinaId);
    const { supabase, family } = await requireFamily();
    if (!(await rotinaDaFamilia(supabase, family.id, rotinaId)))
      return { ok: false, error: "Rotina não encontrada." };
    const { error } = await supabase
      .from("rotina_tarefas")
      .update({ concluida: false })
      .eq("rotina_id", rotinaId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ---------- Gerador de cards visuais (tema + história + ilustrações) ----------

const gerarSchema = z.object({
  rotinaId: z.string().uuid(),
  // Quando usarAvatar=true, o tema é opcional (só ambienta a cena).
  tema: z.string().trim().max(60).optional().default(""),
  usarAvatar: z.boolean().optional().default(false),
  // Avatar escolhido pra ESTES cards. Ausente/inválido → cai no "em uso".
  avatarId: z.string().uuid().optional(),
});

/**
 * Veste a rotina num tema: a IA escreve a história + nomes temáticos e ilustra
 * cada card (mascote consistente). Roda em segundo plano (após responder); a
 * tela faz polling pelo cards_status. NÃO muda as atividades — usa as que existem.
 */
export async function gerarCardsVisuais(
  input: z.infer<typeof gerarSchema>,
): Promise<Ok | Fail> {
  try {
    const { rotinaId, tema, usarAvatar, avatarId } = gerarSchema.parse(input);
    if (!usarAvatar && tema.trim().length < 2) {
      return { ok: false, error: "Escolha um tema (ou use o avatar)." };
    }
    const { supabase, family } = await requireFamily();

    const { data: rotina } = await supabase
      .from("rotinas")
      .select("id, nome, membro_atipico_id, membros_atipicos(data_nascimento)")
      .eq("id", rotinaId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!rotina) return { ok: false, error: "Rotina não encontrada." };

    // #2: usar o avatar da criança como personagem dos cards.
    let avatarUrl: string | null = null;
    if (usarAvatar) {
      const membroId = rotina.membro_atipico_id as string | null;
      if (!membroId) return { ok: false, error: "Esta rotina não tem ninguém vinculado." };
      // Avatar escolhido (se veio avatarId válido do membro); senão, o "em uso".
      let av: { imagem_url: string | null } | null = null;
      if (avatarId) {
        const r = await supabase
          .from("avatares_membros_atipicos")
          .select("imagem_url")
          .eq("id", avatarId)
          .eq("membro_atipico_id", membroId)
          .eq("family_account_id", family.id)
          .maybeSingle();
        av = r.data;
      }
      if (!av) {
        const r = await supabase
          .from("avatares_membros_atipicos")
          .select("imagem_url")
          .eq("membro_atipico_id", membroId)
          .eq("family_account_id", family.id)
          .order("selecionado", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        av = r.data;
      }
      avatarUrl = (av?.imagem_url as string | null) ?? null;
      if (!avatarUrl) {
        return {
          ok: false,
          error: "Crie um avatar primeiro (no Lúdico → Avatar).",
        };
      }
    }

    const { data: tarefasData } = await supabase
      .from("rotina_tarefas")
      .select("id, texto, ordem")
      .eq("rotina_id", rotinaId)
      .order("ordem", { ascending: true });
    const tarefas = tarefasData ?? [];
    if (tarefas.length === 0)
      return { ok: false, error: "Adicione os passos antes de gerar os cards." };

    const rel = rotina.membros_atipicos as
      | { data_nascimento: string | null }
      | { data_nascimento: string | null }[]
      | null;
    const membro = rel ? (Array.isArray(rel) ? rel[0] ?? null : rel) : null;
    const idade = idadeAnos(membro?.data_nascimento ?? null);

    await supabase
      .from("rotinas")
      .update({ tema, cards_status: "gerando" })
      .eq("id", rotinaId)
      .eq("family_account_id", family.id);
    revalidatePath(`/ludico/rotinas/${rotinaId}`);
    after(() =>
      trackFeature({ familyId: family.id, evento: "ludico_gerado", detalhe: { tipo: "rotina" } }),
    );

    const familyId = family.id;
    const nomeRotina = rotina.nome as string;
    const atividades = tarefas.map((t) => t.texto as string);
    const tarefaIds = tarefas.map((t) => t.id as string);
    // Sem tema (caso avatar sem tema): um cenário neutro pro roteiro.
    const temaParaRoteiro = tema.trim() || "do dia a dia";
    const referenciaUrl = avatarUrl ?? undefined;

    after(async () => {
      const svc = createServiceRoleClient();
      try {
        const roteiro = await gerarRoteiroRotina(
          { tema: temaParaRoteiro, atividades, idade, nomeRotina, usarAvatar },
          { supabase: svc, family_account_id: familyId },
        );
        const { mascoteUrl, imagens } = await ilustrarCards(svc, {
          familyAccountId: familyId,
          tema: temaParaRoteiro,
          mascoteDescricao: roteiro.mascote,
          cards: roteiro.cards,
          referenciaUrl,
        });
        await Promise.all(
          tarefaIds.map((id, i) => {
            const card = roteiro.cards[i];
            if (!card) return Promise.resolve();
            return svc
              .from("rotina_tarefas")
              .update({
                nome_tematico: card.nome_tematico,
                cena: card.cena,
                imagem_url: imagens[i] ?? null,
              })
              .eq("id", id);
          }),
        );
        await svc
          .from("rotinas")
          .update({
            historia: roteiro.historia,
            mascote_url: mascoteUrl,
            cards_status: "pronto",
          })
          .eq("id", rotinaId);
      } catch (e) {
        console.error("[gerarCardsVisuais]", e);
        await svc.from("rotinas").update({ cards_status: "erro" }).eq("id", rotinaId);
      }
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
