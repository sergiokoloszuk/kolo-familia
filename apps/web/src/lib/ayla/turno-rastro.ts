import { logEvent } from "@/lib/log";

/**
 * O ORÇAMENTO TEMPORAL DO TURNO — 08/09/2026.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. O turno homologado no Gate A levou **26 s** do
 * ponto de vista da família. Sabíamos explicar 8,05 s (o interior de
 * `conduzirRotina`, instrumentado em `rotina-rastro.ts`) e 10 s de debounce
 * deliberado. Sobravam **~8 s sem nome** — e otimizar o que não se mediu é
 * escolher o alvo pelo palpite.
 *
 * ⚠️ ISTO NÃO ALTERA COMPORTAMENTO. Nenhuma heurística, modelo, prompt, debounce
 * ou regra de produto muda. É a segunda peça de observabilidade da mesma
 * missão, e a separação é deliberada: um commit que mede e um commit que muda
 * não podem ser o mesmo.
 *
 * ⚠️ CORRELAÇÃO, NÃO DUPLICAÇÃO. `conduzirRotina` já tem rastro próprio e
 * continua tendo. Aqui a capacidade especializada aparece como UMA etapa, e o
 * detalhe fica no outro rastro — ligados pelo mesmo `turno`. Instrumentar duas
 * vezes o mesmo trecho produziria dois números para o mesmo fato, que é
 * exatamente o defeito que este Gate passou o dia desfazendo.
 *
 * ⚠️ SEM CONTEÚDO DE FAMÍLIA. Tamanhos, contagens, durações e decisões. Nunca a
 * fala da mãe nem a da Ayla. §11 e §16 do protocolo.
 */

/** Uma chamada de modelo dentro do turno — quem, quanto, e com o quê. */
export type ChamadaLLM = {
  funcao: string;
  provider: string | null;
  modelo: string | null;
  ms: number;
  tokens_in: number | null;
  tokens_out: number | null;
  /** "ok" · "vazio" · "retentativa" · "falha" */
  desfecho: string;
};

export type RastroTurno = {
  turno: string;
  sha: string | null;
  familia: string | null;
  membro: string | null;
  tipo_mensagem: string | null;
  chars_entrada: number;
  /** Da hora que a Z-API carimbou até o `after()` começar de fato. */
  ms_ate_processar: number | null;
  /** Do carimbo do inbound até a primeira aceitação do provedor. */
  ms_ate_primeira_resposta: number | null;
  /** Trabalho mantido vivo depois que a família já recebeu a primeira bolha. */
  ms_apos_primeira_resposta: number | null;
  /** Onde o turno terminou — inclusive as saídas mudas. */
  saida: string | null;
  motivo: string | null;
  /** Duração por etapa. `debounce` é latência DELIBERADA — ver PEND-058. */
  ms: Record<string, number>;
  /** Tempos internos que explicam uma etapa, sem serem somados duas vezes. */
  detalhes: Record<string, number>;
  chamadas: ChamadaLLM[];
  /** Consultas ao banco contadas por nome lógico, para achar repetição. */
  queries: Record<string, number>;
  /** Marcos absolutos (epoch ms), para reconstruir a linha do tempo. */
  marcos: Record<string, number>;
};

const agoraMs = () => Date.now();

export function novoRastroTurno(params: {
  chars: number;
  recebidaEm?: Date | null;
}): RastroTurno {
  const t0 = agoraMs();
  const carimbo = params.recebidaEm ? params.recebidaEm.getTime() : NaN;
  return {
    turno: `tn_${t0.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    familia: null,
    membro: null,
    tipo_mensagem: null,
    chars_entrada: params.chars,
    // ⚠️ ESTE NÚMERO INCLUI O QUE NÃO É NOSSO: a viagem da Z-API até o webhook e
    // a fila do `after()`. É justamente por isso que ele vale — parte da espera
    // que a família sente acontece antes de a nossa primeira linha rodar.
    ms_ate_processar: Number.isFinite(carimbo) ? t0 - carimbo : null,
    ms_ate_primeira_resposta: null,
    ms_apos_primeira_resposta: null,
    saida: null,
    motivo: null,
    ms: {},
    detalhes: {},
    chamadas: [],
    queries: {},
    marcos: {
      inicio: t0,
      ...(Number.isFinite(carimbo) ? { inbound_recebido: carimbo } : {}),
    },
  };
}

/** Carimba um marco absoluto — a linha do tempo, não a duração. */
export function marco(r: RastroTurno, nome: string): void {
  r.marcos[nome] = agoraMs();
}

/**
 * Cronometra uma etapa. Soma quando a mesma etapa roda mais de uma vez — é
 * assim que leitura repetida aparece como tempo, e não só como contagem.
 *
 * ⚠️ NÃO ENGOLE ERRO: o tempo é registrado e a exceção sobe. Cronômetro que
 * esconde falha é pior que nenhum.
 */
export async function etapaTurno<T>(
  r: RastroTurno,
  nome: string,
  fn: () => Promise<T>,
): Promise<T> {
  const t = agoraMs();
  r.marcos[`${nome}_inicio`] = t;
  try {
    return await fn();
  } finally {
    const fim = agoraMs();
    r.marcos[`${nome}_fim`] = fim;
    r.ms[nome] = (r.ms[nome] ?? 0) + (fim - t);
  }
}

/** Registra uma chamada de modelo já concluída. */
export function registrarLLM(r: RastroTurno, c: ChamadaLLM): void {
  r.chamadas.push(c);
}

/** Conta uma consulta por nome lógico — repetição vira número. */
export function contarQuery(r: RastroTurno, nome: string): void {
  r.queries[nome] = (r.queries[nome] ?? 0) + 1;
}

/** Registra detalhe interno sem misturá-lo às etapas não sobrepostas. */
export function registrarDetalhe(r: RastroTurno, nome: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  r.detalhes[nome] = (r.detalhes[nome] ?? 0) + Math.round(ms);
}

/**
 * Carimba a primeira bolha no instante em que o provedor a aceitou. Chamadas
 * posteriores são ignoradas (ex.: “Quero os dois”), porque a experiência da
 * família começa na primeira e não na última resposta.
 */
export function registrarPrimeiraResposta(
  r: RastroTurno,
  aceite: { aceitoEmMs: number; provedorMs?: number },
): void {
  if (r.marcos.primeira_resposta_aceita || !Number.isFinite(aceite.aceitoEmMs)) return;
  r.marcos.primeira_resposta_aceita = aceite.aceitoEmMs;
  const inicioPercebido = r.marcos.inbound_recebido ?? r.marcos.inicio;
  r.ms_ate_primeira_resposta = Math.max(0, aceite.aceitoEmMs - inicioPercebido);
  if (typeof aceite.provedorMs === "number") {
    registrarDetalhe(r, "provedor_primeira_resposta", aceite.provedorMs);
  }
}

/**
 * Fecha o orçamento e persiste. Chamado em `finally` — sucesso, fallback,
 * `return null`, erro tratado e erro inesperado geram rastro.
 *
 * ⚠️ `nao_medido` É O CAMPO QUE IMPORTA. Ele é a diferença entre o total e a
 * soma das etapas conhecidas: é o tamanho da nossa ignorância, medido. Enquanto
 * ele for grande, o orçamento não está fechado.
 */
export async function registrarRastroTurno(r: RastroTurno): Promise<void> {
  // ⚠️ AS DURAÇÕES SAEM DOS MARCOS, e essa escolha tem motivo. Envolver as
  // chamadas em `etapaTurno` mudaria o TEXTO do orquestrador, e onze testes
  // prendem deliberadamente a forma dessas chamadas — um deles CONTA
  // ocorrências. Medir não pode custar a garantia de quem já estava lá. Um
  // carimbo antes e outro depois medem o mesmo e não tocam em nada.
  const etapas = [
    "identidade",
    "persistencia_inbound",
    "debounce",
    "pre_decisao",
    "decisor",
    "capacidade",
    "geracao_resposta",
    "envio",
    "interacao_estruturada",
  ];
  for (const nome of etapas) {
    const i = r.marcos[`${nome}_inicio`];
    const f = r.marcos[`${nome}_fim`];
    if (typeof i === "number" && typeof f === "number" && f >= i) {
      r.ms[nome === "debounce" ? "debounce_deliberado" : nome] = f - i;
    }
  }
  const total = agoraMs() - r.marcos.inicio;
  if (r.marcos.primeira_resposta_aceita) {
    r.ms_apos_primeira_resposta = Math.max(
      0,
      agoraMs() - r.marcos.primeira_resposta_aceita,
    );
    if (r.ms_ate_primeira_resposta !== null) {
      const inicio = r.marcos.inbound_recebido ?? r.marcos.inicio;
      const fim = r.marcos.primeira_resposta_aceita;
      const conhecidoAntesDoProcesso = Math.max(0, r.marcos.inicio - inicio);
      const conhecidoNoProcesso = etapas.reduce((soma, nome) => {
        const etapaInicio = r.marcos[`${nome}_inicio`];
        const etapaFim = r.marcos[`${nome}_fim`];
        if (typeof etapaInicio !== "number" || typeof etapaFim !== "number") return soma;
        const sobreposicao = Math.max(0, Math.min(etapaFim, fim) - Math.max(etapaInicio, r.marcos.inicio));
        return soma + sobreposicao;
      }, 0);
      const naoMedido = Math.max(
        0,
        r.ms_ate_primeira_resposta - conhecidoAntesDoProcesso - conhecidoNoProcesso,
      );
      registrarDetalhe(r, "nao_medido_ate_primeira_resposta", naoMedido);
      registrarDetalhe(
        r,
        "percentual_nao_medido_primeira_resposta",
        r.ms_ate_primeira_resposta > 0 ? (naoMedido / r.ms_ate_primeira_resposta) * 100 : 0,
      );
    }
  }
  r.ms.total = total;
  const somaEtapas = Object.entries(r.ms)
    .filter(([k]) => k !== "total" && k !== "nao_medido")
    .reduce((a, [, v]) => a + v, 0);
  r.ms.nao_medido = Math.max(0, total - somaEtapas);
  try {
    await logEvent({
      kind: "turno_externo",
      severity: r.saida && r.saida.startsWith("null_") ? "warn" : "info",
      family_account_id: r.familia,
      message: `turno:${r.saida ?? "indefinido"} ${total}ms`,
      payload: r as unknown as Record<string, unknown>,
      persistir: true,
    });
  } catch (e) {
    console.error("[ayla:turno-rastro] falha ao persistir:", e instanceof Error ? e.message : e);
  }
}
