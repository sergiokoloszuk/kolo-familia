"use client";

import { useEffect } from "react";

/**
 * Captura erros JS não tratados no client e despacha pra
 * `/api/log/client` (que insere em eventos_app via RLS).
 *
 * Coalesce: agrupa erros idênticos no mesmo minuto para evitar storm.
 * Drop silently se o usuário não está autenticado (endpoint retorna 401).
 */

const COALESCE_WINDOW_MS = 60_000;

type Recent = Map<string, number>;

function makeKey(message: string, source?: string, line?: number) {
  return `${message}|${source ?? ""}|${line ?? ""}`;
}

async function report(payload: {
  message: string;
  stack?: string;
  url?: string;
  user_agent?: string;
}) {
  try {
    await fetch("/api/log/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // Best-effort: não bloqueia o usuário, não retry
      keepalive: true,
    });
  } catch {
    // Silencioso — log é best-effort
  }
}

export function ErrorTracker() {
  useEffect(() => {
    const recent: Recent = new Map();

    function shouldReport(key: string) {
      const now = Date.now();
      const last = recent.get(key);
      if (last && now - last < COALESCE_WINDOW_MS) return false;
      recent.set(key, now);
      // Compact se ficar grande
      if (recent.size > 50) {
        for (const [k, t] of recent) {
          if (now - t > COALESCE_WINDOW_MS) recent.delete(k);
        }
      }
      return true;
    }

    function onError(e: ErrorEvent) {
      const message = e.message?.slice(0, 500) ?? "unknown";
      const stack = e.error instanceof Error ? e.error.stack : undefined;
      const key = makeKey(message, e.filename, e.lineno);
      if (!shouldReport(key)) return;
      void report({
        message,
        stack: stack?.slice(0, 4000),
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    }

    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandled rejection";
      const stack = reason instanceof Error ? reason.stack : undefined;
      const key = makeKey(message, "rejection");
      if (!shouldReport(key)) return;
      void report({
        message: message.slice(0, 500),
        stack: stack?.slice(0, 4000),
        url: window.location.href,
        user_agent: navigator.userAgent,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
