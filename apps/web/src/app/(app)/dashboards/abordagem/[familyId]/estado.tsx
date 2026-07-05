"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { encerrarAbordagem } from "./actions";

/**
 * Faixa de estado da abordagem: mostra se a Ayla está suprimida / se o lead
 * respondeu e aguarda você, e o botão pra encerrar (a Ayla volta).
 */
export function EstadoAbordagem({
  familyId,
  emAbordagem,
  aguardando,
}: {
  familyId: string;
  emAbordagem: boolean;
  aguardando: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!emAbordagem) return null;

  function encerrar() {
    start(async () => {
      await encerrarAbordagem(familyId);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
        aguardando
          ? "border-brand-yellow/50 bg-brand-yellow/10"
          : "border-foreground/[0.08] bg-white"
      }`}
    >
      <p className="text-sm text-foreground">
        {aguardando ? (
          <>
            ⏳ <strong>Esse lead respondeu e está aguardando você.</strong> A Ayla não está respondendo — você conduz por aqui.
          </>
        ) : (
          <>🙋‍♀️ Em abordagem manual — a Ayla está suprimida pra esse lead.</>
        )}
      </p>
      <button
        type="button"
        onClick={encerrar}
        disabled={pending}
        className="rounded-full border border-foreground/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] disabled:opacity-50"
      >
        {pending ? "Encerrando…" : "Encerrar abordagem (Ayla volta)"}
      </button>
    </div>
  );
}
