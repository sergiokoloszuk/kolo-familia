"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { idadeAnos } from "@/lib/idade";
import { extrairAtualizacoes, type ItemKoloVivo } from "@/lib/ia/atualizar";
import { montarKoloVivoResumo, aplicarItensNoMembro } from "@/lib/kolo-vivo/incorporar";
import { resolveFamily } from "@/lib/auth/current-family";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
  if (!family) throw new Error("Família não inicializada");
  return { supabase, user, family };
}

const ESCALA_EMOCIONAL = ["muito_bem", "bem", "neutro", "dificil", "muito_dificil"] as const;

const schema = z.object({
  membroAtipicoId: z.string().uuid().nullable(),
  data: z.string().date(),

  // Check-in leve
  escalaEmocionalMae: z.enum(ESCALA_EMOCIONAL),
  escalaEmocionalMembro: z.enum(ESCALA_EMOCIONAL).nullable().optional(),

  // Camada A
  conquista: z.string().trim().max(500).optional(),
  desafio: z.string().trim().max(500).optional(),
  observacaoLivre: z.string().trim().max(1000).optional(),
  possivelGatilho: z.string().trim().max(500).optional(),

  // Camada B
  quemEstava: z
    .enum(["mae", "pai", "avo_a", "avo_o", "irmao_a", "baba", "professor_a", "outro"])
    .nullable()
    .optional(),
  estadoAdulto: z
    .enum(["calmo", "firme", "cansado", "ansioso", "impaciente"])
    .nullable()
    .optional(),
  reacaoAdulto: z
    .enum(["acolhedor", "esperou", "interveio", "impositivo", "chamou_ajuda", "outro"])
    .nullable()
    .optional(),
});

export type RegistrarDiaInput = z.infer<typeof schema>;

export async function registrarDia(input: RegistrarDiaInput): Promise<void> {
  const data = schema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  // 1. Check-in diário — buscar e atualizar/inserir.
  //    (O índice único é numa expressão `coalesce(membro_atipico_id, ...)`,
  //    então `upsert(onConflict: colunas)` dava 42P10 e o check-in nunca
  //    salvava — o erro era engolido. Por isso parecia "travar".)
  let buscaCheckin = supabase
    .from("check_ins_diarios")
    .select("id")
    .eq("family_account_id", family.id)
    .eq("data", data.data);
  buscaCheckin = data.membroAtipicoId
    ? buscaCheckin.eq("membro_atipico_id", data.membroAtipicoId)
    : buscaCheckin.is("membro_atipico_id", null);
  const { data: checkinExistente, error: errBusca } = await buscaCheckin.maybeSingle();
  if (errBusca) throw new Error(`Erro ao verificar check-in: ${errBusca.message}`);

  if (checkinExistente) {
    const { error } = await supabase
      .from("check_ins_diarios")
      .update({
        escala_emocional_mae: data.escalaEmocionalMae,
        escala_emocional_membro: data.escalaEmocionalMembro ?? null,
      })
      .eq("id", checkinExistente.id);
    if (error) throw new Error(`Erro ao atualizar check-in: ${error.message}`);
  } else {
    const { error } = await supabase.from("check_ins_diarios").insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      escala_emocional_mae: data.escalaEmocionalMae,
      escala_emocional_membro: data.escalaEmocionalMembro ?? null,
      origem: "app",
    });
    if (error) throw new Error(`Erro ao salvar check-in: ${error.message}`);
  }

  // 2. Diário (só insere se houver alguma das 3 colunas A preenchida)
  const temCamadaA = Boolean(
    data.conquista?.trim() || data.desafio?.trim() || data.observacaoLivre?.trim(),
  );

  if (temCamadaA && data.membroAtipicoId) {
    const temCamadaB = Boolean(data.quemEstava || data.estadoAdulto || data.reacaoAdulto);
    const incompleto = Boolean(data.conquista || data.desafio) && !temCamadaB;
    const conquista = data.conquista?.trim() || null;
    const desafio = data.desafio?.trim() || null;
    const observacao_livre = data.observacaoLivre?.trim() || null;

    // Dedup: se já existe um diário hoje pra esse membro/origem com o MESMO
    // conteúdo (conquista + desafio + observação), atualiza em vez de inserir.
    // Evita duplicação por double-click no botão. Não impede o usuário de
    // registrar coisas diferentes no mesmo dia (textos distintos = nova linha).
    const { data: dup } = await supabase
      .from("diarios")
      .select("id")
      .eq("family_account_id", family.id)
      .eq("membro_atipico_id", data.membroAtipicoId)
      .eq("data", data.data)
      .eq("origem", "app")
      .match({ conquista, desafio, observacao_livre })
      .maybeSingle();

    const payload = {
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      conquista,
      desafio,
      observacao_livre,
      possivel_gatilho: data.possivelGatilho?.trim() || null,
      quem_estava: data.quemEstava ?? null,
      estado_adulto: data.estadoAdulto ?? null,
      reacao_adulto: data.reacaoAdulto ?? null,
      origem: "app",
      incompleto,
    };

    if (dup) {
      const { error } = await supabase
        .from("diarios")
        .update(payload)
        .eq("id", dup.id);
      if (error) throw new Error(`Erro ao atualizar registro do dia: ${error.message}`);
    } else {
      const { error } = await supabase.from("diarios").insert(payload);
      if (error) throw new Error(`Erro ao salvar registro do dia: ${error.message}`);
    }
  }

  revalidatePath("/painel");
  revalidatePath("/registrar");
  revalidatePath("/registrar/diario");
}

// ============================================================
// Diário → Kolo Vivo (proposta com pergunta, sem duplicar)
// Depois de registrar o dia, a Kolo lê o que foi escrito e, se houver algo
// NOVO (que ainda não está no Kolo Vivo), oferece guardar — a mãe decide.
// ============================================================

const proporSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  texto: z.string().trim().min(1),
});

export async function proporKoloVivoDoDiario(
  input: z.infer<typeof proporSchema>,
): Promise<{ ok: true; koloVivo: ItemKoloVivo[]; nome: string } | { ok: false; error: string }> {
  try {
    const { membroAtipicoId, texto } = proporSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: m } = await supabase
      .from("membros_atipicos")
      .select("nome, data_nascimento, perfil")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!m) return { ok: false, error: "Membro não encontrado." };

    const koloVivoResumo = await montarKoloVivoResumo(supabase, family.id, membroAtipicoId);
    const proposta = await extrairAtualizacoes({
      transcript: texto,
      koloVivoResumo,
      membro: {
        nome: m.nome as string,
        idade: idadeAnos((m.data_nascimento as string | null) ?? null),
        perfil: (m.perfil as string) ?? "",
      },
    });
    // Só camada1 (a criança) faz sentido a partir do diário.
    const koloVivo = proposta.koloVivo.filter((it) => it.camada === "camada1");
    return { ok: true, koloVivo, nome: m.nome as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const salvarKvSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  koloVivo: z
    .array(
      z.object({
        camada: z.enum(["camada1", "camada2"]),
        campo: z.string().min(1),
        subcampo: z.string().trim().nullable().optional(),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .min(1),
});

export async function salvarKoloVivoDoDiario(
  input: z.infer<typeof salvarKvSchema>,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const { membroAtipicoId, koloVivo } = salvarKvSchema.parse(input);
    const { supabase, family } = await requireFamily();
    await requireActiveWrite(family.id);
    const count = await aplicarItensNoMembro(
      supabase,
      family.id,
      membroAtipicoId,
      koloVivo as ItemKoloVivo[],
    );
    revalidatePath("/kolo-vivo");
    revalidatePath("/painel");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
