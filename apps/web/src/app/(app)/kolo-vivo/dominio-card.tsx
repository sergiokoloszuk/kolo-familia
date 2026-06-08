"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Apple,
  Check,
  Clock,
  Copy,
  Eye,
  GraduationCap,
  Heart,
  MessageSquare,
  Moon,
  PersonStanding,
  School,
  Stethoscope,
  Target,
  Tv,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DominioDef, DominioKey, DominioTone } from "./dominios";

export type DominioStatus = "vivo" | "perceber" | "comecar";

export type DominioSugestao = {
  id: string;
  texto_sugerido: string;
};

// Mapas literais (Tailwind v4 só extrai classes escritas por extenso).
const BAR: Record<DominioTone, string> = {
  sensorial: "bg-cat-sensorial",
  alimentacao: "bg-cat-alimentacao",
  comunicacao: "bg-cat-comunicacao",
  emocao: "bg-cat-emocao",
  foco: "bg-cat-foco",
  sono: "bg-cat-sono",
  social: "bg-cat-social",
  motor: "bg-cat-motor",
  rotina: "bg-cat-rotina",
};
const ICON_WRAP: Record<DominioTone, string> = {
  sensorial: "bg-cat-sensorial-soft text-cat-sensorial",
  alimentacao: "bg-cat-alimentacao-soft text-cat-alimentacao",
  comunicacao: "bg-cat-comunicacao-soft text-cat-comunicacao",
  emocao: "bg-cat-emocao-soft text-cat-emocao",
  foco: "bg-cat-foco-soft text-cat-foco",
  sono: "bg-cat-sono-soft text-cat-sono",
  social: "bg-cat-social-soft text-cat-social",
  motor: "bg-cat-motor-soft text-cat-motor",
  rotina: "bg-cat-rotina-soft text-cat-rotina",
};
const ICONE: Record<DominioKey, LucideIcon> = {
  sensorial: Eye,
  nutricional: Apple,
  comunicacao: MessageSquare,
  emocional: Heart,
  foco: Target,
  sono: Moon,
  socializacao: Users,
  motor: Activity,
  rotina: Clock,
  autonomia: PersonStanding,
  aprendizado: GraduationCap,
  imitacao: Copy,
  tela_midia: Tv,
  escola: School,
  saude_geral: Stethoscope,
};

const STATUS_TAG: Record<DominioStatus, { label: string; cls: string }> = {
  vivo: { label: "Vivo", cls: "bg-brand-yellow/20 text-[#8B5A00]" },
  perceber: { label: "Vale entender", cls: "bg-cat-emocao-bg text-cat-emocao" },
  comecar: { label: "Começar", cls: "bg-foreground/5 text-muted-foreground" },
};

function labelTempo(atualizadoEm: string): string {
  const dias = Math.floor(
    (Date.now() - new Date(atualizadoEm).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dias <= 0) return "mudou hoje";
  if (dias <= 3) return "mudou nos últimos dias";
  if (dias <= 7) return "mexido esta semana";
  if (dias <= 14) return "mexido faz pouco";
  if (dias <= 30) return "mudou há algumas semanas";
  if (dias <= 90) return "mudou há alguns meses";
  return "já tem um tempo";
}

export function DominioCard({
  dominio,
  texto,
  atualizadoEm,
  status,
  sugestao,
  onSave,
  onDecideSugestao,
}: {
  dominio: DominioDef;
  texto: string;
  atualizadoEm: string | null;
  status: DominioStatus;
  sugestao?: DominioSugestao;
  onSave: (texto: string) => Promise<void>;
  onDecideSugestao: (id: string, decisao: "aprovar" | "rejeitar") => Promise<void>;
}) {
  const Icon = ICONE[dominio.key];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(texto);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const [sugPending, startSug] = useTransition();
  const [sugError, setSugError] = useState<string | null>(null);

  function commit() {
    if (value.trim() === texto.trim()) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onSave(value.trim());
        setEditing(false);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function cancel() {
    setValue(texto);
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

  function decidir(decisao: "aprovar" | "rejeitar") {
    if (!sugestao) return;
    setSugError(null);
    startSug(async () => {
      try {
        await onDecideSugestao(sugestao.id, decisao);
      } catch (e) {
        setSugError(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  const tag = STATUS_TAG[status];
  const microtexto = pending
    ? "salvando…"
    : showSaved
      ? "salvo"
      : !editing && texto.trim() && atualizadoEm
        ? labelTempo(atualizadoEm)
        : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] bg-white p-6 pt-7 shadow-[0_1px_2px_rgba(46,10,82,0.04),_0_8px_24px_rgba(46,10,82,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(46,10,82,0.06),_0_16px_36px_rgba(46,10,82,0.08)]">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", BAR[dominio.tone])} />

      {!editing && (
        <span
          className={cn(
            "absolute right-5 top-5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
            tag.cls,
          )}
        >
          {tag.label}
        </span>
      )}

      <header className="mb-3.5 mt-1 flex items-center gap-3.5">
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            ICON_WRAP[dominio.tone],
          )}
        >
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <h3 className="font-heading text-lg font-semibold leading-tight text-foreground">
          {dominio.label}
        </h3>
      </header>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            rows={Math.max(4, value.split("\n").length + 1)}
            value={value}
            placeholder={dominio.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            disabled={pending}
            className="w-full resize-none whitespace-pre-wrap rounded-xl bg-kolo-lilas-bg-2/40 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 disabled:opacity-60"
          />
          <p className="text-xs text-muted-foreground">{dominio.descricao}</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : texto.trim() ? (
        <p
          onClick={() => setEditing(true)}
          className="cursor-text whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
        >
          {texto}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left text-sm leading-relaxed text-muted-foreground/60 transition-colors hover:text-brand-purple"
        >
          {dominio.descricao}
        </button>
      )}

      {/* Sugestão da Ayla — destaque com pulso, dentro do card. */}
      {sugestao && !editing && (
        <div className="mt-4 rounded-xl bg-kolo-lilas-bg px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1 size-1.5 shrink-0 animate-pulse rounded-full bg-brand-yellow shadow-[0_0_0_3px_rgba(255,186,0,0.2)]"
            />
            <p className="text-[13px] font-medium leading-snug text-brand-purple">
              A Ayla quer atualizar: {sugestao.texto_sugerido}
            </p>
          </div>
          {sugError && <p className="mt-1.5 text-xs text-destructive">{sugError}</p>}
          <div className="mt-2.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => decidir("rejeitar")}
              disabled={sugPending}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" aria-hidden /> Descartar
            </button>
            <button
              type="button"
              onClick={() => decidir("aprovar")}
              disabled={sugPending}
              className="inline-flex items-center gap-1 rounded-full bg-brand-purple px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-dark disabled:opacity-50"
            >
              <Check className="size-3" aria-hidden /> {sugPending ? "…" : "Aceitar"}
            </button>
          </div>
        </div>
      )}

      {/* Rodapé discreto: tempo (se preenchido) ou convite (se vazio). */}
      {!editing && !sugestao && (
        <p className="mt-4 text-xs text-foreground/40" aria-live="polite">
          {microtexto ?? (texto.trim() ? null : "Tocar pra começar")}
        </p>
      )}
    </article>
  );
}
