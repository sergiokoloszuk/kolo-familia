"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { idadeAnos } from "@/lib/idade";

const dataNascimentoSchema = (minAnos: number, maxAnos: number, msg: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .refine((d) => {
      const a = idadeAnos(d);
      return a !== null && a >= minAnos && a <= maxAnos;
    }, msg);

// ============================================================
// Helpers
// ============================================================

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: family } = await supabase
    .from("family_accounts")
    .select("id, onboarding_step")
    .eq("user_id", user.id)
    .single();
  if (!family) throw new Error("Família não inicializada");

  return { supabase, user, family };
}

async function bumpStep(supabase: Awaited<ReturnType<typeof createClient>>, familyId: string, nextStep: number) {
  const { error } = await supabase
    .from("family_accounts")
    .update({ onboarding_step: nextStep })
    .eq("id", familyId);
  if (error) throw new Error(`Erro ao avançar etapa: ${error.message}`);
  revalidatePath("/onboarding");
}

// ============================================================
// Tela 1 — dados da mãe + WhatsApp
// ============================================================

const tela1Schema = z.object({
  nome_mae: z.string().trim().min(2, "Nome muito curto"),
  data_nascimento_mae: dataNascimentoSchema(16, 100, "Idade deve estar entre 16 e 100 anos"),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "WhatsApp deve estar no formato +DDIDDDNNNNNNNNN"),
  como_chamar: z.string().trim().optional(),
});

export type Tela1Input = z.infer<typeof tela1Schema>;

export async function saveTela1(raw: Tela1Input) {
  const data = tela1Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  const { error: errProfile } = await supabase.from("family_profiles").upsert({
    family_account_id: family.id,
    nome_mae: data.nome_mae,
    data_nascimento_mae: data.data_nascimento_mae,
    como_chamar: data.como_chamar || null,
  });
  if (errProfile) throw new Error(`Erro ao salvar perfil: ${errProfile.message}`);

  const { error: errWhats } = await supabase
    .from("family_accounts")
    .update({ whatsapp_e164: data.whatsapp_e164 })
    .eq("id", family.id);
  if (errWhats) throw new Error(`Erro ao salvar WhatsApp: ${errWhats.message}`);

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 2));
}

// ============================================================
// Tela 2 — membros atípicos (1+)
// ============================================================

const membroSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2, "Nome muito curto"),
  data_nascimento: dataNascimentoSchema(0, 120, "Data de nascimento inválida"),
  perfil: z.enum(["TEA", "TDAH", "Dislexia", "AHSD", "Outro", "EmInvestigacao"]),
});

const tela2Schema = z.object({
  membros: z.array(membroSchema).min(1, "Cadastre pelo menos 1 membro atípico"),
});

export type Tela2Input = z.infer<typeof tela2Schema>;

export async function saveTela2(raw: Tela2Input) {
  const data = tela2Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  const novos = data.membros.filter((m) => !m.id);
  const existentes = data.membros.filter((m) => m.id);

  if (novos.length > 0) {
    const { error } = await supabase.from("membros_atipicos").insert(
      novos.map((m) => ({
        family_account_id: family.id,
        nome: m.nome,
        data_nascimento: m.data_nascimento,
        perfil: m.perfil,
      })),
    );
    if (error) throw new Error(`Erro ao cadastrar membro(s): ${error.message}`);
  }

  for (const m of existentes) {
    const { error } = await supabase
      .from("membros_atipicos")
      .update({ nome: m.nome, data_nascimento: m.data_nascimento, perfil: m.perfil })
      .eq("id", m.id!)
      .eq("family_account_id", family.id);
    if (error) throw new Error(`Erro ao atualizar membro: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 3));

  // Retorna a lista canônica do banco — wizard usa esses ids no step 4.
  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil")
    .eq("family_account_id", family.id)
    .order("created_at", { ascending: true });

  return (membros ?? []) as Array<{
    id: string;
    nome: string;
    data_nascimento: string;
    perfil: string;
  }>;
}

export async function removeMembro(membroId: string) {
  const { supabase, family } = await requireFamily();
  await supabase
    .from("membros_atipicos")
    .delete()
    .eq("id", membroId)
    .eq("family_account_id", family.id);
  revalidatePath("/onboarding");
}

// ============================================================
// Tela 3 — contexto familiar (Kolo Vivo Camada 2)
// ============================================================

const tela3Schema = z.object({
  composicao: z.string().trim().optional(),
  rotina: z.string().trim().optional(),
  recursos: z.string().trim().optional(),
  dinamica: z.string().trim().optional(),
});

export type Tela3Input = z.infer<typeof tela3Schema>;

export async function saveTela3(raw: Tela3Input) {
  const data = tela3Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  const { error } = await supabase.from("perfil_vivo_familia").upsert({
    family_account_id: family.id,
    composicao: data.composicao ? { texto: data.composicao } : {},
    rotina: data.rotina ? { texto: data.rotina } : {},
    recursos: data.recursos ? { texto: data.recursos } : {},
    dinamica: data.dinamica ? { texto: data.dinamica } : {},
    completude_pct: estimaCompletude([data.composicao, data.rotina, data.recursos, data.dinamica]),
  });
  if (error) throw new Error(`Erro ao salvar contexto: ${error.message}`);

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 4));
}

function estimaCompletude(textos: (string | undefined)[]): number {
  const preenchidos = textos.filter((t) => t && t.trim().length > 10).length;
  return Math.round((preenchidos / textos.length) * 100);
}

// ============================================================
// Tela 4 — quick Kolo Vivo (3 desafios + 3 interesses + 1 conquista por membro)
// ============================================================

const quickKoloSchema = z.object({
  membro_id: z.string().uuid(),
  desafios: z.array(z.string().trim()).max(3),
  interesses: z.array(z.string().trim()).max(3),
  conquista: z.string().trim().optional(),
});

const tela4Schema = z.object({
  porMembro: z.array(quickKoloSchema).min(1),
});

export type Tela4Input = z.infer<typeof tela4Schema>;

export async function saveTela4(raw: Tela4Input) {
  const data = tela4Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  for (const item of data.porMembro) {
    const desafios = item.desafios.filter(Boolean);
    const interesses = item.interesses.filter(Boolean);
    const { error } = await supabase.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: item.membro_id,
        family_account_id: family.id,
        como_e: { interesses },
        desafios_regulacao: { desafios_iniciais: desafios },
        essencial: item.conquista ? { conquista_inicial: item.conquista } : {},
        completude_pct: 25,
      },
      { onConflict: "membro_atipico_id" },
    );
    if (error) throw new Error(`Erro ao salvar primeiros sinais: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 5));
}

// ============================================================
// Tela 5 — termos + opt-in Ayla
// ============================================================

const tela5Schema = z.object({
  aceitou_termos: z.literal(true, { message: "É preciso aceitar os termos" }),
  optin_ayla: z.boolean(),
});

export type Tela5Input = z.infer<typeof tela5Schema>;

export async function saveTela5(raw: Tela5Input) {
  const data = tela5Schema.parse(raw);
  const { supabase, family } = await requireFamily();

  if (data.optin_ayla) {
    const { error } = await supabase
      .from("ayla_preferences")
      .update({ desativada: false, consentimento_em: new Date().toISOString() })
      .eq("family_account_id", family.id);
    if (error) throw new Error(`Erro ao salvar consentimento da Ayla: ${error.message}`);
  }

  await bumpStep(supabase, family.id, Math.max(family.onboarding_step, 6));
}

// ============================================================
// Tela 6 — confirmação + tour
// ============================================================

export async function completeOnboarding() {
  const { supabase, family } = await requireFamily();
  const { error } = await supabase
    .from("family_accounts")
    .update({ onboarding_completed: true, onboarding_step: 7 })
    .eq("id", family.id);
  if (error) throw new Error(`Erro ao concluir onboarding: ${error.message}`);

  // Dispara a primeira mensagem da Ayla na hora — best-effort.
  // sendBoasVindas já respeita consentimento (LGPD), pausa e idempotência.
  // Usa service-role porque o orchestrator escreve em ayla_send_log
  // (admin-only) e ayla_messages outbound (sem policy de insert para
  // usuário comum). Se Z-API falhar, o erro fica em ayla_send_log e o
  // usuário continua o fluxo normalmente.
  try {
    console.log("[onboarding] → sendBoasVindas family.id =", family.id);
    const admin = createServiceRoleClient();
    const { sendBoasVindas } = await import("@/lib/ayla/orchestrator");
    const r = await sendBoasVindas(admin, family.id);
    console.log("[onboarding] ← sendBoasVindas result:", r);
  } catch (err) {
    console.error("[onboarding] sendBoasVindas threw:", err);
  }

  revalidatePath("/onboarding");
  revalidatePath("/painel");
  revalidatePath("/");
}
