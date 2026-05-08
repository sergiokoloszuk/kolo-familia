"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort: registra no eventos_app via endpoint de log
    void fetch("/api/log/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message?.slice(0, 500) ?? "render error",
        stack: error.stack?.slice(0, 4000),
        url:
          typeof window !== "undefined"
            ? window.location.href
            : undefined,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        payload: error.digest ? { digest: error.digest } : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      /* silencioso */
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold">Algo quebrou aqui</h1>
      <p className="text-sm text-muted-foreground">
        Já registramos. Tente recarregar — se persistir, fala com a gente em{" "}
        <a href="/contato" className="underline underline-offset-4">
          /contato
        </a>
        .
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Ref: <code>{error.digest}</code>
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          Tentar de novo
        </Button>
        <a href="/" className="text-sm underline underline-offset-4">
          Voltar pra home
        </a>
      </div>
    </div>
  );
}
