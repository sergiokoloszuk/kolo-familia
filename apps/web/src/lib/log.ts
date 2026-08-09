/**
 * Logger estruturado server-side — PRD §13.5.
 *
 * Sempre escreve linha JSON em stdout (Easypanel/Vercel agregam).
 * Quando severity ∈ {warn,error,fatal} também persiste em
 * `eventos_app` via service role, pra investigação posterior.
 *
 * NUNCA logue PII bruto: nome de criança, conteúdo do diário, mensagens
 * inteiras de WhatsApp. Ids são OK; previews curtos (<60 chars) também.
 */

import { createServiceRoleClient } from "./supabase/server";

export type Severity = "debug" | "info" | "warn" | "error" | "fatal";

export type LogEvent = {
  kind: string;
  severity?: Severity;
  family_account_id?: string | null;
  user_id?: string | null;
  message?: string;
  payload?: Record<string, unknown>;
  /**
   * Persiste mesmo em `info`.
   *
   * Existe porque nem todo evento que precisa sobreviver é um problema. O
   * rastro do conhecimento é operação NORMAL — marcá-lo como `warn` só pra ele
   * não sumir com a retenção da Vercel envenenaria a severidade, e daí a
   * pergunta "o que deu errado ontem?" passaria a devolver centenas de turnos
   * saudáveis.
   */
  persistir?: boolean;
};

const PERSIST_THRESHOLD: ReadonlyArray<Severity> = [
  "warn",
  "error",
  "fatal",
] as const;

export async function logEvent(evt: LogEvent): Promise<void> {
  const sev = evt.severity ?? "info";
  const line = {
    t: new Date().toISOString(),
    sev,
    kind: evt.kind,
    family_id: evt.family_account_id ?? undefined,
    user_id: evt.user_id ?? undefined,
    msg: evt.message,
    ...(evt.payload ?? {}),
  };

  // stdout — JSON line
  const out = sev === "error" || sev === "fatal" ? console.error : console.log;
  out(JSON.stringify(line));

  if (!evt.persistir && !(PERSIST_THRESHOLD as ReadonlyArray<string>).includes(sev)) return;

  try {
    const supabase = createServiceRoleClient();
    await supabase.from("eventos_app").insert({
      kind: evt.kind,
      severity: sev,
      family_account_id: evt.family_account_id ?? null,
      user_id: evt.user_id ?? null,
      message: evt.message ?? null,
      payload: evt.payload ?? {},
    });
  } catch (e) {
    // Persistência best-effort: nunca falhar o request por causa do log
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        sev: "warn",
        kind: "log_persist_failed",
        msg: e instanceof Error ? e.message : "unknown",
      }),
    );
  }
}

/**
 * Helper que captura erro arbitrário e gera evento estruturado.
 * Use em catch-all de cron, webhooks, server actions.
 */
export async function logServerError(
  kind: string,
  err: unknown,
  ctx?: Omit<LogEvent, "kind" | "severity" | "message">,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  await logEvent({
    kind,
    severity: "error",
    message,
    ...ctx,
    payload: {
      ...(ctx?.payload ?? {}),
      stack: stack?.slice(0, 4000),
    },
  });
}
