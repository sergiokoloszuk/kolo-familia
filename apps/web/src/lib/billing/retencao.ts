/**
 * RETENÇÃO E EXCLUSÃO — QUEM PODE SER APAGADA, POR QUÊ, E A PARTIR DE QUANDO.
 *
 * ── o que isto substitui ──────────────────────────────────────────────────
 *
 * Até 20/08/2026 a Kolo prometia, na tela, que os dados de uma família seriam
 * apagados depois de um prazo — e **dois dos três caminhos não tinham
 * implementação nenhuma**. O cron de exclusão filtrava por
 * `pagamento_falhou_em`, carimbo que só nasce em `invoice.payment_failed`.
 * Logo:
 *
 *   - **trial vencido** nunca era apagado (não gera falha de fatura);
 *   - **cancelamento voluntário** nunca era apagado (idem);
 *   - só a inadimplência entrava — e mesmo essa, em dry-run.
 *
 * A promessa era falsa nas duas metades: os dados não ficavam "por 7 dias" e
 * não eram "depois excluídos". Ficavam para sempre.
 *
 * ── a regra que este arquivo implementa ───────────────────────────────────
 *
 * Cada caminho tem a SUA data, e nenhuma depende de evento de pagamento:
 *
 *   | caminho        | a retenção começa em   |
 *   |----------------|------------------------|
 *   | trial          | `trial_ends_at`        |
 *   | cancelamento   | `current_period_end`   |
 *   | inadimplência  | `pagamento_falhou_em`  |
 *
 * Nenhuma coluna nova foi criada: as três datas já existiam. O relógio é
 * DERIVADO, não carimbado — o que torna a função pura, idempotente por
 * natureza e sem estado obsoleto para limpar.
 *
 * ── fail-closed, sempre ───────────────────────────────────────────────────
 *
 * Apagar é irreversível. Toda ambiguidade — status desconhecido, data
 * faltando, `paused` (que não tem política definida) — devolve NÃO ELEGÍVEL.
 * O custo de adiar é um dia; o de errar não tem volta.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

/** Quanto tempo os dados esperam depois que o acesso acaba. */
export const RETENCAO_DIAS = 7;

/**
 * Linha tocada há menos que isto = alguém mexeu agora (webhook, checkout).
 * Adia para a próxima execução em vez de correr contra a escrita alheia.
 */
export const JANELA_ALTERACAO_RECENTE_MIN = 15;

export type MotivoRetencao = "trial" | "cancelamento" | "inadimplencia";

export type ProtecaoRetencao =
  | "staff"
  | "cortesia"
  | "assinatura_ativa"
  | "nunca_avisada"
  | "estado_ambiguo"
  | "alteracao_recente";

export type LinhaAssinatura = {
  family_account_id?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  pagamento_falhou_em?: string | null;
  cortesia?: boolean | null;
  cortesia_ate?: string | null;
  updated_at?: string | null;
};

export type ContextoRetencao = {
  /** A família pertence a alguém da equipe? (`familiaEhDeStaff`) */
  ehStaff: boolean;
  /**
   * A família já recebeu algum aviso de fim de teste (`trial_d0`/`trial_d3`)?
   *
   * ⚠️ DECISÃO DE PRODUTO, NÃO DETALHE TÉCNICO: ninguém é apagado sem ter sido
   * avisada antes, com o link para assinar. Vale inclusive para a conta que
   * nasceu com o teste vencido (recadastro com o mesmo e-mail/WhatsApp).
   */
  foiAvisada: boolean;
};

export type EstadoRetencao = {
  motivo: MotivoRetencao | null;
  /** Quando o relógio começou (ISO), ou null se não dá para saber. */
  inicioEm: string | null;
  /** A partir de quando poderia ser apagada (ISO). */
  elegivelEm: string | null;
  elegivel: boolean;
  /** O que impediu. `null` quando nada impediu. */
  protecao: ProtecaoRetencao | null;
  /** Frase curta em português, para o log e para o relatório. */
  explicacao: string;
};

function data(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isFinite(t) ? t : null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Descobre o MOTIVO e a data de início, sem julgar proteção nem prazo.
 *
 * Separado de propósito: o motivo é uma leitura do estado, e continua sendo
 * verdade mesmo quando a família está protegida. É isso que permite dizer
 * "seria por trial, mas é staff" em vez de só "não elegível".
 */
export function motivoRetencao(
  sub: LinhaAssinatura | null | undefined,
  agora: number = Date.now(),
): { motivo: MotivoRetencao; inicioEm: number } | null {
  if (!sub) return null;

  const trialFim = data(sub.trial_ends_at);
  const periodoFim = data(sub.current_period_end);
  const falhou = data(sub.pagamento_falhou_em);

  switch (sub.status) {
    case "trialing":
      // Teste acabou e ninguém assinou. Vale também para o teste que já nasceu
      // vencido — o aviso é que protege esse caso, não uma exceção aqui.
      if (trialFim != null && trialFim <= agora) {
        return { motivo: "trial", inicioEm: trialFim };
      }
      return null;

    case "past_due":
      // COM carimbo = dunning de assinante de verdade.
      if (falhou != null) return { motivo: "inadimplencia", inicioEm: falhou };
      // SEM carimbo = o trial acabou sem cartão: o Stripe manda `past_due` mas
      // NÃO gera `invoice.payment_failed`. É caminho de trial, não de dunning.
      if (trialFim != null && trialFim <= agora) {
        return { motivo: "trial", inicioEm: trialFim };
      }
      return null;

    case "canceled":
      if (falhou != null) return { motivo: "inadimplencia", inicioEm: falhou };
      // Sem carimbo, um `canceled` é cancelamento voluntário que chegou ao fim
      // do período pago. O relógio começa quando o acesso acabou — não quando
      // ela clicou em cancelar, porque até o fim do período ela usou tudo.
      if (periodoFim != null && periodoFim <= agora) {
        return { motivo: "cancelamento", inicioEm: periodoFim };
      }
      return null;

    // `active` está pagando. `paused` não tem política definida — e inventar
    // uma aqui seria decidir sozinho o destino de dados de criança.
    default:
      return null;
  }
}

/**
 * A pergunta inteira: esta família pode ser apagada agora?
 *
 * A ordem das proteções é a ordem da gravidade, e é ela que decide o que o log
 * vai dizer quando duas se aplicarem ao mesmo tempo.
 */
export function estadoRetencao(
  sub: LinhaAssinatura | null | undefined,
  ctx: ContextoRetencao,
  agora: number = Date.now(),
): EstadoRetencao {
  const vazio = {
    motivo: null,
    inicioEm: null,
    elegivelEm: null,
    elegivel: false,
  } as const;

  if (!sub) {
    return { ...vazio, protecao: "estado_ambiguo", explicacao: "sem linha de assinatura" };
  }

  // 1. STAFF — nunca, em nenhuma hipótese. A Kolo usa o próprio produto para
  //    saber o que as famílias recebem; apagar a conta de quem opera é
  //    destruir o instrumento de medida junto com o dado.
  if (ctx.ehStaff) {
    return { ...vazio, protecao: "staff", explicacao: "conta da equipe" };
  }

  // 2. CORTESIA válida — acesso concedido de propósito.
  const cortesiaValida =
    sub.cortesia === true && (!sub.cortesia_ate || (data(sub.cortesia_ate) ?? 0) > agora);
  if (cortesiaValida) {
    return { ...vazio, protecao: "cortesia", explicacao: "acesso cortesia" };
  }

  // 3. ASSINATURA ATIVA — está pagando. Cobre o "mudei de ideia" e o
  //    "assinou durante a retenção" sem nenhum código de remover-da-fila:
  //    pagar leva o status a `active`, e `active` nunca é elegível.
  if (sub.status === "active") {
    return { ...vazio, protecao: "assinatura_ativa", explicacao: "assinatura ativa" };
  }

  // 4. O MOTIVO. Não havendo, o estado é ambíguo e ninguém é apagado.
  const m = motivoRetencao(sub, agora);
  if (!m) {
    return {
      ...vazio,
      protecao: "estado_ambiguo",
      explicacao: `status "${sub.status ?? "?"}" sem data de início utilizável`,
    };
  }

  const elegivelEmMs = m.inicioEm + RETENCAO_DIAS * MS_DIA;
  const base = {
    motivo: m.motivo,
    inicioEm: iso(m.inicioEm),
    elegivelEm: iso(elegivelEmMs),
  };

  // 5. NUNCA AVISADA — decisão de produto: ninguém some sem ter sido avisada.
  if (!ctx.foiAvisada) {
    return {
      ...base,
      elegivel: false,
      protecao: "nunca_avisada",
      explicacao: `${m.motivo}: nunca recebeu aviso de fim de teste`,
    };
  }

  // 6. O PRAZO.
  if (agora < elegivelEmMs) {
    const faltam = Math.ceil((elegivelEmMs - agora) / MS_DIA);
    return {
      ...base,
      elegivel: false,
      protecao: null,
      explicacao: `${m.motivo}: ainda em retenção, faltam ${faltam} dia(s)`,
    };
  }

  // 7. ALTERAÇÃO RECENTE — alguém escreveu nesta linha agora há pouco
  //    (webhook do Stripe, checkout). `subscription_accesses` tem trigger de
  //    `updated_at`, então isto é sinal confiável. Adiar custa um dia; correr
  //    contra a escrita alheia custa apagar quem acabou de pagar.
  const tocadaEm = data(sub.updated_at);
  if (tocadaEm != null && agora - tocadaEm < JANELA_ALTERACAO_RECENTE_MIN * 60 * 1000) {
    return {
      ...base,
      elegivel: false,
      protecao: "alteracao_recente",
      explicacao: `${m.motivo}: linha alterada há menos de ${JANELA_ALTERACAO_RECENTE_MIN} min`,
    };
  }

  return {
    ...base,
    elegivel: true,
    protecao: null,
    explicacao: `${m.motivo}: retenção vencida em ${base.elegivelEm}`,
  };
}

/**
 * QUAIS MOTIVOS ESTÃO LIGADOS — a trava de ativação.
 *
 * Substitui `DUNNING_DELETE_ENABLED`, cujo nome prometia dunning quando o
 * mecanismo passou a cobrir três caminhos. Ela era lida em um único arquivo e
 * **nunca existiu em produção**, então a troca não quebra nada.
 *
 *   EXCLUSAO_AUTOMATICA = off | todos | trial,cancelamento,inadimplencia
 *
 * Ausente ou vazia = `off` = dry-run: calcula tudo, registra tudo, não apaga
 * nada. É o padrão, e é o que fica no ar até a ativação controlada.
 */
export function motivosAtivos(valor: string | undefined = process.env.EXCLUSAO_AUTOMATICA):
  Set<MotivoRetencao> {
  const bruto = (valor ?? "").trim().toLowerCase();
  if (!bruto || bruto === "off" || bruto === "false" || bruto === "0") return new Set();
  if (bruto === "todos" || bruto === "all" || bruto === "true") {
    return new Set<MotivoRetencao>(["trial", "cancelamento", "inadimplencia"]);
  }
  const validos: MotivoRetencao[] = ["trial", "cancelamento", "inadimplencia"];
  const pedidos = bruto.split(",").map((s) => s.trim());
  return new Set(validos.filter((m) => pedidos.includes(m)));
}

/** Como o valor efetivo aparece no `/api/health` — nunca "true"/"false" soltos. */
export function descreverMotivosAtivos(
  valor: string | undefined = process.env.EXCLUSAO_AUTOMATICA,
): string {
  const ativos = motivosAtivos(valor);
  return ativos.size === 0 ? "off" : [...ativos].sort().join(",");
}
