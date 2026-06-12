"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { deletarConversa } from "../conversar/actions";
import { cn } from "@/lib/utils";

export function ConversaItem({
  id,
  titulo,
  createdAt,
  comBorda,
}: {
  id: string;
  titulo: string | null;
  createdAt: string;
  comBorda: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function handleDelete() {
    if (pending) return;
    setErro(null);
    startTransition(async () => {
      const r = await deletarConversa({ conversaId: id });
      if (!r.ok) {
        setErro(r.error);
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-2",
        comBorda && "border-t border-foreground/[0.06]",
      )}
    >
      <Link
        href={`/conversar/${id}`}
        className="flex flex-1 flex-col gap-1 py-3.5 transition-colors hover:text-brand-purple"
      >
        <span className="line-clamp-1 text-base leading-relaxed text-foreground transition-colors group-hover:text-brand-purple">
          {titulo ?? "Conversa sem título"}
        </span>
        <span className="text-xs text-muted-foreground">
          {erro ?? formatRelative(new Date(createdAt), new Date(), { locale: ptBR })}
        </span>
      </Link>
      {confirmando ? (
        <span className="flex shrink-0 items-center gap-1 pr-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
          >
            {pending ? "apagando…" : "apagar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            disabled={pending}
            className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 disabled:opacity-40"
          >
            cancelar
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          aria-label="Apagar conversa"
          title="Apagar conversa"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
