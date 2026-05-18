/**
 * Motor determinístico de avaliação de padrões.
 *
 * Lê `ayla_eventos_longitudinais` e produz/atualiza linhas em `ayla_padroes`.
 * Sem LLM nesta fase — apenas heurísticas estatísticas + linguagem observacional
 * de `pattern-language.ts`.
 *
 * Princípio Karina (18/05/2026):
 *
 *   "as hipóteses NÃO devem parecer diagnóstico.
 *    Quero linguagem observacional."
 *
 * Cada heurística produz um candidato com:
 *   - padrao_key (slug determinístico — permite upsert sem duplicar)
 *   - descricao (gerada por pattern-language, validada de tom)
 *   - confianca (0..1, baseado em quantidade + magnitude de evidências)
 *   - sinais_correlacionados (lista descritiva — "não quero caixa preta")
 *   - motivo_hipotese (qual heurística)
 *   - janela_analisada
 *   - evidencias_evento_ids
 *
 * IMPORTANTE: NÃO ativa comportamento ativo na v1. Apenas popula
 * `ayla_padroes` em estado 'hipotese' pra revisão da Karina.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Confianca, DominioKolo, MembroAtipicoId } from "./types";
import type { TipoEvento } from "./memory";
import {
  TEMPLATES,
  TIPO_EVENTO_LABEL,
  DOMINIO_LABEL,
  JANELA_LABEL,
  descricaoSegura,
  type TipoHeuristica,
  type TemplateObservacional,
} from "./pattern-language";

// ============================================================
// Tipos auxiliares
// ============================================================

interface EventoLido {
  id: string;
  family_account_id: string;
  membro_atipico_id: string | null;
  tipo: TipoEvento;
  dominios: DominioKolo[];
  intensidade: string | null;
  ocorreu_em: string;
}

export type JanelaAnalise = "30d" | "90d" | "6m" | "todo_periodo";

export interface CandidatoPadrao {
  padrao_key: string;
  descricao: string;
  confianca: Confianca;
  sinais_correlacionados: string[];
  motivo_hipotese: TipoHeuristica;
  janela_analisada: JanelaAnalise;
  evidencias_evento_ids: string[];
  primeira_evidencia: string;
  ultima_evidencia: string;
}

export interface ResultadoAvaliacao {
  membro_atipico_id: string;
  total_eventos_analisados: number;
  candidatos: CandidatoPadrao[];
  hipoteses_criadas: number;
  hipoteses_atualizadas: number;
  descartadas_por_tom: number;
  janelas_processadas: JanelaAnalise[];
}

// ============================================================
// Limites de detecção (Karina pode ajustar)
// ============================================================

const LIMITES = {
  recorrencia: {
    /** Mínimo de eventos do mesmo (tipo, dominio) pra virar hipótese. */
    min_evidencias: 3,
    /** Confiança = min(1, evidencias/saturacao). */
    saturacao: 8,
  },
  co_ocorrencia: {
    /** Mínimo de dias com eventos de ambos domínios. */
    min_dias_co_ocorrencia: 3,
    /** Janela de tempo pra considerar "junto" (mesmo dia, ±0). */
    janela_horas: 24,
    saturacao: 10,
  },
};

/** Janela em milissegundos. */
function janelaInicio(janela: JanelaAnalise, agora: Date = new Date()): Date {
  const ini = new Date(agora);
  switch (janela) {
    case "30d":
      ini.setDate(ini.getDate() - 30);
      break;
    case "90d":
      ini.setDate(ini.getDate() - 90);
      break;
    case "6m":
      ini.setMonth(ini.getMonth() - 6);
      break;
    case "todo_periodo":
      ini.setFullYear(2000, 0, 1);
      break;
  }
  return ini;
}

// ============================================================
// Heurística 1: Recorrência (tipo × dominio em janela)
// ============================================================

function detectarRecorrencia(
  eventos: EventoLido[],
  janela: JanelaAnalise,
): CandidatoPadrao[] {
  // Agrupa por (tipo, dominio)
  const grupos = new Map<string, EventoLido[]>();
  for (const e of eventos) {
    if (e.dominios.length === 0) continue; // sem domínio = sem agrupamento
    for (const dom of e.dominios) {
      const chave = `${e.tipo}__${dom}`;
      const lista = grupos.get(chave) ?? [];
      lista.push(e);
      grupos.set(chave, lista);
    }
  }

  const candidatos: CandidatoPadrao[] = [];
  for (const [chave, lista] of grupos.entries()) {
    if (lista.length < LIMITES.recorrencia.min_evidencias) continue;

    const [tipo, dominio] = chave.split("__") as [TipoEvento, DominioKolo];
    const tipoHumano = TIPO_EVENTO_LABEL[tipo] ?? tipo;
    const dominioHumano = DOMINIO_LABEL[dominio] ?? dominio;
    const janelaHumana = JANELA_LABEL[janela] ?? janela;

    const template = TEMPLATES.find(
      (t) => t.heuristica === "recorrencia_temporal",
    ) as TemplateObservacional;
    const desc = descricaoSegura(template, {
      tipo_evento_humano: tipoHumano,
      dominio_humano: dominioHumano,
      janela_humana: janelaHumana,
      contagem: lista.length,
    });
    if (!desc) continue; // tom rejeitou — pula

    const sortedByDate = lista
      .slice()
      .sort((a, b) => a.ocorreu_em.localeCompare(b.ocorreu_em));

    candidatos.push({
      padrao_key: `recorrencia:${tipo}:${dominio}:${janela}`,
      descricao: desc,
      confianca: Math.min(1, lista.length / LIMITES.recorrencia.saturacao),
      sinais_correlacionados: [
        `${lista.length} ocorrências em ${janelaHumana}`,
        `mesmo tipo: ${tipoHumano}`,
        `mesmo domínio: ${dominioHumano}`,
      ],
      motivo_hipotese: "recorrencia_temporal",
      janela_analisada: janela,
      evidencias_evento_ids: lista.map((e) => e.id),
      primeira_evidencia: sortedByDate[0].ocorreu_em,
      ultima_evidencia: sortedByDate[sortedByDate.length - 1].ocorreu_em,
    });
  }

  return candidatos;
}

// ============================================================
// Heurística 2: Co-ocorrência de domínios em janela curta
// ============================================================

function detectarCoOcorrencia(
  eventos: EventoLido[],
  janela: JanelaAnalise,
): CandidatoPadrao[] {
  // Conta dias em que dois domínios apareceram juntos (mesmo dia calendário)
  const eventosPorDia = new Map<string, Set<DominioKolo>>();
  const eventosPorChave = new Map<string, EventoLido[]>(); // pra rastrear evidências

  for (const e of eventos) {
    const dia = e.ocorreu_em.slice(0, 10); // YYYY-MM-DD
    const set = eventosPorDia.get(dia) ?? new Set<DominioKolo>();
    for (const dom of e.dominios) set.add(dom);
    eventosPorDia.set(dia, set);

    for (const dom of e.dominios) {
      const chave = `${dia}__${dom}`;
      const lista = eventosPorChave.get(chave) ?? [];
      lista.push(e);
      eventosPorChave.set(chave, lista);
    }
  }

  // Conta pares co-ocorrentes
  const pares = new Map<string, { count: number; eventoIds: Set<string> }>();
  for (const [dia, dominios] of eventosPorDia.entries()) {
    const arr = Array.from(dominios).sort();
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const chave = `${arr[i]}__${arr[j]}`;
        const entry = pares.get(chave) ?? { count: 0, eventoIds: new Set() };
        entry.count++;
        for (const ev of eventosPorChave.get(`${dia}__${arr[i]}`) ?? []) {
          entry.eventoIds.add(ev.id);
        }
        for (const ev of eventosPorChave.get(`${dia}__${arr[j]}`) ?? []) {
          entry.eventoIds.add(ev.id);
        }
        pares.set(chave, entry);
      }
    }
  }

  const candidatos: CandidatoPadrao[] = [];
  for (const [chave, { count, eventoIds }] of pares.entries()) {
    if (count < LIMITES.co_ocorrencia.min_dias_co_ocorrencia) continue;
    const [domA, domB] = chave.split("__") as [DominioKolo, DominioKolo];

    const template = TEMPLATES.find(
      (t) => t.heuristica === "co_ocorrencia_dominios",
    ) as TemplateObservacional;
    const desc = descricaoSegura(template, {
      dominio_a_humano: DOMINIO_LABEL[domA] ?? domA,
      dominio_b_humano: DOMINIO_LABEL[domB] ?? domB,
    });
    if (!desc) continue;

    const ids = Array.from(eventoIds);
    const eventosOrdenados = eventos
      .filter((e) => eventoIds.has(e.id))
      .sort((a, b) => a.ocorreu_em.localeCompare(b.ocorreu_em));

    candidatos.push({
      padrao_key: `co_ocorrencia:${domA}:${domB}:${janela}`,
      descricao: desc,
      confianca: Math.min(1, count / LIMITES.co_ocorrencia.saturacao),
      sinais_correlacionados: [
        `${count} dias com ambos domínios ativos`,
        `domínio A: ${DOMINIO_LABEL[domA] ?? domA}`,
        `domínio B: ${DOMINIO_LABEL[domB] ?? domB}`,
      ],
      motivo_hipotese: "co_ocorrencia_dominios",
      janela_analisada: janela,
      evidencias_evento_ids: ids,
      primeira_evidencia: eventosOrdenados[0]?.ocorreu_em ?? "",
      ultima_evidencia:
        eventosOrdenados[eventosOrdenados.length - 1]?.ocorreu_em ?? "",
    });
  }

  return candidatos;
}

// ============================================================
// API pública: avalia padrões pra um membro
// ============================================================

export async function avaliarPadroesReal(
  supabase: SupabaseClient,
  membroId: MembroAtipicoId,
  janelasParaAnalisar: JanelaAnalise[] = ["30d", "90d"],
  agora: Date = new Date(),
): Promise<ResultadoAvaliacao> {
  const resultado: ResultadoAvaliacao = {
    membro_atipico_id: String(membroId),
    total_eventos_analisados: 0,
    candidatos: [],
    hipoteses_criadas: 0,
    hipoteses_atualizadas: 0,
    descartadas_por_tom: 0,
    janelas_processadas: janelasParaAnalisar,
  };

  // Lê o family_account_id do membro
  const { data: membro } = await supabase
    .from("membros_atipicos")
    .select("family_account_id")
    .eq("id", String(membroId))
    .maybeSingle();
  if (!membro) return resultado;

  const familyId = (membro as { family_account_id: string }).family_account_id;

  // Pra cada janela, busca eventos e roda heurísticas
  for (const janela of janelasParaAnalisar) {
    const ini = janelaInicio(janela, agora);

    const { data: eventos, error } = await supabase
      .from("ayla_eventos_longitudinais")
      .select(
        "id, family_account_id, membro_atipico_id, tipo, dominios, intensidade, ocorreu_em",
      )
      .eq("membro_atipico_id", String(membroId))
      .gte("ocorreu_em", ini.toISOString())
      .order("ocorreu_em", { ascending: true });

    if (error || !eventos) continue;
    resultado.total_eventos_analisados += eventos.length;
    if (eventos.length < LIMITES.recorrencia.min_evidencias) continue;

    const evs = eventos as EventoLido[];

    // Heurísticas
    const candidatosJanela = [
      ...detectarRecorrencia(evs, janela),
      ...detectarCoOcorrencia(evs, janela),
    ];

    resultado.candidatos.push(...candidatosJanela);

    // Upsert no ayla_padroes
    for (const c of candidatosJanela) {
      const { data: existente } = await supabase
        .from("ayla_padroes")
        .select("id, evidencias_count, estado")
        .eq("membro_atipico_id", String(membroId))
        .eq("padrao_key", c.padrao_key)
        .maybeSingle();

      if (existente) {
        // Atualiza: nova confianca, evidências, sinais — preserva estado/revisão
        const ex = existente as {
          id: string;
          evidencias_count: number;
          estado: string;
        };
        await supabase
          .from("ayla_padroes")
          .update({
            descricao: c.descricao,
            evidencias_count: c.evidencias_evento_ids.length,
            confianca: c.confianca,
            ultima_evidencia: c.ultima_evidencia,
            evidencias_evento_ids: c.evidencias_evento_ids,
            motivo_hipotese: c.motivo_hipotese,
            sinais_correlacionados: c.sinais_correlacionados,
            janela_analisada: c.janela_analisada,
            // Promove pra 'observado' quando atinge ≥6 evidências e ainda é hipotese
            estado:
              ex.estado === "hipotese" && c.evidencias_evento_ids.length >= 6
                ? "observado"
                : ex.estado,
          })
          .eq("id", ex.id);
        resultado.hipoteses_atualizadas++;
      } else {
        await supabase.from("ayla_padroes").insert({
          family_account_id: familyId,
          membro_atipico_id: String(membroId),
          padrao_key: c.padrao_key,
          descricao: c.descricao,
          evidencias_count: c.evidencias_evento_ids.length,
          confianca: c.confianca,
          estado: "hipotese",
          primeira_evidencia: c.primeira_evidencia,
          ultima_evidencia: c.ultima_evidencia,
          evidencias_evento_ids: c.evidencias_evento_ids,
          motivo_hipotese: c.motivo_hipotese,
          sinais_correlacionados: c.sinais_correlacionados,
          janela_analisada: c.janela_analisada,
        });
        resultado.hipoteses_criadas++;
      }
    }
  }

  return resultado;
}
