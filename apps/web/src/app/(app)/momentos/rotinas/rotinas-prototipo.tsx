"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Hotel,
  IceCreamCone,
  Plane,
  Plus,
  Printer,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PROTÓTIPO (sem backend) das Rotinas visuais. Duas caras da MESMA rotina,
 * adaptadas por idade: criança = cartões visuais com avatar; adolescente =
 * checklist que ele mesmo consulta. Reordena e marca→cinza de verdade (estado
 * local), mas nada é salvo.
 */

type Passo = { id: string; label: string; icone: LucideIcon };

const PASSOS_JOVENILDA: Passo[] = [
  { id: "j1", label: "Avião pra Fortaleza", icone: Plane },
  { id: "j2", label: "Praia", icone: Waves },
  { id: "j3", label: "Sorveteria", icone: IceCreamCone },
  { id: "j4", label: "Lojinha de artesanato", icone: ShoppingBag },
  { id: "j5", label: "Hotel pra descansar", icone: Hotel },
];

const PASSOS_MARIO: Array<{ id: string; label: string }> = [
  { id: "m1", label: "Praia de manhã" },
  { id: "m2", label: "Almoço no restaurante" },
  { id: "m3", label: "Sorveteria" },
  { id: "m4", label: "Shopping à tarde" },
  { id: "m5", label: "Viagem de carro pra outra praia" },
];

function mover<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copia = arr.slice();
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function RotinasPrototipo() {
  const [membro, setMembro] = useState<"jovenilda" | "mario">("jovenilda");
  const [passosJ, setPassosJ] = useState(PASSOS_JOVENILDA);
  const [passosM, setPassosM] = useState(PASSOS_MARIO);
  const [feitosJ, setFeitosJ] = useState<Set<string>>(new Set());
  const [feitosM, setFeitosM] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const nova = new Set(set);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setSet(nova);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Protótipo — reordena e marca de verdade, mas nada é salvo. Só pra sentir o visual.
      </div>

      <header className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-purple">
          Rotinas visuais
        </p>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          A mesma rotina, <em className="not-italic text-brand-purple">do jeito de cada um</em>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Monte a sequência do dia, arraste pra ordenar e vá marcando — o que está feito
          fica cinza. Pra criança, vira cartões visuais; pro adolescente, uma lista que
          ele mesmo consulta. <strong className="font-semibold text-foreground">Não é cobrança</strong> —
          é previsibilidade e autonomia.
        </p>
      </header>

      {/* Trocar de membro */}
      <div className="flex flex-wrap gap-2">
        <PillMembro
          ativo={membro === "jovenilda"}
          onClick={() => setMembro("jovenilda")}
          inicial="J"
          nome="Jovenilda"
          idade="4 anos"
          cor="bg-brand-yellow text-[#7a4f00]"
        />
        <PillMembro
          ativo={membro === "mario"}
          onClick={() => setMembro("mario")}
          inicial="M"
          nome="Mario"
          idade="17 anos"
          cor="bg-brand-purple text-white"
        />
      </div>

      {membro === "jovenilda" ? (
        <ViewCrianca
          passos={passosJ}
          feitos={feitosJ}
          onToggle={(id) => toggle(feitosJ, setFeitosJ, id)}
          onMover={(i, d) => setPassosJ((p) => mover(p, i, d))}
          onReset={() => setFeitosJ(new Set())}
        />
      ) : (
        <ViewAdolescente
          passos={passosM}
          feitos={feitosM}
          onToggle={(id) => toggle(feitosM, setFeitosM, id)}
          onMover={(i, d) => setPassosM((p) => mover(p, i, d))}
          onReset={() => setFeitosM(new Set())}
        />
      )}
    </div>
  );
}

function PillMembro({
  ativo,
  onClick,
  inicial,
  nome,
  idade,
  cor,
}: {
  ativo: boolean;
  onClick: () => void;
  inicial: string;
  nome: string;
  idade: string;
  cor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 transition-colors",
        ativo ? "border-brand-purple bg-kolo-lilas-bg-2/60" : "border-input bg-white hover:border-brand-purple/40",
      )}
    >
      <span className={cn("flex size-8 items-center justify-center rounded-full text-sm font-bold", cor)}>
        {inicial}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-semibold text-foreground">{nome}</span>
        <span className="block text-xs text-muted-foreground">{idade}</span>
      </span>
    </button>
  );
}

/* ---------- Criança: cartões visuais ---------- */
function ViewCrianca({
  passos,
  feitos,
  onToggle,
  onMover,
  onReset,
}: {
  passos: Passo[];
  feitos: Set<string>;
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onReset: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-[#7a4f00]">
            J
          </span>
          <h2 className="font-heading text-xl text-foreground">Dia de passeio</h2>
        </div>
        <div className="flex gap-2">
          <BotaoSec icone={Printer}>Imprimir pra colar</BotaoSec>
          <BotaoSec icone={RotateCcw} onClick={onReset}>
            Recomeçar
          </BotaoSec>
        </div>
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {passos.map((p, i) => {
          const feito = feitos.has(p.id);
          const Icon = p.icone;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onToggle(p.id)}
                className={cn(
                  "group flex w-full flex-col items-center gap-3 rounded-3xl border-2 p-5 text-center transition-all",
                  feito
                    ? "border-foreground/10 bg-foreground/[0.03] opacity-60"
                    : "border-brand-purple/15 bg-white hover:border-brand-purple/40",
                )}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {i + 1}º
                </span>
                <span
                  className={cn(
                    "flex size-20 items-center justify-center rounded-2xl",
                    feito ? "bg-foreground/5 text-foreground/40" : "bg-brand-yellow/20 text-[#8B5A00]",
                  )}
                >
                  <Icon className="size-10" strokeWidth={1.6} />
                </span>
                <span
                  className={cn(
                    "text-base font-medium leading-snug",
                    feito ? "text-foreground/40 line-through" : "text-foreground",
                  )}
                >
                  {p.label}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                    feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/20 text-transparent",
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
              </button>
              <div className="mt-1.5 flex justify-center gap-1">
                <MiniReorder dir={-1} onClick={() => onMover(i, -1)} disabled={i === 0} />
                <MiniReorder dir={1} onClick={() => onMover(i, 1)} disabled={i === passos.length - 1} />
              </div>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-foreground/15 text-muted-foreground transition-colors hover:border-brand-purple/40 hover:text-brand-purple"
          >
            <Plus className="size-7" />
            <span className="text-sm font-medium">Adicionar passo</span>
          </button>
        </li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Cada passo pode ter um ícone, uma foto ou o avatar da Jovenilda. Ela aponta onde
        vai chegar — e marca o que já passou.
      </p>
    </section>
  );
}

/* ---------- Adolescente: checklist no celular ---------- */
function ViewAdolescente({
  passos,
  feitos,
  onToggle,
  onMover,
  onReset,
}: {
  passos: Array<{ id: string; label: string }>;
  feitos: Set<string>;
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onReset: () => void;
}) {
  const feitosCount = passos.filter((p) => feitos.has(p.id)).length;
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-purple text-sm font-bold text-white">
            M
          </span>
          <h2 className="font-heading text-xl text-foreground">Programas de hoje</h2>
        </div>
        <BotaoSec icone={RotateCcw} onClick={onReset}>
          Recomeçar
        </BotaoSec>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-foreground/10 bg-white p-5 sm:max-w-md">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Smartphone className="size-3.5" /> O Mario abre isso no celular dele e vai marcando.
        </div>
        <ul className="flex flex-col">
          {passos.map((p, i) => {
            const feito = feitos.has(p.id);
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i > 0 && "border-t border-foreground/[0.06]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/25 text-transparent hover:border-brand-purple",
                  )}
                  aria-label={feito ? "Desmarcar" : "Marcar"}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </button>
                <span
                  className={cn(
                    "flex-1 text-base",
                    feito ? "text-foreground/40 line-through" : "text-foreground",
                  )}
                >
                  {p.label}
                </span>
                <span className="flex gap-1">
                  <MiniReorder dir={-1} onClick={() => onMover(i, -1)} disabled={i === 0} />
                  <MiniReorder dir={1} onClick={() => onMover(i, 1)} disabled={i === passos.length - 1} />
                </span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-purple hover:text-brand-purple-dark"
        >
          <Plus className="size-4" /> Adicionar item
        </button>
        <p className="text-xs text-muted-foreground">
          {feitosCount} de {passos.length} concluídos — sem nota, sem prêmio. Só dá pra
          ver o que já rolou.
        </p>
      </div>
    </section>
  );
}

function BotaoSec({
  icone: Icon,
  children,
  onClick,
}: {
  icone: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
    >
      <Icon className="size-3.5" /> {children}
    </button>
  );
}

function MiniReorder({
  dir,
  onClick,
  disabled,
}: {
  dir: -1 | 1;
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = dir === -1 ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Subir" : "Descer"}
      className="inline-flex size-6 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
