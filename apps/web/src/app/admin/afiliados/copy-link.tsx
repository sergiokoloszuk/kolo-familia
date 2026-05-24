"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ codigo }: { codigo: string }) {
  const [url, setUrl] = useState(`/i/${codigo}`);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/i/${codigo}`);
  }, [codigo]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-muted px-2 py-1 text-xs break-all">{url}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          } catch {
            /* clipboard bloqueado */
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
      >
        {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
