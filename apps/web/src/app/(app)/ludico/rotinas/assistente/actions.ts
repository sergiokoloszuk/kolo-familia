"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveFamily } from "@/lib/auth/current-family";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { idadeAnos } from "@/lib/idade";
import { interpretarRotina, type PropostaRotina } from "@/lib/ludico/rotina-ia";

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
  // Trial vencido / assinatura inativa não escreve nem gera (isto custa IA e
  // imagem). O TrialGate esconde a TELA, mas server action é endpoint próprio:
  // aba aberta antes de vencer, ou chamada direta, passava direto. Admin/staff
  // e cortesia continuam liberados (a regra mora em requireActiveWrite).
  await requireActiveWrite(family.id);
  return { supabase, family };
}

const turnoSchema = z.object({ de: z.enum(["mae", "kolo"]), texto: z.string().max(4000) });
const tarefaSchema = z.object({ texto: z.string().max(160), hora: z.string().max(12).nullable() });
const rotinaSchema = z.object({
  nome: z.string().max(80),
  dia_semana: z.number().int().min(0).max(6).nullable(),
  tarefas: z.array(tarefaSchema).max(30),
});

const montarSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  historico: z.array(turnoSchema).min(1).max(40),
  propostaAtual: z.array(rotinaSchema).max(21).optional(),
});

/** Passo do chat: manda a conversa, a IA devolve a semana proposta (não grava ainda). */
export async function montarRotinaIA(
  input: z.infer<typeof montarSchema>,
): Promise<Ok<{ proposta: PropostaRotina }> | Fail> {
  try {
    const { membroAtipicoId, historico, propostaAtual } = montarSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    const proposta = await interpretarRotina(supabase, {
      familyId: family.id,
      nome: (membro.nome as string) ?? "seu filho",
      idade: idadeAnos((membro.data_nascimento as string | null) ?? null),
      historico,
      propostaAtual: propostaAtual ?? null,
    });
    return { ok: true, proposta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const aplicarSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  rotinas: z.array(rotinaSchema).min(1).max(21),
});

/**
 * A mãe aprovou → cria as rotinas de verdade. Várias versões do mesmo dia são
 * permitidas (distinguidas pelo nome). Reaplicar com o MESMO nome+dia substitui
 * as tarefas daquela rotina (idempotente), em vez de empilhar duplicatas.
 */
export async function aplicarRotinaIA(
  input: z.infer<typeof aplicarSchema>,
): Promise<Ok<{ criadas: number }> | Fail> {
  try {
    const { membroAtipicoId, rotinas } = aplicarSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!membro) return { ok: false, error: "Membro não encontrado." };

    let criadas = 0;
    for (const r of rotinas) {
      const nome = r.nome.trim() || "Rotina";
      // Reusa se já existir MESMO nome + mesmo dia (senão cria nova versão).
      let matchQuery = supabase
        .from("rotinas")
        .select("id")
        .eq("membro_atipico_id", membroAtipicoId)
        .eq("family_account_id", family.id)
        .eq("nome", nome);
      matchQuery =
        r.dia_semana === null
          ? matchQuery.is("dia_semana", null)
          : matchQuery.eq("dia_semana", r.dia_semana);
      const { data: existente } = await matchQuery.maybeSingle();
      let rotinaId = existente?.id as string | undefined;

      if (!rotinaId) {
        const { data: nova, error } = await supabase
          .from("rotinas")
          .insert({
            family_account_id: family.id,
            membro_atipico_id: membroAtipicoId,
            nome,
            dia_semana: r.dia_semana,
          })
          .select("id")
          .single();
        if (error || !nova) continue;
        rotinaId = nova.id as string;
      }

      await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
      const rows = r.tarefas.slice(0, 25).map((t, i) => ({
        rotina_id: rotinaId,
        texto: t.texto.trim().slice(0, 120),
        hora: t.hora ? t.hora.trim().slice(0, 10) : null,
        icone: null,
        ordem: i,
      }));
      if (rows.length) await supabase.from("rotina_tarefas").insert(rows);
      criadas += 1;
    }

    revalidatePath("/ludico/rotinas");
    revalidatePath("/ludico/rotinas/semana");
    return { ok: true, criadas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
