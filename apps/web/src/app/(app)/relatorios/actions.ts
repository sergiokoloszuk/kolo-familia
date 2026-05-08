"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { fetchReportData, type Destinatario, type JanelaMeses } from "@/lib/relatorio/data";
import { gerarNarrativa } from "@/lib/relatorio/narrativa";

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

// ============================================================
// Gerar relatório (snapshot)
// ============================================================

const gerarSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  destinatario: z.enum(["terapeuta", "escola"]),
  janelaMeses: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  incluiCamadaB: z.boolean(),
  incluiDass21: z.boolean(),
});

export type GerarRelatorioInput = z.infer<typeof gerarSchema>;

export async function gerarRelatorio(
  input: GerarRelatorioInput,
): Promise<{ id: string }> {
  const data = gerarSchema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  // Verifica que o membro pertence à família
  const { data: membro } = await supabase
    .from("membros_atipicos")
    .select("id, family_account_id")
    .eq("id", data.membroAtipicoId)
    .single();
  if (!membro || membro.family_account_id !== family.id) {
    throw new Error("Membro não encontrado nesta família");
  }

  const reportData = await fetchReportData(supabase, {
    membroAtipicoId: data.membroAtipicoId,
    destinatario: data.destinatario as Destinatario,
    janelaMeses: data.janelaMeses as JanelaMeses,
    includeCamadaB: data.incluiCamadaB,
    includeDass21: data.incluiDass21,
  });

  if (!reportData) throw new Error("Falha ao montar dados do relatório");

  const narrativa = await gerarNarrativa(reportData);

  const janelaInicio = new Date();
  janelaInicio.setMonth(janelaInicio.getMonth() - data.janelaMeses);

  const { data: row, error } = await supabase
    .from("relatorios_gerados")
    .insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      destinatario: data.destinatario,
      janela_inicio: janelaInicio.toISOString().slice(0, 10),
      janela_fim: new Date().toISOString().slice(0, 10),
      inclui_camada_b: data.incluiCamadaB,
      inclui_dass21: data.incluiDass21,
      snapshot: {
        report: reportData,
        narrativa,
      },
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`Falha ao salvar: ${error?.message}`);

  revalidatePath("/relatorios");
  return { id: row.id as string };
}

// ============================================================
// Link vivo
// ============================================================

const linkSchema = z.object({
  relatorioId: z.string().uuid(),
  destinatarioNome: z.string().trim().min(2).max(120),
  validadeDias: z.union([
    z.literal(7),
    z.literal(30),
    z.literal(90),
    z.literal(0), // 0 = sem expiração
  ]),
});

export async function criarLinkVivo(input: z.infer<typeof linkSchema>): Promise<{
  token: string;
}> {
  const data = linkSchema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  const { data: rel } = await supabase
    .from("relatorios_gerados")
    .select("membro_atipico_id, destinatario, inclui_camada_b, inclui_dass21")
    .eq("id", data.relatorioId)
    .eq("family_account_id", family.id)
    .single();
  if (!rel) throw new Error("Relatório não encontrado");

  const token = `lv_${randomToken(32)}`;
  const expiraEm =
    data.validadeDias > 0
      ? new Date(Date.now() + data.validadeDias * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase.from("links_vivos").insert({
    family_account_id: family.id,
    membro_atipico_id: rel.membro_atipico_id,
    destinatario: rel.destinatario,
    destinatario_nome: data.destinatarioNome,
    token,
    expira_em: expiraEm,
    inclui_camada_b: rel.inclui_camada_b,
    inclui_dass21: rel.inclui_dass21,
    acessos: [],
  });
  if (error) throw new Error(`Falha ao criar link: ${error.message}`);

  revalidatePath("/relatorios");
  revalidatePath(`/relatorios/${data.relatorioId}`);
  return { token };
}

export async function revogarLinkVivo(linkId: string): Promise<void> {
  const { supabase, family } = await requireFamily();
  const { error } = await supabase
    .from("links_vivos")
    .update({ revogado: true, revogado_em: new Date().toISOString() })
    .eq("id", linkId)
    .eq("family_account_id", family.id);
  if (error) throw new Error(`Falha ao revogar: ${error.message}`);
  revalidatePath("/relatorios");
}

export async function apagarRelatorio(id: string): Promise<void> {
  const { supabase, family } = await requireFamily();
  const { error } = await supabase
    .from("relatorios_gerados")
    .delete()
    .eq("id", id)
    .eq("family_account_id", family.id);
  if (error) throw new Error(`Falha ao apagar: ${error.message}`);
  revalidatePath("/relatorios");
  redirect("/relatorios");
}

function randomToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
