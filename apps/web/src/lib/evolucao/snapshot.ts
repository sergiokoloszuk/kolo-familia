import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { AREAS_DIARIO } from "@/lib/ia/classificar-area";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Snapshot mensal da Evolução — a "foto" de como a pessoa esteve no mês, por
 * área. Contagens por REGRA (dos diários já etiquetados); frases por IA leve
 * (1 chamada/mês, graceful). Idempotente: 1 por (membro, mês); não reescreve
 * uma foto do passado a menos que `sobrescrever`.
 */

export type AreaSnapshot = {
  conquistas: number;
  desafios: number;
  resumo: string | null;
};

export type SnapshotResultado =
  | { status: "gerado" | "atualizado"; periodo: string }
  | { status: "existe" | "vazio"; periodo: string };

const HUMOR_LABEL: Record<string, string> = {
  muito_bem: "muito bem",
  bem: "bem",
  neutro: "neutro",
  dificil: "difícil",
  muito_dificil: "muito difícil",
};

/** 'YYYY-MM-01' → 1º dia do mês seguinte (exclusivo). */
export function proximoMes(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** Normaliza qualquer data 'YYYY-MM-..' pro 1º dia do mês. */
export function inicioDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

export async function gerarSnapshotMensal(
  admin: SupabaseClient,
  params: {
    membroId: string;
    familyId: string | null;
    periodo: string; // 'YYYY-MM-01'
    geradoPor?: "cron" | "backfill" | "manual";
    sobrescrever?: boolean;
  },
): Promise<SnapshotResultado> {
  const { membroId, periodo } = params;
  const geradoPor = params.geradoPor ?? "manual";
  const fim = proximoMes(periodo);

  // Já existe foto deste mês?
  const { data: existente } = await admin
    .from("evolucao_snapshots")
    .select("id")
    .eq("membro_atipico_id", membroId)
    .eq("periodo", periodo)
    .eq("periodo_tipo", "mensal")
    .maybeSingle();
  if (existente && !params.sobrescrever) return { status: "existe", periodo };

  // ── Atividade do mês (diários já etiquetados por área) ──
  const { data: diarios } = await admin
    .from("diarios")
    .select("conquista, desafio, conquista_area, desafio_area")
    .eq("membro_atipico_id", membroId)
    .gte("data", periodo)
    .lt("data", fim);

  const areas: Record<string, { conquistas: string[]; desafios: string[] }> = {};
  const ensure = (k: string) => (areas[k] ??= { conquistas: [], desafios: [] });
  for (const d of diarios ?? []) {
    const ca = d.conquista_area as string | null;
    const da = d.desafio_area as string | null;
    if (d.conquista && (d.conquista as string).trim() && ca && AREAS_DIARIO[ca]) {
      ensure(ca).conquistas.push((d.conquista as string).trim());
    }
    if (d.desafio && (d.desafio as string).trim() && da && AREAS_DIARIO[da]) {
      ensure(da).desafios.push((d.desafio as string).trim());
    }
  }

  // ── Humor predominante (check-in do dia, por membro) ──
  const { data: checkins } = await admin
    .from("check_ins_diarios")
    .select("escala_emocional_mae")
    .eq("membro_atipico_id", membroId)
    .gte("data", periodo)
    .lt("data", fim);
  const humorContagem: Record<string, number> = {};
  for (const c of checkins ?? []) {
    const e = c.escala_emocional_mae as string | null;
    if (e) humorContagem[e] = (humorContagem[e] ?? 0) + 1;
  }
  const humorTop = Object.entries(humorContagem).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const totalAtividade = Object.values(areas).reduce(
    (s, a) => s + a.conquistas.length + a.desafios.length,
    0,
  );
  // Mês sem nenhum sinal → não cria foto (não polui a régua).
  if (totalAtividade === 0 && (checkins ?? []).length === 0) {
    return { status: "vazio", periodo };
  }

  // ── Sinais extras (aproximados pra fotos do passado) ──
  const { data: perfil } = await admin
    .from("perfil_vivo_membro")
    .select("completude_pct")
    .eq("membro_atipico_id", membroId)
    .maybeSingle();
  const { count: padroesCount } = await admin
    .from("ayla_padroes")
    .select("id", { count: "exact", head: true })
    .eq("membro_atipico_id", membroId)
    .neq("estado", "descartado")
    .gte("ultima_evidencia", periodo)
    .lt("ultima_evidencia", fim);

  // ── Frases (IA leve, graceful) ──
  const frases = await sintetizar(admin, params.familyId, periodo, areas, humorTop);

  const areasJson: Record<string, AreaSnapshot> = {};
  for (const [k, v] of Object.entries(areas)) {
    areasJson[k] = {
      conquistas: v.conquistas.length,
      desafios: v.desafios.length,
      resumo: frases.areas[k] ?? null,
    };
  }

  const payload = {
    family_account_id: params.familyId,
    membro_atipico_id: membroId,
    periodo,
    periodo_tipo: "mensal",
    resumo: frases.resumo,
    areas: areasJson,
    sinais: {
      humor: humorTop,
      humor_label: humorTop ? HUMOR_LABEL[humorTop] ?? humorTop : null,
      perfil_pct: perfil?.completude_pct != null ? Math.round(Number(perfil.completude_pct)) : null,
      padroes: padroesCount ?? 0,
    },
    gerado_por: geradoPor,
    gerado_em: new Date().toISOString(),
  };

  if (existente) {
    await admin.from("evolucao_snapshots").update(payload).eq("id", existente.id);
    return { status: "atualizado", periodo };
  }
  await admin.from("evolucao_snapshots").insert(payload);
  return { status: "gerado", periodo };
}

/** Frase do mês + frase por área via IA leve. Sem chave/erro → tudo null. */
async function sintetizar(
  admin: SupabaseClient,
  familyId: string | null,
  periodo: string,
  areas: Record<string, { conquistas: string[]; desafios: string[] }>,
  humorTop: string | null,
): Promise<{ resumo: string | null; areas: Record<string, string> }> {
  const vazio = { resumo: null as string | null, areas: {} as Record<string, string> };
  const chaves = Object.keys(areas);
  if (chaves.length === 0) return vazio;

  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return vazio;
  }

  // Monta o material por área (limita pra não inflar o prompt).
  const bloco = chaves
    .map((k) => {
      const a = areas[k];
      const c = a.conquistas.slice(0, 5).map((t) => `  + ${t}`).join("\n");
      const d = a.desafios.slice(0, 5).map((t) => `  - ${t}`).join("\n");
      return `[${k}] ${AREAS_DIARIO[k] ?? k}\n${c}${c && d ? "\n" : ""}${d}`;
    })
    .join("\n");

  const system = `Você resume o MÊS de uma pessoa neurodivergente, por área, a partir de conquistas (+) e desafios (-) já registrados. Escreva como OBSERVAÇÃO humana, calorosa e curta. NÃO invente nada além do que está nos itens. Sem emoji.

Responda APENAS um JSON, sem nada antes/depois:
{"resumo":"1-2 frases sobre o mês como um todo","areas":{"<chave_area>":"1 frase curta sobre a área"}}
Use só as CHAVES de área que aparecem no material.`;

  const user = `Humor predominante do mês: ${humorTop ? HUMOR_LABEL[humorTop] ?? humorTop : "não informado"}.\n\nMaterial por área:\n${bloco}`;

  try {
    const stream = client.messages.stream({
      model: MODELS.leve,
      max_tokens: 700,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const final = await stream.finalMessage();
    const raw = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    void logarUsoApi(admin, {
      family_account_id: familyId,
      provider: "anthropic",
      model: MODELS.leve,
      feature: "evolucao_snapshot_mensal",
      input_tokens: final.usage.input_tokens,
      output_tokens: final.usage.output_tokens,
    });
    const parsed = parseJson(raw);
    if (!parsed) return vazio;
    const resumo = typeof parsed.resumo === "string" && parsed.resumo.trim() ? parsed.resumo.trim() : null;
    const areasOut: Record<string, string> = {};
    const pa = parsed.areas;
    if (pa && typeof pa === "object") {
      for (const [k, v] of Object.entries(pa as Record<string, unknown>)) {
        if (k in areas && typeof v === "string" && v.trim()) areasOut[k] = v.trim();
      }
    }
    return { resumo, areas: areasOut };
  } catch {
    return vazio;
  }
}

function parseJson(s: string): Record<string, unknown> | null {
  const t = s.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
