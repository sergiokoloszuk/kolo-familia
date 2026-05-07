"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
// Camada 2 (família) — composicao | rotina | recursos | dinamica
// ============================================================

const familiaCampos = ["composicao", "rotina", "recursos", "dinamica"] as const;
const saveFamiliaSchema = z.object({
  campo: z.enum(familiaCampos),
  texto: z.string().trim().max(5000),
});

export async function saveSecaoFamilia(input: z.infer<typeof saveFamiliaSchema>) {
  const { campo, texto } = saveFamiliaSchema.parse(input);
  const { supabase, family } = await requireFamily();

  // upsert preserva os outros campos
  const { data: atual } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", family.id)
    .maybeSingle();

  const novo = {
    composicao: atual?.composicao ?? {},
    rotina: atual?.rotina ?? {},
    recursos: atual?.recursos ?? {},
    dinamica: atual?.dinamica ?? {},
  } as Record<(typeof familiaCampos)[number], Record<string, unknown>>;

  novo[campo] = { ...(novo[campo] as Record<string, unknown>), texto };

  await supabase.from("perfil_vivo_familia").upsert({
    family_account_id: family.id,
    ...novo,
    completude_pct: estimaCompletude([
      novo.composicao.texto as string | undefined,
      novo.rotina.texto as string | undefined,
      novo.recursos.texto as string | undefined,
      novo.dinamica.texto as string | undefined,
    ]),
  });

  revalidatePath("/kolo-vivo");
}

// ============================================================
// Camada 1 (membro) — essencial | como_e | corpo_rotina | desafios_regulacao | sensorial
// ============================================================

const membroCampos = [
  "essencial",
  "como_e",
  "corpo_rotina",
  "desafios_regulacao",
  "sensorial",
] as const;

const saveMembroSchema = z.object({
  membro_id: z.string().uuid(),
  campo: z.enum(membroCampos),
  texto: z.string().trim().max(5000),
});

export async function saveSecaoMembro(input: z.infer<typeof saveMembroSchema>) {
  const { membro_id, campo, texto } = saveMembroSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
    .eq("membro_atipico_id", membro_id)
    .maybeSingle();

  const novo = {
    essencial: atual?.essencial ?? {},
    como_e: atual?.como_e ?? {},
    corpo_rotina: atual?.corpo_rotina ?? {},
    desafios_regulacao: atual?.desafios_regulacao ?? {},
    sensorial: atual?.sensorial ?? {},
  } as Record<(typeof membroCampos)[number], Record<string, unknown>>;

  novo[campo] = { ...(novo[campo] as Record<string, unknown>), texto };

  await supabase.from("perfil_vivo_membro").upsert(
    {
      membro_atipico_id: membro_id,
      family_account_id: family.id,
      ...novo,
      completude_pct: estimaCompletude([
        novo.essencial.texto as string | undefined,
        novo.como_e.texto as string | undefined,
        novo.corpo_rotina.texto as string | undefined,
        novo.desafios_regulacao.texto as string | undefined,
        novo.sensorial.texto as string | undefined,
      ]),
    },
    { onConflict: "membro_atipico_id" },
  );

  revalidatePath("/kolo-vivo");
}

// ============================================================
// Sugestões pendentes — aprovar/rejeitar
// ============================================================

const decideSugestaoSchema = z.object({
  sugestao_id: z.string().uuid(),
  decisao: z.enum(["aprovar", "rejeitar"]),
});

export async function decideSugestao(input: z.infer<typeof decideSugestaoSchema>) {
  const { sugestao_id, decisao } = decideSugestaoSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { data: sug } = await supabase
    .from("sugestao_perfil_vivos")
    .select("id, family_account_id, membro_atipico_id, camada, campo, texto_sugerido, status")
    .eq("id", sugestao_id)
    .single();

  if (!sug || sug.family_account_id !== family.id) {
    throw new Error("Sugestão não encontrada");
  }
  if (sug.status !== "pendente") {
    throw new Error("Sugestão já decidida");
  }

  if (decisao === "aprovar") {
    if (sug.camada === "camada1") {
      if (!sug.membro_atipico_id) throw new Error("Sugestão sem membro");
      const campo = sug.campo as (typeof membroCampos)[number];
      if (!membroCampos.includes(campo)) throw new Error("Campo inválido");
      await saveSecaoMembro({ membro_id: sug.membro_atipico_id, campo, texto: sug.texto_sugerido });
    } else {
      const campo = sug.campo as (typeof familiaCampos)[number];
      if (!familiaCampos.includes(campo)) throw new Error("Campo inválido");
      await saveSecaoFamilia({ campo, texto: sug.texto_sugerido });
    }
  }

  await supabase
    .from("sugestao_perfil_vivos")
    .update({ status: decisao === "aprovar" ? "aprovada" : "rejeitada", decidido_em: new Date().toISOString() })
    .eq("id", sugestao_id);

  revalidatePath("/kolo-vivo");
  revalidatePath("/painel");
}

function estimaCompletude(textos: (string | undefined)[]): number {
  const preenchidos = textos.filter((t) => t && t.trim().length > 10).length;
  return Math.round((preenchidos / textos.length) * 100);
}
