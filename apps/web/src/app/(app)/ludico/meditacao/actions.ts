"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { idadeAnos } from "@/lib/idade";
import {
  gerarMeditacao,
  ajustarMeditacao,
  sugerirTemas,
  type Intencao,
  type TemaSugerido,
} from "@/lib/ludico/meditacao";

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

function textoJsonb(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const t = (v as { texto?: unknown }).texto;
  return typeof t === "string" ? t.trim() : "";
}

/**
 * Monta o contexto da criança (perfil + desafios) E o que ela AMA — gostos,
 * hiperfocos e o que costuma DESENHAR — pra deixar a meditação pessoal e gostosa.
 */
async function carregarContexto(
  supabase: Sup,
  familyId: string,
  membroId: string,
): Promise<{
  membro: { nome: string; idade: number | null } | null;
  contexto: string;
  interesses: string;
}> {
  const { data: m } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("id", membroId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (!m) return { membro: null, contexto: "", interesses: "" };

  const [{ data: diarios }, { data: pv }, { data: desenhos }] = await Promise.all([
    supabase
      .from("diarios")
      .select("data, desafio")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", membroId)
      .not("desafio", "is", null)
      .order("data", { ascending: false })
      .limit(5),
    supabase
      .from("perfil_vivo_membro")
      .select("como_e, categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle(),
    supabase
      .from("desenhos")
      .select("analise")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", membroId)
      .eq("status", "pronto")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const partes: string[] = [];
  if (typeof m.perfil === "string" && m.perfil.trim()) partes.push(`Perfil: ${m.perfil.trim()}`);
  const desafios = (diarios ?? [])
    .map((d) => (d.desafio as string | null)?.trim())
    .filter((x): x is string => Boolean(x));
  if (desafios.length > 0) partes.push(`Desafios recentes: ${desafios.join("; ")}`);

  // Interesses: jeito de ser/gostos + hiperfocos + o que ela costuma desenhar.
  const interessesPartes: string[] = [];
  const comoE = textoJsonb(pv?.como_e);
  if (comoE) interessesPartes.push(comoE);
  const extras = (pv?.categorias_extras as Record<string, unknown> | null) ?? {};
  const gostos = textoJsonb(extras.gostos);
  if (gostos) interessesPartes.push(gostos);
  const pref = (extras.preferencias as { temas?: unknown } | undefined) ?? {};
  const hiper = Array.isArray(pref.temas)
    ? pref.temas.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  if (hiper.length) interessesPartes.push(`gosta de ${hiper.join(", ")}`);
  const temaCount = new Map<string, number>();
  for (const d of desenhos ?? []) {
    const a = d.analise as { temas?: unknown } | null;
    const temas = Array.isArray(a?.temas)
      ? (a!.temas as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    for (const t of temas) temaCount.set(t, (temaCount.get(t) ?? 0) + 1);
  }
  const desenha = [...temaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
  if (desenha.length) interessesPartes.push(`costuma desenhar ${desenha.join(", ")}`);

  return {
    membro: {
      nome: m.nome as string,
      idade: idadeAnos((m.data_nascimento as string | null) ?? null),
    },
    contexto: partes.join("\n"),
    interesses: interessesPartes.join("; "),
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
  intencao: z.enum([
    "acalmar",
    "visualizar",
    "processar",
    "dormir",
    "coragem",
    "seguranca",
    "outra",
  ]),
  tema: z.string().trim().max(120).optional(),
  contexto: z.string().trim().max(600).optional(),
});

export async function criarMeditacao(
  input: z.infer<typeof criarSchema>,
): Promise<Ok<{ meditacaoId: string }> | Fail> {
  try {
    const { membroId, intencao, tema, contexto } = criarSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { membro, contexto: ctxCrianca, interesses } = await carregarContexto(
      supabase,
      family.id,
      membroId,
    );
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    const contextoFinal = [contexto?.trim(), ctxCrianca].filter(Boolean).join("\n");
    const { titulo, roteiro } = await gerarMeditacao(
      { intencao: intencao as Intencao, tema, contexto: contextoFinal, membro, interesses },
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

const ajusteMedSchema = z.object({
  meditacaoId: z.string().uuid(),
  pedido: z.string().trim().min(1).max(400),
});

/** Reescreve uma meditação salva aplicando um pedido de ajuste (chat de IA). */
export async function ajustarMeditacaoExistente(
  input: z.infer<typeof ajusteMedSchema>,
): Promise<Ok | Fail> {
  try {
    const { meditacaoId, pedido } = ajusteMedSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const { data: med } = await supabase
      .from("meditacoes")
      .select("id, intencao, tema, contexto, roteiro, membro_atipico_id")
      .eq("id", meditacaoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!med) return { ok: false, error: "Meditação não encontrada." };

    const { membro, contexto: ctxCrianca, interesses } = await carregarContexto(
      supabase,
      family.id,
      med.membro_atipico_id as string,
    );
    const contextoFinal = [(med.contexto as string | null)?.trim(), ctxCrianca]
      .filter(Boolean)
      .join("\n");
    const { titulo, roteiro } = await ajustarMeditacao(
      {
        roteiroAtual: med.roteiro as string,
        pedido,
        intencao: med.intencao as Intencao,
        tema: (med.tema as string | null) ?? undefined,
        contexto: contextoFinal,
        membro,
        interesses,
      },
      { supabase, family_account_id: family.id },
    );
    const { error } = await supabase
      .from("meditacoes")
      .update({ titulo, roteiro })
      .eq("id", meditacaoId)
      .eq("family_account_id", family.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/ludico/meditacao/${meditacaoId}`);
    return { ok: true };
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
