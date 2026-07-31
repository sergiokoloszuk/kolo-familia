import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "@/lib/log";

/**
 * REVISÃO DA MEMÓRIA VIVA — a fila e as quatro decisões.
 *
 * **Não existe entidade de alerta.** O caso é o próprio fato: `perfil_fatos`
 * com `status = 'quarentena'`. Um alerta seria um espelho do estado que já
 * existe, e espelho dessincroniza.
 *
 * DOIS CAMPOS, DOIS SIGNIFICADOS — é o que permite quatro decisões sem
 * migração nenhuma:
 *
 *   `quarentena_resolvido_em`  — alguém OLHOU. Sai da fila diária.
 *   `quarentena_resolucao`     — alguém DECIDIU. `null` = olhou e não decidiu.
 *
 * Então "em dúvida" é `resolvido_em` preenchido com `resolucao` nula: sai do
 * dia a dia, continua rastreável, e volta no resumo semanal. Sem isso seria
 * preciso um valor novo no CHECK — ou seja, uma migração — para representar
 * "revisado sem decisão".
 */

/** As quatro decisões da tela. */
export type Decisao = "aprovar" | "pessoa_errada" | "descartar" | "em_duvida";

export type CasoRevisao = {
  id: string;
  familyId: string;
  membroId: string | null;
  membroNome: string | null;
  canal: string | null;
  criadoEm: string;
  observadoEm: string;
  tempoOriginal: string | null;
  afirmacao: string;
  conceito: string;
  dominio: string;
  motivo: string | null;
  sujeito: string | null;
  sourceContentId: string | null;
  extractionRunId: string | null;
  verificationStatus: string;
  dominiosSensiveis: string[];
};

/**
 * As colunas do card. Constante e nao literal inline: o tipo do supabase-js
 * analisa a string de colunas em tempo de compilacao, entao a leitura vira
 * `GenericStringError` — daí o cast em `comNomes`. O ganho de nao repetir a
 * lista em tres consultas compensa.
 */
const SELECT_CASO =
  "id, family_account_id, membro_atipico_id, source_channel, created_at, observado_em, " +
  "tempo_original, afirmacao, conceito, dominio, quarentena_motivo, sujeito_classificado, " +
  "source_content_id, extraction_run_id, verification_status, dominios_sensiveis";

type Linha = Record<string, unknown>;

function paraCaso(l: Linha, nomes: Map<string, string>): CasoRevisao {
  const membroId = (l.membro_atipico_id as string | null) ?? null;
  return {
    id: l.id as string,
    familyId: l.family_account_id as string,
    membroId,
    membroNome: membroId ? (nomes.get(membroId) ?? null) : null,
    canal: (l.source_channel as string | null) ?? null,
    criadoEm: l.created_at as string,
    observadoEm: String(l.observado_em),
    tempoOriginal: (l.tempo_original as string | null) ?? null,
    afirmacao: l.afirmacao as string,
    conceito: l.conceito as string,
    dominio: l.dominio as string,
    motivo: (l.quarentena_motivo as string | null) ?? null,
    sujeito: (l.sujeito_classificado as string | null) ?? null,
    sourceContentId: (l.source_content_id as string | null) ?? null,
    extractionRunId: (l.extraction_run_id as string | null) ?? null,
    verificationStatus: l.verification_status as string,
    dominiosSensiveis: (l.dominios_sensiveis as string[] | null) ?? [],
  };
}

async function comNomes(
  supabase: SupabaseClient,
  linhas: Linha[],
): Promise<CasoRevisao[]> {
  const ids = [...new Set(linhas.map((l) => l.membro_atipico_id).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("membros_atipicos").select("id, nome").in("id", ids);
    for (const m of data ?? []) nomes.set(m.id as string, (m.nome as string) ?? "");
  }
  return linhas.map((l) => paraCaso(l, nomes));
}

/**
 * A FILA DIÁRIA: quarentena que ninguém olhou ainda.
 *
 * Filtra por `quarentena_resolvido_em`, não por `quarentena_resolucao` — senão
 * o que foi marcado "em dúvida" voltaria todo dia, e uma fila que repete o
 * mesmo caso é uma fila que a pessoa para de abrir.
 */
export async function filaDeRevisao(supabase: SupabaseClient): Promise<CasoRevisao[]> {
  const { data } = await supabase
    .from("perfil_fatos")
    .select(SELECT_CASO)
    .eq("status", "quarentena")
    .is("quarentena_resolvido_em", null)
    .order("created_at", { ascending: true })
    .limit(50);
  return comNomes(supabase, (data ?? []) as unknown as Linha[]);
}

/** Os "em dúvida": olhados, sem decisão. Só aparecem no resumo semanal. */
export async function casosEmDuvida(supabase: SupabaseClient): Promise<CasoRevisao[]> {
  const { data } = await supabase
    .from("perfil_fatos")
    .select(SELECT_CASO)
    .eq("status", "quarentena")
    .is("quarentena_resolucao", null)
    .not("quarentena_resolvido_em", "is", null)
    .order("created_at", { ascending: true })
    .limit(50);
  return comNomes(supabase, (data ?? []) as unknown as Linha[]);
}

export async function contarFila(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("perfil_fatos")
    .select("id", { count: "exact", head: true })
    .eq("status", "quarentena")
    .is("quarentena_resolvido_em", null);
  return count ?? 0;
}

// ============================================================
// As quatro decisões
// ============================================================

/**
 * O que cada botão faz com o fato.
 *
 * `pessoa_errada` e `descartar` produzem o MESMO estado — invalidado — e mudam
 * só o motivo. A distinção existe porque erro de pessoa é a métrica que decide
 * se a coleta continua; misturar os dois esconderia justamente o número que
 * importa.
 *
 * Nenhuma decisão altera `membro_atipico_id`. Reatribuir reescreveria história:
 * o correto é invalidar e criar um fato novo com `invalidates_fact_id`, e esse
 * serviço não existe. Ver docs/memoria/amostra-controlada.md §13.
 */
const EFEITO: Record<Decisao, { status: string; resolucao: string | null; motivo: string }> = {
  aprovar: { status: "ativo", resolucao: "liberado", motivo: "aprovado_na_revisao" },
  pessoa_errada: { status: "invalidado", resolucao: "descartado", motivo: "pessoa_errada" },
  descartar: { status: "invalidado", resolucao: "descartado", motivo: "descartado" },
  // Continua em quarentena e sem decisão — só marca que foi olhado.
  em_duvida: { status: "quarentena", resolucao: null, motivo: "em_duvida" },
};

export type ResultadoDecisao =
  | { ok: true; jaResolvido: false }
  /** Idempotência: alguém já decidiu (ou clicou duas vezes). Não é erro. */
  | { ok: true; jaResolvido: true }
  | { ok: false; erro: string };

/**
 * Aplica a decisão. **Idempotente**: o `where` exige que o caso ainda esteja
 * pendente, então o segundo clique não altera nada e devolve `jaResolvido`.
 *
 * Nunca apaga. Fato errado se invalida — apagar destruiria a evidência de que o
 * erro existiu, que é o produto da amostra.
 */
export async function decidirCaso(
  supabase: SupabaseClient,
  params: { fatoId: string; decisao: Decisao; revisorId: string },
): Promise<ResultadoDecisao> {
  const efeito = EFEITO[params.decisao];
  if (!efeito) return { ok: false, erro: "decisao_invalida" };

  const { data: antes } = await supabase
    .from("perfil_fatos")
    .select("id, status, quarentena_resolvido_em, quarentena_resolucao, membro_atipico_id")
    .eq("id", params.fatoId)
    .maybeSingle();

  if (!antes) return { ok: false, erro: "caso_nao_encontrado" };
  if (antes.quarentena_resolvido_em) return { ok: true, jaResolvido: true };

  const { data, error } = await supabase
    .from("perfil_fatos")
    .update({
      status: efeito.status,
      quarentena_resolucao: efeito.resolucao,
      quarentena_resolvido_em: new Date().toISOString(),
      quarentena_resolvido_por: params.revisorId,
      relacao_motivo: efeito.motivo,
      relacao_origem: "revisao_humana",
      relacao_em: new Date().toISOString(),
    })
    // A trava de idempotência: só atualiza o que ainda não foi olhado.
    .eq("id", params.fatoId)
    .is("quarentena_resolvido_em", null)
    .select("id");

  if (error) return { ok: false, erro: error.message };
  if (!data || data.length === 0) return { ok: true, jaResolvido: true };

  await logEvent({
    kind: "memoria_revisao_decidida",
    severity: params.decisao === "pessoa_errada" ? "warn" : "info",
    family_account_id: (antes as Linha).family_account_id as string | undefined,
    payload: {
      fato_id: params.fatoId,
      decisao: params.decisao,
      // Estado anterior e posterior, para auditoria. Sem a afirmação.
      antes: { status: antes.status, resolucao: antes.quarentena_resolucao },
      depois: { status: efeito.status, resolucao: efeito.resolucao },
      revisor: params.revisorId,
      membro_alterado: false,
    },
  }).catch(() => {});

  return { ok: true, jaResolvido: false };
}

// ============================================================
// Números do resumo
// ============================================================

export type ResumoSemana = {
  total: number;
  ativos: number;
  quarentena: number;
  aprovados: number;
  descartados: number;
  pessoaErrada: number;
  emDuvida: number;
  falhas: number;
};

export async function resumoDaSemana(supabase: SupabaseClient): Promise<ResumoSemana> {
  const contar = async (fn: (q: ReturnType<SupabaseClient["from"]>) => unknown) => {
    const q = supabase.from("perfil_fatos").select("id", { count: "exact", head: true });
    const { count } = (await fn(q as never)) as { count: number | null };
    return count ?? 0;
  };

  const [total, ativos, quarentena, aprovados, descartados, pessoaErrada, emDuvida] =
    await Promise.all([
      contar((q) => q),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("status", "ativo")),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("status", "quarentena")),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("relacao_motivo", "aprovado_na_revisao")),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("relacao_motivo", "descartado")),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("relacao_motivo", "pessoa_errada")),
      contar((q) => (q as never as { eq: (a: string, b: string) => unknown }).eq("relacao_motivo", "em_duvida")),
    ]);

  let falhas = 0;
  try {
    const { count } = await supabase
      .from("eventos_app")
      .select("id", { count: "exact", head: true })
      .eq("kind", "perfil_fato_falhou")
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
    falhas = count ?? 0;
  } catch {
    /* sem eventos_app, segue com 0 */
  }

  return { total, ativos, quarentena, aprovados, descartados, pessoaErrada, emDuvida, falhas };
}

/** A recomendação do resumo. Regra simples e explícita. */
export function recomendacao(r: ResumoSemana): "continuar" | "atencao" | "pausar" {
  if (r.pessoaErrada > 0 || r.falhas > 0) return "pausar";
  const pct = r.ativos > 0 ? (r.quarentena / r.ativos) * 100 : 0;
  if (pct > 40) return "pausar";
  if (pct > 15 || r.emDuvida > 3) return "atencao";
  return "continuar";
}
