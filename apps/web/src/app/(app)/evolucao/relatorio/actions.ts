"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  gerarRelatorio as gerarRelatorioIA,
  ajustarRelatorio as ajustarRelatorioIA,
} from "@/lib/relatorio/gerar";

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

const schema = z.object({
  membroId: z.string().uuid(),
  destinatario: z.enum(["escola", "terapeuta"]),
});

/** Gera o rascunho do relatório (IA) — só LÊ; quem baixa é a tela (impressão). */
export async function gerarRelatorio(
  input: z.infer<typeof schema>,
): Promise<{ ok: true; markdown: string; nome: string } | { ok: false; error: string }> {
  try {
    const { membroId, destinatario } = schema.parse(input);
    const { supabase, family } = await requireFamily();
    const r = await gerarRelatorioIA({
      supabase,
      familyId: family.id,
      membroId,
      destinatario,
    });
    if (!r) return { ok: false, error: "Não consegui montar o relatório. Tente de novo." };
    return { ok: true, markdown: r.markdown, nome: r.nome };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const ajusteSchema = schema.extend({
  markdownAtual: z.string().trim().min(1),
  pedido: z.string().trim().min(1).max(500),
});

/** Reescreve o relatório aplicando um pedido de ajuste (chat de IA). */
export async function ajustarRelatorio(
  input: z.infer<typeof ajusteSchema>,
): Promise<{ ok: true; markdown: string; nome: string } | { ok: false; error: string }> {
  try {
    const { membroId, destinatario, markdownAtual, pedido } = ajusteSchema.parse(input);
    const { supabase, family } = await requireFamily();
    const r = await ajustarRelatorioIA({
      supabase,
      familyId: family.id,
      membroId,
      destinatario,
      markdownAtual,
      pedido,
    });
    if (!r) return { ok: false, error: "Não consegui ajustar o relatório. Tente de novo." };
    return { ok: true, markdown: r.markdown, nome: r.nome };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
