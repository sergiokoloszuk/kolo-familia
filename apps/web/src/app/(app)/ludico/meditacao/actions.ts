"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { idadeAnos } from "@/lib/idade";
import { gerarMeditacao, sugerirTemas, type Intencao, type TemaSugerido } from "@/lib/ludico/meditacao";

type Ok<T = object> = { ok: true } & T;
type Fail = { ok: false; error: string };

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
  return { supabase, family };
}

type Sup = Awaited<ReturnType<typeof requireFamily>>["supabase"];

/** Monta o contexto da criança (perfil + desafios recentes) pra dar pertinência. */
async function carregarContexto(
  supabase: Sup,
  familyId: string,
  membroId: string,
): Promise<{ membro: { nome: string; idade: number | null } | null; contexto: string }> {
  const { data: m } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("id", membroId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (!m) return { membro: null, contexto: "" };

  const { data: diarios } = await supabase
    .from("diarios")
    .select("data, desafio")
    .eq("family_account_id", familyId)
    .eq("membro_atipico_id", membroId)
    .not("desafio", "is", null)
    .order("data", { ascending: false })
    .limit(5);

  const partes: string[] = [];
  if (typeof m.perfil === "string" && m.perfil.trim()) partes.push(`Perfil: ${m.perfil.trim()}`);
  const desafios = (diarios ?? [])
    .map((d) => (d.desafio as string | null)?.trim())
    .filter((x): x is string => Boolean(x));
  if (desafios.length > 0) partes.push(`Desafios recentes: ${desafios.join("; ")}`);

  return {
    membro: {
      nome: m.nome as string,
      idade: idadeAnos((m.data_nascimento as string | null) ?? null),
    },
    contexto: partes.join("\n"),
  };
}

export async function sugerirTemasMeditacao(input: {
  membroId: string;
}): Promise<Ok<{ sugestoes: TemaSugerido[] }> | Fail> {
  try {
    const membroId = z.string().uuid().parse(input.membroId);
    const { supabase, family } = await requireFamily();
    const { membro, contexto } = await carregarContexto(supabase, family.id, membroId);
    if (!membro) return { ok: false, error: "Membro não encontrado." };
    const sugestoes = await sugerirTemas(
      { contexto, membro },
      { supabase, family_account_id: family.id },
    );
    return { ok: true, sugestoes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const criarSchema = z.object({
  membroId: z.string().uuid(),
  intencao: z.enum(["acalmar", "visualizar", "dormir", "coragem", "seguranca", "outra"]),
  tema: z.string().trim().max(120).optional(),
  contexto: z.string().trim().max(600).optional(),
});

export async function criarMeditacao(
  input: z.infer<typeof criarSchema>,
): Promise<Ok<{ meditacaoId: string }> | Fail> {
  try {
    const { membroId, intencao, tema, contexto } = criarSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { membro, contexto: ctxCrianca } = await carregarContexto(supabase, family.id, membroId);
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    const contextoFinal = [contexto?.trim(), ctxCrianca].filter(Boolean).join("\n");
    const { titulo, roteiro } = await gerarMeditacao(
      { intencao: intencao as Intencao, tema, contexto: contextoFinal, membro },
      { supabase, family_account_id: family.id },
    );

    const { data, error } = await supabase
      .from("meditacoes")
      .insert({
        family_account_id: family.id,
        membro_atipico_id: membroId,
        intencao,
        tema: tema || null,
        contexto: contexto || null,
        titulo,
        roteiro,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: `Não consegui salvar: ${error?.message}` };

    revalidatePath("/ludico/meditacao");
    return { ok: true, meditacaoId: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function excluirMeditacao(input: { meditacaoId: string }): Promise<Ok | Fail> {
  try {
    const meditacaoId = z.string().uuid().parse(input.meditacaoId);
    const { supabase, family } = await requireFamily();
    const { error } = await supabase
      .from("meditacoes")
      .delete()
      .eq("id", meditacaoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ludico/meditacao");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
