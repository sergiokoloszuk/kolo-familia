import { logEvent } from "@/lib/log";

/**
 * Escrita CRÍTICA conferida — §7 do protocolo de engenharia.
 *
 * O cliente Supabase **devolve** o erro em vez de lançar: um `await` sem checar
 * `error` engole a falha inteira e o fluxo segue como sucesso. Foi assim que o
 * acesso da Rochelle sumiu — seis handlers do webhook do Stripe, nenhum
 * conferindo a escrita, todos devolvendo 2xx (o que faz o Stripe nunca
 * reenviar).
 *
 * Aqui a conferência vive num lugar só, e cada handler troca o `await` cru por
 * uma chamada a `conferirEscrita`. Dois modos de falso sucesso são cobertos:
 *
 *   1. `error` preenchido — o banco recusou;
 *   2. **zero linhas afetadas** — o `WHERE` não casou com ninguém. `.update()`
 *      sem `.select()` devolve `error: null` e nada; é indistinguível de
 *      sucesso. Por isso quem chama sempre encadeia `.select(...)`.
 *
 * Falha crítica LANÇA. O `try/catch` que já existe na rota transforma isso em
 * 500, e aí o Stripe retenta — que é o comportamento desejado, e o que hoje
 * nunca acontece porque a falha vira 2xx.
 */

type RespostaEscrita = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

/** Código do Postgres para violação de unique — replay legítimo, não falha. */
const UNIQUE_VIOLATION = "23505";

export type ContextoEscrita = {
  /** Vira o `kind` do log. Ex.: "stripe_checkout_completed". */
  kind: string;
  familyId?: string | null;
  eventId?: string | null;
  eventType?: string | null;
  /** O que a regra de autoridade decidiu: concede · mantem · remove · vinculo. */
  decisao?: string;
  /** Só as CHAVES do patch — nunca os valores, que carregam dado da família. */
  campos?: string[];
  /** Estado interno antes da escrita, quando conhecido. */
  statusAnterior?: string | null;
  /** Status cru do Stripe que originou a decisão. */
  stripeStatus?: string | null;
  /**
   * Zero linhas afetadas é falha? Padrão `true`. Vira `false` onde zero linhas
   * é resultado esperado — o carimbo de dunning que só grava se ainda não
   * houver, por exemplo.
   */
  exigirLinha?: boolean;
  /** Violação de unique é replay do mesmo evento, não erro. */
  tolerarDuplicata?: boolean;
};

export class EscritaCriticaFalhou extends Error {
  constructor(
    readonly kind: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "EscritaCriticaFalhou";
  }
}

/**
 * Executa a escrita, confere o resultado e devolve quantas linhas foram
 * afetadas. Lança `EscritaCriticaFalhou` se o banco recusar ou se nenhuma linha
 * for tocada onde isso significaria falso sucesso.
 */
export async function conferirEscrita(
  query: PromiseLike<RespostaEscrita>,
  ctx: ContextoEscrita,
): Promise<number> {
  const base = {
    family_account_id: ctx.familyId ?? null,
    event_id: ctx.eventId ?? undefined,
    event_type: ctx.eventType ?? undefined,
    decisao: ctx.decisao ?? undefined,
    campos: ctx.campos ?? undefined,
    status_anterior: ctx.statusAnterior ?? undefined,
    stripe_status: ctx.stripeStatus ?? undefined,
  };

  const { data, error } = await query;

  if (error) {
    if (ctx.tolerarDuplicata && error.code === UNIQUE_VIOLATION) {
      // Mesmo evento chegando de novo (retry do Stripe ou execução
      // concorrente). O primeiro insert venceu; este é no-op de propósito.
      await logEvent({
        kind: ctx.kind,
        severity: "info",
        message: "replay do mesmo evento — registro já existia",
        family_account_id: ctx.familyId ?? null,
        payload: { ...base, resultado: "replay" },
      });
      return 0;
    }
    await logEvent({
      kind: ctx.kind,
      severity: "error",
      message: `escrita crítica recusada pelo banco: ${error.message}`,
      family_account_id: ctx.familyId ?? null,
      payload: { ...base, resultado: "erro", erro: error.message, codigo: error.code },
    });
    throw new EscritaCriticaFalhou(ctx.kind, error.message);
  }

  const linhas = Array.isArray(data) ? data.length : data ? 1 : 0;

  if (linhas === 0 && ctx.exigirLinha !== false) {
    await logEvent({
      kind: ctx.kind,
      severity: "error",
      message: "escrita crítica não afetou nenhuma linha",
      family_account_id: ctx.familyId ?? null,
      payload: { ...base, resultado: "zero_linhas" },
    });
    throw new EscritaCriticaFalhou(ctx.kind, "nenhuma linha afetada");
  }

  await logEvent({
    kind: ctx.kind,
    severity: "info",
    message: "escrita aplicada",
    family_account_id: ctx.familyId ?? null,
    payload: { ...base, resultado: "ok", linhas },
  });
  return linhas;
}

/**
 * Evento de DINHEIRO cuja família não dá para resolver. Não existe destino
 * seguro: adivinhar identidade é pior que falhar. Registra com severidade de
 * erro (persiste em `eventos_app`) e lança — a rota devolve 500, o Stripe
 * reentrega, e o caso fica visível nas entregas com falha em vez de sumir num
 * `return` mudo com 2xx.
 */
export async function exigirFamiliaResolvida(
  familyId: string | null,
  ctx: { kind: string; eventId?: string | null; eventType?: string | null },
): Promise<string> {
  if (familyId) return familyId;
  await logEvent({
    kind: ctx.kind,
    severity: "error",
    message: "evento de pagamento sem family_account_id resolvível — acesso NÃO concedido",
    payload: { event_id: ctx.eventId ?? undefined, event_type: ctx.eventType ?? undefined },
  });
  throw new EscritaCriticaFalhou(ctx.kind, "evento de pagamento sem família resolvível");
}

/**
 * Evento de CICLO DE VIDA sem família resolvível (subscription created/updated/
 * deleted). Não carrega dinheiro e o retry não faria a metadata aparecer —
 * assinatura criada fora dos nossos dois caminhos de checkout nunca vai ter.
 * Fica observável (`warn` persiste) e o processamento segue; não lança.
 */
export async function avisarFamiliaNaoResolvida(ctx: {
  kind: string;
  eventId?: string | null;
  eventType?: string | null;
}): Promise<void> {
  await logEvent({
    kind: ctx.kind,
    severity: "warn",
    message: "evento de assinatura sem family_account_id resolvível — nada foi alterado",
    payload: { event_id: ctx.eventId ?? undefined, event_type: ctx.eventType ?? undefined },
  });
}
