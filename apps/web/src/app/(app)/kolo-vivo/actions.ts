"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DOMINIOS, membroCampoStorage } from "./dominios";
import { detectarMarcos } from "@/lib/kolo-vivo/incorporar";

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

  novo[campo] = {
    ...(novo[campo] as Record<string, unknown>),
    texto,
    atualizado_em: new Date().toISOString(),
  };

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
// Camada 1 (membro) — 9 domínios do Retrato vivo + campos legados.
// Cada campo cai numa coluna jsonb dedicada (toplevel) ou numa chave de
// `categorias_extras` (ver dominios.ts → membroCampoStorage).
// ============================================================

const saveMembroSchema = z.object({
  membro_id: z.string().uuid(),
  campo: z.string().refine((c) => membroCampoStorage(c) !== null, {
    message: "Campo desconhecido",
  }),
  texto: z.string().trim().max(5000),
});

/** Texto guardado num campo do membro — { texto, atualizado_em } ou string. */
function textoDe(json: unknown): string {
  if (!json) return "";
  if (typeof json === "string") return json;
  if (typeof json === "object") {
    const t = (json as { texto?: unknown }).texto;
    return typeof t === "string" ? t : "";
  }
  return "";
}

type MembroRow = {
  essencial?: unknown;
  como_e?: unknown;
  corpo_rotina?: unknown;
  desafios_regulacao?: unknown;
  sensorial?: unknown;
  categorias_extras?: Record<string, unknown> | null;
};

/** % do retrato preenchido, medido pelos 9 domínios (com fallback legado). */
function completudeDosDominios(row: MembroRow): number {
  const extras = (row.categorias_extras ?? {}) as Record<string, unknown>;
  const textos = DOMINIOS.map((d) => {
    const principal =
      d.storage === "toplevel"
        ? textoDe((row as Record<string, unknown>)[d.key])
        : textoDe(extras[d.key]);
    if (principal.trim()) return principal;
    return d.legacyFallback
      ? textoDe((row as Record<string, unknown>)[d.legacyFallback])
      : "";
  });
  return estimaCompletude(textos);
}

export async function saveSecaoMembro(input: z.infer<typeof saveMembroSchema>) {
  const { membro_id, campo, texto } = saveMembroSchema.parse(input);
  const { supabase, family } = await requireFamily();
  const storage = membroCampoStorage(campo);

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select(
      "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
    )
    .eq("membro_atipico_id", membro_id)
    .maybeSingle();

  const row: MembroRow = { ...(atual ?? {}) };
  const agora = new Date().toISOString();
  const valor = { texto, atualizado_em: agora };

  // Marco de evolução: um status (seletor) que mudou de valor vira marco datado.
  const oldTexto =
    storage === "toplevel"
      ? textoDe((atual as Record<string, unknown> | null)?.[campo])
      : textoDe(((atual?.categorias_extras as Record<string, unknown> | null) ?? {})[campo]);
  const marcos = detectarMarcos(campo, oldTexto, texto, agora);

  const extras = { ...((atual?.categorias_extras as Record<string, unknown>) ?? {}) };
  if (marcos.length) {
    const anteriores = Array.isArray(extras.marcos) ? (extras.marcos as unknown[]) : [];
    extras.marcos = [...marcos, ...anteriores].slice(0, 40);
  }

  // Monta o patch só com o que muda — preserva o resto via upsert.
  const patch: Record<string, unknown> = {
    membro_atipico_id: membro_id,
    family_account_id: family.id,
  };

  if (storage === "toplevel") {
    (row as Record<string, unknown>)[campo] = valor;
    patch[campo] = valor;
  } else {
    extras[campo] = valor;
  }
  row.categorias_extras = extras;
  // Grava extras se for domínio extra OU se houve marco (que mora em extras).
  if (storage !== "toplevel" || marcos.length) {
    patch.categorias_extras = extras;
  }

  patch.completude_pct = completudeDosDominios(row);

  await supabase
    .from("perfil_vivo_membro")
    .upsert(patch, { onConflict: "membro_atipico_id" });

  revalidatePath("/kolo-vivo");
  revalidatePath("/painel");
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
      const campo = sug.campo as string;
      if (membroCampoStorage(campo) === null) throw new Error("Campo inválido");
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

// ============================================================
// Conflitos cross-campo — dispensar um aviso revisado
// ============================================================

const descartarConflitoSchema = z.object({
  membro_id: z.string().uuid(),
  chave: z.string().min(1).max(200),
});

/** Dispensa um aviso de conflito cross-campo (a mãe revisou / não procede). */
export async function descartarConflito(
  input: z.infer<typeof descartarConflitoSchema>,
) {
  const { membro_id, chave } = descartarConflitoSchema.parse(input);
  const { supabase, family } = await requireFamily();

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select("categorias_extras")
    .eq("membro_atipico_id", membro_id)
    .eq("family_account_id", family.id)
    .maybeSingle();
  const extras = { ...((atual?.categorias_extras as Record<string, unknown>) ?? {}) };
  const conflitos = Array.isArray(extras.conflitos) ? [...extras.conflitos] : [];
  extras.conflitos = conflitos.map((c) =>
    c && typeof c === "object" && (c as { chave?: string }).chave === chave
      ? { ...(c as object), status: "dispensado" }
      : c,
  );

  await supabase
    .from("perfil_vivo_membro")
    .update({ categorias_extras: extras })
    .eq("membro_atipico_id", membro_id)
    .eq("family_account_id", family.id);

  revalidatePath("/kolo-vivo");
}

function estimaCompletude(textos: (string | undefined)[]): number {
  const preenchidos = textos.filter((t) => t && t.trim().length > 10).length;
  return Math.round((preenchidos / textos.length) * 100);
}
