import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemKoloVivo } from "@/lib/ia/atualizar";
import { MEMBRO_CAMPOS_TOPLEVEL, MEMBRO_CAMPOS_EXTRAS, membroCampoStorage } from "./campos";
import {
  subcamposDe,
  parsearSubcampos,
  serializarSubcampos,
  splitItens,
  joinItens,
} from "./subcampos";

/**
 * Núcleo compartilhado de incorporação no Kolo Vivo — usado pela Estratégia
 * ("Guardar no Kolo Vivo") e pelo Registro Diário (proposta pós-registro).
 * Mantém o resumo (pro extrator não duplicar) e a gravação num só lugar.
 */

export const FAMILIA_CAMPOS = ["composicao", "rotina", "recursos", "dinamica"] as const;

function resumoCampo(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const obj = json as Record<string, unknown>;
  if (typeof obj.texto === "string" && obj.texto.trim()) return obj.texto.trim();
  const partes: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "atualizado_em") continue;
    if (typeof v === "string" && v.trim()) partes.push(v.trim());
    else if (Array.isArray(v)) partes.push(v.filter((x) => typeof x === "string").join("; "));
  }
  return partes.filter(Boolean).join(" · ");
}

/**
 * Resumo do Kolo Vivo atual (membro + família) — dado ao extrator pra ele NÃO
 * re-propor o que já existe. Inclui os domínios novos (categorias_extras).
 */
export async function montarKoloVivoResumo(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
): Promise<string> {
  const linhas: string[] = [];

  if (membroId) {
    const { data: pvm } = await supabase
      .from("perfil_vivo_membro")
      .select(
        "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
      )
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    if (pvm) {
      for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
        const resumo = resumoCampo((pvm as Record<string, unknown>)[campo]);
        if (resumo) linhas.push(`[criança/${campo}] ${resumo}`);
      }
      const extras = (pvm.categorias_extras as Record<string, unknown> | null) ?? {};
      for (const campo of MEMBRO_CAMPOS_EXTRAS) {
        const resumo = resumoCampo(extras[campo]);
        if (resumo) linhas.push(`[criança/${campo}] ${resumo}`);
      }
    }
  }

  const { data: pvf } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", familyId)
    .maybeSingle();
  if (pvf) {
    for (const campo of FAMILIA_CAMPOS) {
      const resumo = resumoCampo((pvf as Record<string, unknown>)[campo]);
      if (resumo) linhas.push(`[família/${campo}] ${resumo}`);
    }
  }

  return linhas.join("\n");
}

/** Anexa um fato curto ao texto da seção, sem substituir o que já existe. */
export function appendFato(prev: string, fato: string): string {
  const p = (prev ?? "").trim();
  const f = fato.trim();
  if (!p) return f;
  if (p.toLowerCase().includes(f.toLowerCase())) return p;
  return `${p}\n${f}`;
}

/**
 * Novo texto de um campo, respeitando sub-campos estruturados. Domínios com
 * sub-campos recebem o fato NO sub-campo certo (seletor substitui; lista anexa;
 * demais anexam); domínios simples usam anexo/reescrita.
 */
export function aplicarTextoCampo(
  campo: string,
  prev: string,
  it: { subcampo?: string | null; texto: string; operacao: "adicionar" | "reescrever" },
): string {
  const subs = subcamposDe(campo);
  if (!subs) {
    return it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
  }
  const valores = parsearSubcampos(subs, prev);
  const def =
    (it.subcampo && subs.find((s) => s.key === it.subcampo)) || subs[subs.length - 1];
  if (def.opcoes) {
    valores[def.key] = it.texto;
  } else if (def.lista) {
    valores[def.key] = joinItens([
      ...splitItens(valores[def.key] ?? ""),
      ...splitItens(it.texto),
    ]);
  } else {
    valores[def.key] = appendFato(valores[def.key] ?? "", it.texto);
  }
  return serializarSubcampos(subs, valores);
}

/** Grava itens camada1 (criança) no perfil_vivo_membro. Devolve quantos. */
export async function aplicarItensNoMembro(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  itens: ItemKoloVivo[],
): Promise<number> {
  const membroItens = itens.filter(
    (it) => it.camada === "camada1" && membroCampoStorage(it.campo) !== null,
  );
  if (membroItens.length === 0) return 0;

  const now = new Date().toISOString();
  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select(
      "essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras",
    )
    .eq("membro_atipico_id", membroId)
    .maybeSingle();

  const toplevel: Record<string, Record<string, unknown>> = {};
  for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
    toplevel[campo] = (atual?.[campo] as Record<string, unknown>) ?? {};
  }
  const extras: Record<string, unknown> =
    (atual?.categorias_extras as Record<string, unknown>) ?? {};

  for (const it of membroItens) {
    const onde = membroCampoStorage(it.campo);
    if (onde === "toplevel") {
      const prev = (toplevel[it.campo].texto as string) ?? "";
      toplevel[it.campo] = {
        ...toplevel[it.campo],
        texto: aplicarTextoCampo(it.campo, prev, it),
        atualizado_em: now,
      };
    } else if (onde === "extras") {
      const atualCampo = (extras[it.campo] as Record<string, unknown>) ?? {};
      const prev = (atualCampo.texto as string) ?? "";
      extras[it.campo] = {
        ...atualCampo,
        texto: aplicarTextoCampo(it.campo, prev, it),
        atualizado_em: now,
      };
    }
  }

  const { error } = await supabase.from("perfil_vivo_membro").upsert(
    {
      membro_atipico_id: membroId,
      family_account_id: familyId,
      ...toplevel,
      categorias_extras: extras,
    },
    { onConflict: "membro_atipico_id" },
  );
  if (error) throw new Error(`Falha ao salvar no Kolo Vivo: ${error.message}`);
  return membroItens.length;
}

/** Grava itens camada2 (família) no perfil_vivo_familia. Devolve quantos. */
export async function aplicarItensNaFamilia(
  supabase: SupabaseClient,
  familyId: string,
  itens: ItemKoloVivo[],
): Promise<number> {
  const familiaItens = itens.filter(
    (it) => it.camada === "camada2" && (FAMILIA_CAMPOS as readonly string[]).includes(it.campo),
  );
  if (familiaItens.length === 0) return 0;

  const now = new Date().toISOString();
  const { data: atual } = await supabase
    .from("perfil_vivo_familia")
    .select("composicao, rotina, recursos, dinamica")
    .eq("family_account_id", familyId)
    .maybeSingle();
  const secoes: Record<string, Record<string, unknown>> = {};
  for (const campo of FAMILIA_CAMPOS) {
    secoes[campo] = (atual?.[campo] as Record<string, unknown>) ?? {};
  }
  for (const it of familiaItens) {
    const prev = (secoes[it.campo].texto as string) ?? "";
    const novoTexto = it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
    secoes[it.campo] = { ...secoes[it.campo], texto: novoTexto, atualizado_em: now };
  }
  const { error } = await supabase
    .from("perfil_vivo_familia")
    .upsert({ family_account_id: familyId, ...secoes });
  if (error) throw new Error(`Falha ao salvar no Kolo Vivo da família: ${error.message}`);
  return familiaItens.length;
}
