"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { salvarIdiomaAction } from "./actions";

export type Idioma = "pt" | "es" | "en";

const IDIOMAS: { value: Idioma; flag: string; label: string; nota: string }[] = [
  { value: "pt", flag: "🇧🇷", label: "Português", nota: "Brasil" },
  { value: "es", flag: "🇪🇸", label: "Español", nota: "América Latina" },
  { value: "en", flag: "🇺🇸", label: "English", nota: "" },
];

/**
 * Seletor de idioma da família (bandeirinhas). Muda a língua da plataforma e
 * das mensagens que a Ayla ENVIA. Quando a mãe escreve, a Ayla já responde no
 * idioma dela independente disso.
 */
export function IdiomaForm({ initial }: { initial: Idioma }) {
  const router = useRouter();
  const [idioma, setIdioma] = useState<Idioma>(initial);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "erro"; msg: string } | null
  >(null);

  function escolher(novo: Idioma) {
    if (novo === idioma || pending) return;
    const anterior = idioma;
    setIdioma(novo);
    setFeedback(null);
    start(async () => {
      const res = await salvarIdiomaAction({ idioma: novo });
      if (!res.ok) {
        setIdioma(anterior);
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setFeedback({ kind: "ok", msg: "Idioma salvo." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {IDIOMAS.map((op) => {
          const ativo = op.value === idioma;
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => escolher(op.value)}
              disabled={pending}
              aria-pressed={ativo}
              className={`flex min-w-[8rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all disabled:opacity-60 ${
                ativo
                  ? "border-brand-purple bg-kolo-lilas-bg-2 ring-1 ring-brand-purple"
                  : "border-foreground/[0.08] bg-white hover:border-foreground/20"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {op.flag}
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{op.label}</span>
                {op.nota && (
                  <span className="text-xs text-muted-foreground">{op.nota}</span>
                )}
              </span>
              {ativo && (
                <Check className="ml-auto size-4 text-brand-purple" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "text-sm text-emerald-700"
              : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
