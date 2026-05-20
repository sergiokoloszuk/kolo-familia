"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tons de fundo das seções — cores `-soft` (8-10% alpha) do design system.
 * Mapeamento literal pro Tailwind v4 extrair todas as classes em build.
 * Não usar concatenação dinâmica de strings.
 */
export type SectionTone =
  | "foco"
  | "social"
  | "alimentacao"
  | "emocao"
  | "sensorial"
  | "rotina"
  | "comunicacao"
  | "motor"
  | "sono";

const SECTION_TONE_CLASS: Record<SectionTone, string> = {
  foco: "bg-cat-foco-soft",
  social: "bg-cat-social-soft",
  alimentacao: "bg-cat-alimentacao-soft",
  emocao: "bg-cat-emocao-soft",
  sensorial: "bg-cat-sensorial-soft",
  rotina: "bg-cat-rotina-soft",
  comunicacao: "bg-cat-comunicacao-soft",
  motor: "bg-cat-motor-soft",
  sono: "bg-cat-sono-soft",
};

/**
 * Editor de uma seção do Kolo Vivo.
 *
 * Visual: <section> respirada com fundo cromático sutil (tone) — não mais
 * Card de formulário. Edição continua via botão Editar → textarea →
 * Salvar/Cancelar (refator de edição inline fica pra P-KV-7).
 */
/**
 * Microtexto temporal editorial (P-KV-6) — frase humana que muda conforme
 * o tempo desde a última atualização. Não é "atualizado há X dias" técnico;
 * é leitura de quem percebe que algo mudou no retrato.
 */
function labelTempo(atualizadoEm: string): string {
  const diasAtras = Math.floor(
    (Date.now() - new Date(atualizadoEm).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diasAtras <= 0) return "isso mudou hoje";
  if (diasAtras <= 3) return "isso mudou nos últimos dias";
  if (diasAtras <= 7) return "vocês mexeram nisso esta semana";
  if (diasAtras <= 14) return "vocês mexeram nisso faz pouco";
  if (diasAtras <= 30) return "isso mudou há algumas semanas";
  if (diasAtras <= 90) return "isso mudou há alguns meses";
  return "isso já tem um tempo";
}

export function SectionEditor({
  title,
  description,
  initialValue,
  placeholder,
  tone = "foco",
  atualizadoEm,
  onSave,
}: {
  title: string;
  description?: string;
  initialValue: string;
  placeholder?: string;
  tone?: SectionTone;
  atualizadoEm?: string | null;
  onSave: (texto: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  function commit() {
    // Sem mudança → só fecha, não dispara save
    if (value === initialValue) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onSave(value);
        setEditing(false);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function cancel() {
    setValue(initialValue);
    setEditing(false);
    setError(null);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  // Microtexto unificado: status de save tem prioridade sobre labelTempo
  const statusMicro = pending
    ? "salvando…"
    : showSaved
      ? "salvo"
      : null;
  const tempoMicro =
    !editing && value.trim().length > 0 && atualizadoEm
      ? labelTempo(atualizadoEm)
      : null;
  const microtexto = statusMicro ?? tempoMicro;

  return (
    <section
      className={cn(
        "group rounded-3xl px-6 py-7 md:px-8 md:py-8",
        SECTION_TONE_CLASS[tone],
      )}
    >
      <header className="flex flex-row items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-medium leading-snug text-foreground md:text-xl">
            {title}
          </h3>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Editar"
            title="Editar"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/40 opacity-30 transition-all hover:text-foreground hover:opacity-100 md:opacity-0 md:group-hover:opacity-30 md:focus-visible:opacity-100 md:hover:opacity-100"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
      </header>
      <div className="mt-5">
        {editing ? (
          <>
            <textarea
              autoFocus
              rows={Math.max(4, value.split("\n").length + 1)}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKey}
              disabled={pending}
              className="w-full resize-none whitespace-pre-wrap bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-60"
            />
            {error && (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
          </>
        ) : value.trim().length > 0 ? (
          <p
            onClick={() => setEditing(true)}
            className="cursor-text whitespace-pre-wrap text-base leading-relaxed text-foreground"
          >
            {value}
          </p>
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="cursor-text text-sm leading-relaxed text-muted-foreground/60"
          >
            Isso vai sendo construído com o tempo.
          </p>
        )}
        {microtexto && (
          <p
            className="mt-4 text-xs text-foreground/40"
            aria-live="polite"
          >
            {microtexto}
          </p>
        )}
      </div>
    </section>
  );
}
