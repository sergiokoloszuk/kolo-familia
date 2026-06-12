"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  Bath,
  Bed,
  BookOpen,
  Car,
  Check,
  Circle,
  Gamepad2,
  Hotel,
  IceCreamCone,
  Music,
  Paintbrush,
  Pencil,
  Plane,
  Plus,
  Printer,
  RotateCcw,
  School,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  Wand2,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  adicionarTarefa,
  excluirRotina,
  excluirTarefa,
  gerarCardsVisuais,
  renomearRotina,
  reordenarTarefas,
  resetarRotina,
  toggleTarefa,
} from "../actions";

type CardsStatus = "nenhum" | "gerando" | "pronto" | "erro";

/** Ícones curados pros passos visuais. A chave é guardada em rotina_tarefas.icone. */
const ICONES: Record<string, LucideIcon> = {
  aviao: Plane,
  carro: Car,
  praia: Waves,
  sol: Sun,
  sorvete: IceCreamCone,
  compras: ShoppingBag,
  hotel: Hotel,
  comida: Utensils,
  dormir: Bed,
  banho: Bath,
  roupa: Shirt,
  mochila: Backpack,
  livro: BookOpen,
  brincar: Gamepad2,
  musica: Music,
  pintar: Paintbrush,
  escola: School,
};
const ICONE_KEYS = Object.keys(ICONES);
function IconeDe(k: string | null | undefined): LucideIcon {
  return (k && ICONES[k]) || Circle;
}

type Tarefa = {
  id: string;
  texto: string;
  icone: string | null;
  concluida: boolean;
  nomeTematico: string | null;
  imagemUrl: string | null;
};

export function RotinaEditor({
  rotinaId,
  nomeInicial,
  idade,
  tema,
  historia,
  cardsStatus,
  tarefasIniciais,
}: {
  rotinaId: string;
  nomeInicial: string;
  idade: number | null;
  tema: string | null;
  historia: string | null;
  cardsStatus: CardsStatus;
  tarefasIniciais: Tarefa[];
}) {
  const router = useRouter();
  const visual = idade == null || idade < 13; // criança = cartões; 13+ = checklist

  // Enquanto gera os cards em segundo plano, faz polling até virar pronto/erro.
  useEffect(() => {
    if (cardsStatus !== "gerando") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [cardsStatus, router]);
  const [nome, setNome] = useState(nomeInicial);
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [, start] = useTransition();

  function setErroFrom(r: { ok: boolean; error?: string }) {
    if (!r.ok && r.error) setErro(r.error);
  }

  function toggle(id: string) {
    const alvo = tarefas.find((t) => t.id === id);
    if (!alvo) return;
    const novo = !alvo.concluida;
    setTarefas((ts) => ts.map((t) => (t.id === id ? { ...t, concluida: novo } : t)));
    start(async () => setErroFrom(await toggleTarefa({ rotinaId, tarefaId: id, concluida: novo })));
  }

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= tarefas.length) return;
    const copia = tarefas.slice();
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setTarefas(copia);
    start(async () =>
      setErroFrom(await reordenarTarefas({ rotinaId, ordemIds: copia.map((t) => t.id) })),
    );
  }

  function remover(id: string) {
    setTarefas((ts) => ts.filter((t) => t.id !== id));
    start(async () => setErroFrom(await excluirTarefa({ rotinaId, tarefaId: id })));
  }

  function adicionar(texto: string, icone: string | null) {
    start(async () => {
      const r = await adicionarTarefa({ rotinaId, texto, icone });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setTarefas((ts) => [
        ...ts,
        { id: r.tarefaId, texto, icone, concluida: false, nomeTematico: null, imagemUrl: null },
      ]);
    });
  }

  function resetar() {
    setTarefas((ts) => ts.map((t) => ({ ...t, concluida: false })));
    start(async () => setErroFrom(await resetarRotina({ rotinaId })));
  }

  function salvarNome(novo: string) {
    const n = novo.trim();
    if (!n || n === nome) return;
    setNome(n);
    start(async () => setErroFrom(await renomearRotina({ rotinaId, nome: n })));
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <CabecalhoRotina
        nome={nome}
        onRename={salvarNome}
        onReset={resetar}
        visual={visual}
        rotinaId={rotinaId}
      />

      {cardsStatus === "gerando" && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/50 px-4 py-3 text-sm text-brand-purple-dark print:hidden">
          <Sparkles className="size-4 animate-pulse" aria-hidden />
          Montando os cards ilustrados e a história… leva ~1-2 min, a tela atualiza sozinha.
        </div>
      )}
      {cardsStatus === "erro" && (
        <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          Algo falhou ao montar os cards. Dá pra tentar de novo abaixo.
        </p>
      )}

      {historia && <HistoriaPanel historia={historia} />}

      {!visual && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
          <Smartphone className="size-3.5" /> Dá pra abrir no celular dele(a) e ir marcando.
        </p>
      )}

      {visual ? (
        <ViewCartoes tarefas={tarefas} onToggle={toggle} onMover={mover} onRemover={remover} />
      ) : (
        <ViewChecklist tarefas={tarefas} onToggle={toggle} onMover={mover} onRemover={remover} />
      )}

      <AddTarefa visual={visual} onAdd={adicionar} />

      {visual && cardsStatus !== "gerando" && (
        <GerarCards rotinaId={rotinaId} temaInicial={tema} jaTem={cardsStatus === "pronto"} />
      )}

      <p className="text-xs text-muted-foreground print:hidden">
        Marcar é só pra acompanhar o que já passou — ajuda na previsibilidade e na
        autonomia.
      </p>
    </div>
  );
}

function CabecalhoRotina({
  nome,
  onRename,
  onReset,
  visual,
  rotinaId,
}: {
  nome: string;
  onRename: (n: string) => void;
  onReset: () => void;
  visual: boolean;
  rotinaId: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editando ? (
          <Input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              onRename(valor);
              setEditando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(valor);
                setEditando(false);
              }
            }}
            className="max-w-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setValor(nome);
              setEditando(true);
            }}
            className="group inline-flex items-center gap-2 text-left"
          >
            <h1 className="font-heading text-2xl text-foreground md:text-3xl">{nome}</h1>
            <Pencil className="size-3.5 text-foreground/30 transition-colors group-hover:text-foreground/60" />
          </button>
        )}
        <div className="flex gap-2 print:hidden">
          {visual && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
            >
              <Printer className="size-3.5" /> Imprimir
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
          >
            <RotateCcw className="size-3.5" /> Recomeçar
          </button>
        </div>
      </div>

      <div className="flex justify-end print:hidden">
        {confirmaExcluir ? (
          <span className="inline-flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Excluir esta rotina?</span>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await excluirRotina({ rotinaId });
                  if (r.ok) router.push("/ludico/rotinas");
                })
              }
              className="font-semibold text-destructive hover:underline"
            >
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmaExcluir(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmaExcluir(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Excluir rotina
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Cartões visuais (criança) ---------- */
function ViewCartoes({
  tarefas,
  onToggle,
  onMover,
  onRemover,
}: {
  tarefas: Tarefa[];
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  if (tarefas.length === 0) return <Vazio />;
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
      {tarefas.map((t, i) => {
        const Icon = IconeDe(t.icone);
        return (
          <li key={t.id} className="group relative print:break-inside-avoid">
            <button
              type="button"
              onClick={() => onToggle(t.id)}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-3xl border-2 p-5 text-center transition-all",
                t.concluida
                  ? "border-foreground/10 bg-foreground/[0.03] opacity-60"
                  : "border-brand-purple/15 bg-white hover:border-brand-purple/40",
              )}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {i + 1}º
              </span>
              {t.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.imagemUrl}
                  alt={t.texto}
                  className={cn(
                    "aspect-square w-full rounded-2xl object-cover",
                    t.concluida && "opacity-50 grayscale",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "flex size-20 items-center justify-center rounded-2xl",
                    t.concluida ? "bg-foreground/5 text-foreground/40" : "bg-brand-yellow/20 text-[#8B5A00]",
                  )}
                >
                  <Icon className="size-10" strokeWidth={1.6} />
                </span>
              )}
              <span
                className={cn(
                  "leading-snug",
                  t.nomeTematico
                    ? "text-base font-bold uppercase tracking-wide"
                    : "text-base font-medium",
                  t.concluida ? "text-foreground/40 line-through" : "text-foreground",
                )}
              >
                {t.nomeTematico ?? t.texto}
              </span>
              {t.nomeTematico && (
                <span className={cn("text-xs", t.concluida ? "text-foreground/30" : "text-muted-foreground")}>
                  {t.texto}
                </span>
              )}
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                  t.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/20 text-transparent",
                )}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            </button>
            <div className="mt-1.5 flex justify-center gap-1 print:hidden">
              <Mini icone={ArrowUp} onClick={() => onMover(i, -1)} disabled={i === 0} label="Subir" />
              <Mini icone={ArrowDown} onClick={() => onMover(i, 1)} disabled={i === tarefas.length - 1} label="Descer" />
              <Mini icone={X} onClick={() => onRemover(t.id)} disabled={false} label="Remover" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Checklist (adolescente/adulto) ---------- */
function ViewChecklist({
  tarefas,
  onToggle,
  onMover,
  onRemover,
}: {
  tarefas: Tarefa[];
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  if (tarefas.length === 0) return <Vazio />;
  return (
    <ul className="flex flex-col rounded-3xl border border-foreground/10 bg-white px-5 sm:max-w-md">
      {tarefas.map((t, i) => (
        <li
          key={t.id}
          className={cn("flex items-center gap-3 py-3", i > 0 && "border-t border-foreground/[0.06]")}
        >
          <button
            type="button"
            onClick={() => onToggle(t.id)}
            aria-label={t.concluida ? "Desmarcar" : "Marcar"}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              t.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/25 text-transparent hover:border-brand-purple",
            )}
          >
            <Check className="size-3.5" strokeWidth={3} />
          </button>
          <span className={cn("flex-1 text-base", t.concluida ? "text-foreground/40 line-through" : "text-foreground")}>
            {t.texto}
          </span>
          <span className="flex gap-1 print:hidden">
            <Mini icone={ArrowUp} onClick={() => onMover(i, -1)} disabled={i === 0} label="Subir" />
            <Mini icone={ArrowDown} onClick={() => onMover(i, 1)} disabled={i === tarefas.length - 1} label="Descer" />
            <Mini icone={X} onClick={() => onRemover(t.id)} disabled={false} label="Remover" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Vazio() {
  return (
    <p className="rounded-2xl border border-dashed border-foreground/15 px-5 py-8 text-center text-sm text-muted-foreground">
      Ainda sem passos. Adicione o primeiro abaixo.
    </p>
  );
}

function AddTarefa({
  visual,
  onAdd,
}: {
  visual: boolean;
  onAdd: (texto: string, icone: string | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [icone, setIcone] = useState<string | null>(null);

  function add() {
    const t = texto.trim();
    if (!t) return;
    onAdd(t, visual ? icone : null);
    setTexto("");
    setIcone(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4 print:hidden">
      <div className="flex gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo passo (ex.: praia, sorveteria…)"
        />
        <Button type="button" onClick={add} disabled={!texto.trim()}>
          <Plus className="size-4" aria-hidden /> Adicionar
        </Button>
      </div>
      {visual && (
        <div className="flex flex-wrap gap-1.5">
          {ICONE_KEYS.map((k) => {
            const Icon = ICONES[k];
            const sel = icone === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setIcone(sel ? null : k)}
                aria-label={k}
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl border transition-colors",
                  sel
                    ? "border-brand-purple bg-brand-yellow/25 text-[#8B5A00]"
                    : "border-foreground/10 bg-white text-foreground/50 hover:border-brand-purple/30",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({
  icone: Icon,
  onClick,
  disabled,
  label,
}: {
  icone: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-6 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function HistoriaPanel({ historia }: { historia: string }) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="rounded-2xl border border-brand-yellow/40 bg-brand-yellow/[0.07] p-4">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center gap-2 text-left print:hidden"
      >
        <BookOpen className="size-4 text-[#8B5A00]" aria-hidden />
        <span className="font-heading text-base font-medium text-foreground">A história da rotina</span>
        <span className="ml-auto text-xs text-muted-foreground">{aberto ? "ocultar" : "ler"}</span>
      </button>
      {aberto && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {historia}
        </p>
      )}
    </div>
  );
}

function GerarCards({
  rotinaId,
  temaInicial,
  jaTem,
}: {
  rotinaId: string;
  temaInicial: string | null;
  jaTem: boolean;
}) {
  const router = useRouter();
  const [tema, setTema] = useState(temaInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    const t = tema.trim();
    if (!t || pending) return;
    setErro(null);
    start(async () => {
      const r = await gerarCardsVisuais({ rotinaId, tema: t });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4 print:hidden">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-[#8B5A00]">
          <Wand2 className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="font-heading text-base font-medium text-foreground">
            {jaTem ? "Refazer os cards visuais" : "Gerar cards visuais"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Escolha um tema — a Kolo escreve uma historinha e ilustra cada passo com um
            personagem do tema (o mesmo em todos). Suas atividades e a ordem não mudam.
          </p>
          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && gerar()}
              placeholder="Tema (ex.: carros, dinossauros, espaço…)"
              className="max-w-xs"
              disabled={pending}
            />
            <Button type="button" onClick={gerar} disabled={pending || !tema.trim()}>
              {pending ? (
                <>
                  <Sparkles className="size-4 animate-pulse" aria-hidden /> Iniciando…
                </>
              ) : (
                <>
                  <Wand2 className="size-4" aria-hidden /> {jaTem ? "Refazer" : "Gerar"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
