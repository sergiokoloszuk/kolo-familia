import type { SupabaseClient } from "@supabase/supabase-js";
import type { BiaNucleo } from "./tipos";
import { BIA_NUCLEO_PARA_DOMINIOS, BIA_NUCLEOS } from "./tipos";
import {
  selecionar,
  termos,
  type ChunkParaPontuar,
  type ContextoBia,
  type OpcoesSelecao,
  type ResultadoBia,
} from "./pontuacao";

/**
 * BIA RETRIEVER — o serviço de recuperação.
 *
 * ⚠️ NÃO É CHAMADO POR NINGUÉM AINDA. Nem o prompt, nem o decisor de entrega,
 * nem os planos, nem os PDFs. Esta etapa constrói e valida a camada de
 * recuperação isoladamente; a integração é uma decisão posterior.
 *
 * Divisão de responsabilidade (é o que torna a coisa testável):
 *   retriever.ts  → I/O. Traz CANDIDATOS do Postgres. Não julga nada.
 *   pontuacao.ts  → julgamento. Puro, sem rede, sem banco.
 *
 * Sem IA e sem embedding, por decisão desta etapa. A recuperação combina três
 * coisas, na ordem de confiança:
 *   1. filtro estruturado (idade, cautela, revisão) — em SQL, corta cedo
 *   2. dois conjuntos de candidatos que se SOMAM (ver `buscarCandidatos`)
 *   3. pontuação determinística + regras de prioridade (pontuacao.ts)
 */

/** Colunas que a pontuação precisa. Nada além — o texto já é grande. */
const SELECT_CHUNK =
  "id, nucleo, secao, titulo, tipo_conhecimento, faixa_etaria_min_meses, faixa_etaria_max_meses, faixa_rotulo, situacoes_relacionadas, diagnosticos_relacionados, nivel_de_cautela, muda_conduta, texto_original, revisao_pendente, ordem";

/** Teto de candidatos por consulta. Espelha CANDIDATAS_MAX das Boas Práticas. */
const CANDIDATOS_POR_CONSULTA = 120;

export type OpcoesBusca = OpcoesSelecao & {
  /** Quantos candidatos trazer de cada consulta antes de pontuar. */
  candidatosMax?: number;
};

/**
 * Núcleos que interessam ao domínio pedido. Vazio = sem restrição de núcleo
 * (a consulta estruturada não roda, e sobra só a textual).
 */
function nucleosDoDominio(dominio: string | null | undefined): BiaNucleo[] {
  const d = (dominio ?? "").trim().toLowerCase();
  if (!d) return [];
  return BIA_NUCLEOS.filter((n) =>
    (BIA_NUCLEO_PARA_DOMINIOS[n] as readonly string[]).includes(d),
  );
}

/**
 * A consulta de texto do Postgres, a partir do contexto.
 *
 * `websearch_to_tsquery` é o que aguenta texto livre de conversa sem explodir
 * em erro de sintaxe (o `to_tsquery` cru quebra com pontuação, e a mãe escreve
 * com pontuação). Limitamos a poucos termos porque a conversa inteira viraria
 * uma query que casa com quase tudo — e aí o full-text deixa de discriminar.
 */
export function montarConsultaTexto(ctx: ContextoBia): string | null {
  const bruto = [ctx.dificuldade, ctx.objetivo, ctx.textoDaConversa]
    .filter(Boolean)
    .join(" ");
  const lista = [...termos(bruto)].slice(0, 12);
  if (lista.length === 0) return null;
  return lista.join(" or ");
}

/**
 * Traz candidatos. DUAS consultas em paralelo, que se somam:
 *
 *   (a) ESTRUTURADA — tudo do(s) núcleo(s) do domínio em foco.
 *   (b) TEXTUAL — full-text sobre `texto_busca` (tsvector português da 0071).
 *
 * Por que somar em vez de intersectar: cada uma cobre um buraco da outra. A
 * estruturada garante candidatos mesmo quando a mãe escreve com palavras que
 * não estão em lugar nenhum do documento ("ele surta na hora do banho"); a
 * textual encontra conhecimento relevante de OUTRO núcleo (a criança que não
 * dorme pode estar num problema sensorial). Intersectar devolveria vazio com
 * frequência — que é o pior resultado para um retriever.
 *
 * O filtro duro de idade/revisão vai no SQL porque corta muito e cedo. O resto
 * do julgamento é do módulo puro.
 */
async function buscarCandidatos(
  supabase: SupabaseClient,
  ctx: ContextoBia,
  candidatosMax: number,
): Promise<ChunkParaPontuar[]> {
  const idadeMeses =
    ctx.idadeMeses != null
      ? ctx.idadeMeses
      : ctx.idadeAnos != null
        ? Math.round(ctx.idadeAnos * 12)
        : null;

  const base = () => {
    let q = supabase
      .from("bia_chunks")
      .select(SELECT_CHUNK)
      .eq("ativo", true)
      // Nunca recupera o que não passou por revisão. O módulo puro também
      // barra, mas barrar aqui evita trazer o texto pela rede à toa.
      .eq("revisao_pendente", false);

    // Faixa etária em SQL: faixa aberta (null) serve sempre.
    if (idadeMeses != null) {
      q = q
        .or(`faixa_etaria_min_meses.is.null,faixa_etaria_min_meses.lte.${idadeMeses}`)
        .or(`faixa_etaria_max_meses.is.null,faixa_etaria_max_meses.gte.${idadeMeses}`);
    }
    return q;
  };

  const nucleos = nucleosDoDominio(ctx.dominio);
  const consultaTexto = montarConsultaTexto(ctx);

  const promessas: Array<PromiseLike<{ data: unknown }>> = [];

  if (nucleos.length > 0) {
    promessas.push(base().in("nucleo", nucleos).limit(candidatosMax));
  }
  if (consultaTexto) {
    promessas.push(
      base()
        // `type: "websearch"` é OBRIGATÓRIO aqui. Sem ele o supabase-js usa
        // `to_tsquery`, que exige sintaxe de tsquery (`termo1 | termo2`) e
        // rejeita a palavra "or" com erro de sintaxe — a consulta inteira
        // falharia contra o Postgres real. `websearch_to_tsquery` é o único que
        // aceita texto de gente ("or", pontuação, aspas) sem quebrar.
        .textSearch("texto_busca", consultaTexto, {
          config: "portuguese",
          type: "websearch",
        })
        .limit(candidatosMax),
    );
  }
  // Sem domínio e sem texto não há o que recuperar — devolver "os primeiros N"
  // seria ruído com cara de resposta.
  if (promessas.length === 0) return [];

  const resultados = await Promise.all(promessas);

  const porId = new Map<string, ChunkParaPontuar>();
  for (const r of resultados) {
    for (const linha of ((r?.data ?? []) as ChunkParaPontuar[]) ?? []) {
      if (linha?.id) porId.set(linha.id, normalizarLinha(linha));
    }
  }
  return [...porId.values()];
}

/** Arrays nulos do Postgres viram []. A pontuação assume array sempre. */
function normalizarLinha(l: ChunkParaPontuar): ChunkParaPontuar {
  return {
    ...l,
    situacoes_relacionadas: l.situacoes_relacionadas ?? [],
    diagnosticos_relacionados: l.diagnosticos_relacionados ?? [],
    ordem: l.ordem ?? 0,
  };
}

/**
 * O ponto de entrada do retriever.
 *
 * Falha NUNCA propaga: devolve `[]`. Mesma decisão de
 * `selecionarBoasPraticas` — conhecimento de apoio é bônus; se ele quebrar, o
 * que chama tem que continuar funcionando. (Quando houver integração, isso
 * significa que a Ayla responde sem BIA, com o Core, exatamente como hoje.)
 */
export async function buscarConhecimentosBIA(
  supabase: SupabaseClient,
  ctx: ContextoBia,
  opcoes: OpcoesBusca = {},
): Promise<ResultadoBia[]> {
  try {
    const candidatos = await buscarCandidatos(
      supabase,
      ctx,
      opcoes.candidatosMax ?? CANDIDATOS_POR_CONSULTA,
    );
    if (candidatos.length === 0) return [];
    return selecionar(candidatos, ctx, opcoes);
  } catch (e) {
    console.warn("[bia:retriever] busca falhou:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Bloco de texto pronto para um prompt — NÃO USADO NESTA ETAPA.
 *
 * Existe aqui porque é o formato que a integração futura vai querer, e escrever
 * agora deixa explícito o que a BIA entregaria: raciocínio para a Ayla PENSAR,
 * com instrução de não copiar. Enquanto ninguém chamar, não muda nada.
 */
export function blocoBia(resultados: ResultadoBia[]): string {
  if (resultados.length === 0) return "";
  return resultados
    .map((r, i) => {
      const cabecalho = [r.chunk.secao, r.chunk.faixa_rotulo].filter(Boolean).join(" · ");
      return `${i + 1}. ${cabecalho || r.chunk.nucleo}\n${r.chunk.texto_original}`;
    })
    .join("\n\n");
}
