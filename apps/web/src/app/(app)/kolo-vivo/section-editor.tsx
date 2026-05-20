"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, Pencil } from "lucide-react";
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
export function SectionEditor({
  title,
  description,
  initialValue,
  placeholder,
  tone = "foco",
  onSave,
}: {
  title: string;
  description?: string;
  initialValue: string;
  placeholder?: string;
  tone?: SectionTone;
  onSave: (texto: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await onSave(value);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function handleCancel() {
    setValue(initialValue);
    setEditing(false);
    setError(null);
  }

  return (
    <section
      className={cn(
        "rounded-3xl px-6 py-7 md:px-8 md:py-8",
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:bg-white/40 hover:text-foreground"
          >
            <Pencil aria-hidden="true" /> Editar
          </Button>
        )}
      </header>
      <div className="mt-5">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              rows={5}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="flex w-full rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={pending}
              >
                <Check aria-hidden="true" /> {pending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        ) : value.trim().length > 0 ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {value}
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground/60">
            Isso vai sendo construído com o tempo.
          </p>
        )}
      </div>
    </section>
  );
}
