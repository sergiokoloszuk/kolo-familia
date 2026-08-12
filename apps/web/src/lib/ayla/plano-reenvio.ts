import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * REENVIAR O PLANO QUE JÁ EXISTE — sem gerar outro.
 *
 * ⚠️ POR QUE (PEND-050). Até 11/08/2026 "manda o plano de novo" GERAVA UM PLANO
 * NOVO: `pedeUmPlano` devolvia true, `querPlano` ligava, e a ponte produzia
 * outro artefato. O reenvio nunca existiu — era mascarado por uma duplicação.
 * O portão de autoridade (5490c24) parou a duplicação; este módulo dá destino
 * ao ato, para que "não gerar" deixe de significar silêncio.
 *
 * ⚠️ ESTE MÓDULO NÃO GERA NADA, e essa é a regra inteira: ele lê `planos`,
 * remonta a entrega a partir do que está salvo e manda de novo.
 */

export type PlanoSalvo = {
  id: string;
  titulo: string;
  tema: string | null;
  membro_atipico_id: string | null;
  secoes: Array<{ tipo: string; titulo: string; conteudo_markdown: string }>;
  created_at: string;
};

/** O que a busca concluiu — e por quê, para o log e para o teste. */
export type AlvoDoReenvio =
  | { tipo: "achou"; plano: PlanoSalvo; via: "ancora" | "membro" | "familia" }
  | { tipo: "ambiguo"; candidatos: PlanoSalvo[] }
  | { tipo: "nenhum" };

/** Quanto tempo atrás uma âncora de conversa ainda conta como "aquele plano". */
const JANELA_ANCORA_HORAS = 48;

function normalizar(linhas: unknown): PlanoSalvo[] {
  return ((linhas ?? []) as Array<Record<string, unknown>>).map((l) => ({
    id: String(l.id),
    titulo: String(l.titulo ?? "Plano"),
    tema: (l.tema as string | null) ?? null,
    membro_atipico_id: (l.membro_atipico_id as string | null) ?? null,
    secoes: Array.isArray(l.secoes)
      ? (l.secoes as PlanoSalvo["secoes"])
      : [],
    created_at: String(l.created_at ?? ""),
  }));
}

/**
 * QUAL PLANO A MÃE QUER DE VOLTA.
 *
 * A ordem não é estilo: é confiança decrescente, e cada degrau só existe porque
 * o anterior não respondeu.
 *
 *   1. ÂNCORA — `metadata.plano_id` da entrega mais recente desta conversa
 *      (fatia 1). É o único degrau que sabe de QUAL plano se está falando, e
 *      não apenas qual é o mais novo.
 *   2. MEMBRO — o plano mais recente daquela criança. Vale quando a mãe nomeia
 *      o filho ("manda o plano do Mário") ou quando a família só tem um.
 *   3. FAMÍLIA — o plano mais recente, e SÓ quando a família tem uma criança.
 *
 * ⚠️ NÃO EXISTE "último plano da família" como regra geral. Numa família com
 * dois filhos, o mais recente pertence a um deles — devolver esse é entregar o
 * artefato do irmão errado, que é a falha que a Kolo mais protege.
 */
export async function acharPlanoParaReenviar(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    /** A criança já resolvida pelo turno, quando houver. */
    membroAtipicoId: string | null;
    /** Quantas crianças ativas a família tem — decide se o degrau 3 existe. */
    totalDeCriancas: number;
    agora?: Date;
  },
): Promise<AlvoDoReenvio> {
  const agora = params.agora ?? new Date();

  // ── 1 · A ÂNCORA ───────────────────────────────────────────────────────
  const desde = new Date(agora.getTime() - JANELA_ANCORA_HORAS * 3600_000).toISOString();
  const { data: msgs } = await supabase
    .from("ayla_messages")
    .select("metadata, created_at, membro_atipico_id")
    .eq("family_account_id", params.familyId)
    .eq("direcao", "outbound")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(30);

  const ancorados = ((msgs ?? []) as Array<Record<string, unknown>>)
    .map((m) => {
      const meta = (m.metadata ?? null) as { plano_id?: unknown } | null;
      const id = typeof meta?.plano_id === "string" ? meta.plano_id : null;
      return id ? { id, membro: (m.membro_atipico_id as string | null) ?? null } : null;
    })
    .filter((x): x is { id: string; membro: string | null } => x !== null);

  // A criança do turno manda: uma âncora do irmão não serve, mesmo sendo a
  // mais recente. Sem criança resolvida, a mais recente vale.
  const ancora = params.membroAtipicoId
    ? ancorados.find((a) => a.membro === params.membroAtipicoId)
    : ancorados[0];

  if (ancora) {
    const { data } = await supabase
      .from("planos")
      .select("id, titulo, tema, membro_atipico_id, secoes, created_at")
      .eq("family_account_id", params.familyId)
      .eq("id", ancora.id)
      .limit(1);
    const p = normalizar(data)[0];
    // A âncora pode apontar para um plano apagado — aí ela não vale nada e o
    // fluxo desce um degrau, em vez de devolver "não achei".
    if (p) return { tipo: "achou", plano: p, via: "ancora" };
  }

  // ── 2 · A CRIANÇA DO TURNO ─────────────────────────────────────────────
  if (params.membroAtipicoId) {
    const { data } = await supabase
      .from("planos")
      .select("id, titulo, tema, membro_atipico_id, secoes, created_at")
      .eq("family_account_id", params.familyId)
      .eq("membro_atipico_id", params.membroAtipicoId)
      .order("created_at", { ascending: false })
      .limit(2);
    const ps = normalizar(data);
    if (ps.length === 1) return { tipo: "achou", plano: ps[0], via: "membro" };
    if (ps.length > 1) return { tipo: "ambiguo", candidatos: ps };
    return { tipo: "nenhum" };
  }

  // ── 3 · A FAMÍLIA, E SÓ COM UMA CRIANÇA ────────────────────────────────
  if (params.totalDeCriancas > 1) return { tipo: "nenhum" };

  const { data } = await supabase
    .from("planos")
    .select("id, titulo, tema, membro_atipico_id, secoes, created_at")
    .eq("family_account_id", params.familyId)
    .order("created_at", { ascending: false })
    .limit(2);
  const ps = normalizar(data);
  if (ps.length === 1) return { tipo: "achou", plano: ps[0], via: "familia" };
  if (ps.length > 1) return { tipo: "ambiguo", candidatos: ps };
  return { tipo: "nenhum" };
}

/** A pergunta que se faz quando dois planos disputam o pedido. */
export function perguntaDeDesempate(candidatos: PlanoSalvo[]): string {
  const temas = candidatos
    .slice(0, 2)
    .map((p) => (p.tema?.trim() || p.titulo).trim())
    .filter(Boolean);
  if (temas.length < 2) return "Qual plano você quer que eu mande de novo? 🌿";
  return `Tenho dois aqui: um sobre *${temas[0]}* e outro sobre *${temas[1]}*. Qual deles você quer que eu mande de novo? 🌿`;
}
