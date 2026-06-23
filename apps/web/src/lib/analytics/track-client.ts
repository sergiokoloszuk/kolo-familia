"use client";

/**
 * Dispara um evento de comportamento (fire-and-forget) pro /api/track. Usa
 * sendBeacon (sobrevive à navegação e leva o cookie de sessão); fallback fetch
 * keepalive. Silencioso — nunca atrapalha a UI. A família é resolvida no
 * servidor pela sessão; o client não manda (nem pode forjar) family_account_id.
 */
export function track(evento: string, detalhe: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ evento, detalhe });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
  } catch {
    // silencioso
  }
}
