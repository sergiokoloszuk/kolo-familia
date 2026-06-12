"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DURACOES = [5, 10, 15, 20, 30];
const DEPOIS_SUGESTOES = ["jantar", "dormir", "tomar banho", "guardar os brinquedos", "ir pra escola"];

// 7 cores do arco-íris, da mais externa (vermelha) pra mais interna (violeta).
const CORES = ["#e23b3b", "#ef8a2b", "#f2c200", "#3fae5a", "#3b86d8", "#5a5fd8", "#9a55d6"];

type Fase = "setup" | "antecipacao" | "rodando" | "pausado" | "fim";
type TemaKey = "arco_iris" | "lagarta" | "piscina";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Quantas ETAPAS visíveis pro tempo escolhido. Mais tempo = mais etapas
 * (não "a mesma coisa mais lenta"): a história ganha mais marcos pra criança
 * acompanhar ao longo da espera maior.
 */
function nEtapasPara(duracaoMin: number, max: number): number {
  const n = Math.round(3 + duracaoMin * 0.42); // 5→5 · 10→7 · 15→9 · 20→11 · 30→16
  return Math.max(3, Math.min(max, n));
}

/** Valor da história (0→1) em passos DISCRETOS — o nº de passos = nEtapas. */
function story(progresso: number, nEtapas: number): number {
  if (nEtapas <= 1) return progresso >= 1 ? 1 : 0;
  const step = Math.min(nEtapas - 1, Math.floor(progresso * nEtapas));
  return step / (nEtapas - 1);
}

type CenaProps = { progresso: number; nEtapas: number };

type Tema = {
  label: string;
  emoji: string;
  maxEtapas: number;
  /** Explicação pra quem cuida, no setup. */
  comoUsar: (depois: string) => string;
  /** Frase do "combinado" na antecipação. */
  antecipacao: (depois: string) => React.ReactNode;
  /** Narração durante a contagem. */
  narracao: (progresso: number) => string;
  tituloFim: string;
  Cena: (p: CenaProps) => React.ReactNode;
};

export function TimerClient() {
  const [fase, setFase] = useState<Fase>("setup");
  const [duracaoMin, setDuracaoMin] = useState(10);
  const [depois, setDepois] = useState("");
  const [tema, setTema] = useState<TemaKey>("arco_iris");

  const totalMs = duracaoMin * 60 * 1000;

  const [elapsed, setElapsed] = useState(0);
  const inicioRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (fase !== "rodando") return;
    const id = setInterval(() => {
      const agora = Date.now();
      const inicio = inicioRef.current ?? agora;
      const e = baseRef.current + (agora - inicio);
      if (e >= totalMs) {
        setElapsed(totalMs);
        setFase("fim");
      } else {
        setElapsed(e);
      }
    }, 200);
    return () => clearInterval(id);
  }, [fase, totalMs]);

  function comecar() {
    setElapsed(0);
    baseRef.current = 0;
    inicioRef.current = Date.now();
    setFase("rodando");
  }
  function pausar() {
    const agora = Date.now();
    baseRef.current += agora - (inicioRef.current ?? agora);
    setFase("pausado");
  }
  function continuar() {
    inicioRef.current = Date.now();
    setFase("rodando");
  }
  function recomecar() {
    setElapsed(0);
    baseRef.current = 0;
    inicioRef.current = Date.now();
    setFase("rodando");
  }
  function voltarSetup() {
    setElapsed(0);
    baseRef.current = 0;
    inicioRef.current = null;
    setFase("setup");
  }

  const t = TEMAS[tema];
  const nEtapas = nEtapasPara(duracaoMin, t.maxEtapas);
  const progresso = Math.min(elapsed / totalMs, 1);
  const restanteMs = Math.max(totalMs - elapsed, 0);
  const depoisTxt = depois.trim() || "a próxima atividade";

  if (fase === "setup") {
    return (
      <Setup
        duracaoMin={duracaoMin}
        setDuracaoMin={setDuracaoMin}
        depois={depois}
        setDepois={setDepois}
        tema={tema}
        setTema={setTema}
        onAvancar={() => setFase("antecipacao")}
      />
    );
  }

  if (fase === "antecipacao") {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 p-8 text-center">
        <t.Cena progresso={0} nEtapas={nEtapas} />
        <div>
          <p className="font-heading text-xl text-foreground md:text-2xl">
            {t.antecipacao(depoisTxt)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            São {duracaoMin} minutos. As etapas vão aparecendo uma a uma — quando o desenho
            ficar completo, o tempo acabou.
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" onClick={comecar} size="lg">
            <Play className="size-4" aria-hidden /> Começar
          </Button>
          <button
            type="button"
            onClick={voltarSetup}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (fase === "fim") {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 p-10 text-center">
        <div className="relative">
          <t.Cena progresso={1} nEtapas={nEtapas} />
          <span aria-hidden className="absolute -right-1 top-0 animate-pulse text-2xl">
            ✨
          </span>
        </div>
        <div>
          <p className="font-heading text-2xl text-foreground md:text-3xl">
            {t.tituloFim} {t.emoji}
          </p>
          <p className="mt-4 font-heading text-xl text-brand-purple">
            Agora é hora de {depoisTxt}.
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={recomecar}>
            <RotateCcw className="size-4" aria-hidden /> De novo
          </Button>
          <Button type="button" onClick={voltarSetup}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // rodando | pausado
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-lg text-foreground">
            {t.emoji} {t.label}
          </p>
          <p className="text-sm text-muted-foreground">
            Depois: <span className="font-medium text-foreground">{depoisTxt}</span>
          </p>
        </div>
        <span className="font-heading text-2xl tabular-nums text-foreground">
          {formatar(restanteMs)}
        </span>
      </div>

      <div className="flex items-center justify-center rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 px-6 py-8">
        <t.Cena progresso={progresso} nEtapas={nEtapas} />
      </div>

      <p className="text-center font-heading text-lg text-foreground">{t.narracao(progresso)}</p>

      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-brand-purple transition-all duration-200 ease-linear"
          style={{ width: `${progresso * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        {fase === "rodando" ? (
          <Button type="button" variant="outline" onClick={pausar}>
            <Pause className="size-4" aria-hidden /> Pausar
          </Button>
        ) : (
          <Button type="button" onClick={continuar}>
            <Play className="size-4" aria-hidden /> Continuar
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={recomecar}>
          <RotateCcw className="size-4" aria-hidden /> Recomeçar
        </Button>
        <button
          type="button"
          onClick={voltarSetup}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Trocar
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Cenas (filminhos)
// ============================================================

/** Arco-íris que se forma: cada cor aparece na sua fatia do tempo. */
function ArcoIris({ progresso }: CenaProps) {
  const n = CORES.length;
  return (
    <svg viewBox="0 0 200 118" className="w-full max-w-md" role="img" aria-label="Arco-íris se formando">
      {CORES.map((cor, i) => {
        const r = 90 - i * 11;
        const slice = 1 / n;
        const op = clamp01((progresso - i * slice) / slice);
        return (
          <path
            key={i}
            d={`M ${100 - r},100 A ${r},${r} 0 0 1 ${100 + r},100`}
            fill="none"
            stroke={cor}
            strokeWidth={9}
            strokeLinecap="round"
            opacity={op}
            style={{ transition: "opacity 350ms linear" }}
          />
        );
      })}
      <ellipse cx="38" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
      <ellipse cx="162" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
    </svg>
  );
}

/** Lagarta que vira borboleta: corpo → asas (cor por cor) → antena por último. */
function LagartaBorboleta({ progresso, nEtapas }: CenaProps) {
  const s = story(progresso, nEtapas);
  const cx = 100;
  const cy = 70;

  const lagartaOp = clamp01((0.32 - s) / 0.12); // some até ~0.32
  const casuloOp = s < 0.2 ? clamp01((s - 0.12) / 0.08) : clamp01((0.52 - s) / 0.12);
  const corpoOp = clamp01((s - 0.42) / 0.08);
  const asas = clamp01((s - 0.5) / 0.4); // 0→1 conforme as asas abrem
  const coresOp = clamp01((s - 0.78) / 0.12);
  const antenaOp = s >= 0.96 ? 1 : 0; // a ÚLTIMA coisa a aparecer

  const trans = { transition: "opacity 400ms linear" } as const;

  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-md" role="img" aria-label="Lagarta virando borboleta">
      {/* folhinha de apoio */}
      <ellipse cx={cx} cy={120} rx="60" ry="10" fill="#cdeacb" opacity="0.7" />

      {/* Lagarta */}
      <g opacity={lagartaOp} style={trans}>
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={72 + i * 14} cy={108 - (i === 4 ? 4 : 0)} r="11" fill="#6fbf57" stroke="#4e9b3c" strokeWidth="1.5" />
        ))}
        <circle cx={128} cy={102} r="2.2" fill="#1b3a18" />
        <path d="M 124 108 q 5 4 10 0" fill="none" stroke="#1b3a18" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="128" y1="94" x2="132" y2="86" stroke="#4e9b3c" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="132" y1="94" x2="137" y2="87" stroke="#4e9b3c" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* Casulo */}
      <g opacity={casuloOp} style={trans}>
        <path d={`M ${cx} 48 q 20 18 12 46 q -12 18 -24 0 q -8 -28 12 -46 z`} fill="#caa46a" stroke="#a9854b" strokeWidth="1.5" />
        <line x1={cx - 6} y1="62" x2={cx + 6} y2="70" stroke="#a9854b" strokeWidth="1.2" />
        <line x1={cx - 6} y1="76" x2={cx + 6} y2="84" stroke="#a9854b" strokeWidth="1.2" />
      </g>

      {/* Borboleta */}
      <g opacity={corpoOp} style={trans}>
        {/* asas (escalam a partir do corpo) */}
        <g style={{ transform: `translate(${cx}px, ${cy}px) scale(${asas})`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 450ms ease-out" }}>
          <g transform={`translate(${-cx}, ${-cy})`}>
            <ellipse cx={cx - 26} cy={cy - 12} rx="24" ry="18" fill="#f2a23b" stroke="#d98428" strokeWidth="1.5" />
            <ellipse cx={cx + 26} cy={cy - 12} rx="24" ry="18" fill="#f2a23b" stroke="#d98428" strokeWidth="1.5" />
            <ellipse cx={cx - 22} cy={cy + 16} rx="19" ry="15" fill="#7c64d6" stroke="#5f49b3" strokeWidth="1.5" />
            <ellipse cx={cx + 22} cy={cy + 16} rx="19" ry="15" fill="#7c64d6" stroke="#5f49b3" strokeWidth="1.5" />
            {/* cores/pintinhas */}
            <g opacity={coresOp} style={trans}>
              <circle cx={cx - 26} cy={cy - 12} r="5" fill="#fff2c4" />
              <circle cx={cx + 26} cy={cy - 12} r="5" fill="#fff2c4" />
              <circle cx={cx - 22} cy={cy + 16} r="3.5" fill="#d7ccff" />
              <circle cx={cx + 22} cy={cy + 16} r="3.5" fill="#d7ccff" />
            </g>
          </g>
        </g>
        {/* corpo */}
        <ellipse cx={cx} cy={cy} rx="6" ry="26" fill="#43306b" />
        <circle cx={cx} cy={cy - 24} r="6.5" fill="#43306b" />
        {/* antena (por último) */}
        <g opacity={antenaOp} style={trans}>
          <path d={`M ${cx - 2} ${cy - 29} q -8 -10 -14 -12`} fill="none" stroke="#43306b" strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${cx + 2} ${cy - 29} q 8 -10 14 -12`} fill="none" stroke="#43306b" strokeWidth="2" strokeLinecap="round" />
          <circle cx={cx - 16} cy={cy - 41} r="2.6" fill="#f2c200" />
          <circle cx={cx + 16} cy={cy - 41} r="2.6" fill="#f2c200" />
        </g>
      </g>
    </svg>
  );
}

/** Vamos nadar: a criança se equipa (touca, óculos, boia, protetor) e mergulha. */
function Piscina({ progresso, nEtapas }: CenaProps) {
  const s = story(progresso, nEtapas);
  const toucaOp = clamp01((s - 0.16) / 0.08);
  const oculosOp = clamp01((s - 0.34) / 0.08);
  const boiaOp = clamp01((s - 0.52) / 0.08);
  const protetorOp = clamp01((s - 0.7) / 0.08);
  const mergulho = clamp01((s - 0.86) / 0.14); // 0→1 entra na água
  const trans = { transition: "opacity 400ms linear" } as const;

  const cx = 100;
  const baseY = 96;
  const dive = mergulho * 18; // desce um pouco ao mergulhar

  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-md" role="img" aria-label="Se preparando pra nadar">
      {/* sol */}
      <g opacity={protetorOp} style={trans}>
        <circle cx="168" cy="26" r="13" fill="#ffd23f" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={168 + Math.cos((a * Math.PI) / 180) * 17}
            y1={26 + Math.sin((a * Math.PI) / 180) * 17}
            x2={168 + Math.cos((a * Math.PI) / 180) * 22}
            y2={26 + Math.sin((a * Math.PI) / 180) * 22}
            stroke="#ffd23f"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* água da piscina */}
      <rect x="18" y="106" width="164" height="26" rx="8" fill="#7ec8f2" />
      <path d="M 18 110 q 20 -5 40 0 q 20 5 40 0 q 20 -5 40 0 q 20 5 40 0 v 4 h -160 z" fill="#a6dbf7" opacity="0.7" />

      <g style={{ transform: `translateY(${dive}px)`, transition: "transform 450ms ease-in" }}>
        {/* corpo (maiô) */}
        <ellipse cx={cx} cy={baseY} rx="13" ry="22" fill="#ef6aa6" />
        {/* braços */}
        <line x1={cx - 12} y1={baseY - 6} x2={cx - 24} y2={baseY + 4} stroke="#f4b78d" strokeWidth="5" strokeLinecap="round" />
        <line x1={cx + 12} y1={baseY - 6} x2={cx + 24} y2={baseY + 4} stroke="#f4b78d" strokeWidth="5" strokeLinecap="round" />
        {/* cabeça */}
        <circle cx={cx} cy={baseY - 30} r="14" fill="#f4b78d" />

        {/* touca */}
        <path d={`M ${cx - 14} ${baseY - 30} a 14 14 0 0 1 28 0 z`} fill="#3b86d8" opacity={toucaOp} style={trans} />
        {/* óculos */}
        <g opacity={oculosOp} style={trans}>
          <circle cx={cx - 5} cy={baseY - 30} r="4.2" fill="#bdeaff" stroke="#2f6fb0" strokeWidth="1.5" />
          <circle cx={cx + 5} cy={baseY - 30} r="4.2" fill="#bdeaff" stroke="#2f6fb0" strokeWidth="1.5" />
          <line x1={cx - 1} y1={baseY - 30} x2={cx + 1} y2={baseY - 30} stroke="#2f6fb0" strokeWidth="1.5" />
        </g>
        {/* protetor (bochechas) */}
        <g opacity={protetorOp} style={trans}>
          <circle cx={cx - 7} cy={baseY - 24} r="2.4" fill="#fff" opacity="0.8" />
          <circle cx={cx + 7} cy={baseY - 24} r="2.4" fill="#fff" opacity="0.8" />
        </g>
        {/* sorriso */}
        <path d={`M ${cx - 5} ${baseY - 22} q 5 4 10 0`} fill="none" stroke="#7a4a2b" strokeWidth="1.6" strokeLinecap="round" />

        {/* boia */}
        <g opacity={boiaOp} style={trans}>
          <ellipse cx={cx} cy={baseY + 2} rx="26" ry="12" fill="none" stroke="#ff7a59" strokeWidth="7" />
          <ellipse cx={cx} cy={baseY + 2} rx="26" ry="12" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray="10 14" />
        </g>
      </g>

      {/* respingo ao mergulhar */}
      <g opacity={mergulho} style={trans}>
        {[-18, -8, 8, 18].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={104 - (i % 2 === 0 ? 6 : 12)} r={i % 2 === 0 ? 3 : 2} fill="#cdeefb" />
        ))}
      </g>
    </svg>
  );
}

const TEMAS: Record<TemaKey, Tema> = {
  arco_iris: {
    label: "Arco-íris",
    emoji: "🌈",
    maxEtapas: 7,
    comoUsar: () =>
      "O arco-íris vai ganhando uma cor de cada vez; quando as 7 cores estiverem prontas, o tempo acabou.",
    antecipacao: (depois) => (
      <>
        Quando o arco-íris ficar <span className="text-brand-purple">prontinho</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) => {
      const feitas = Math.floor(p * CORES.length);
      const faltam = CORES.length - feitas;
      if (p > 0.85) return "Quase pronto!";
      if (feitas === 0) return "O arco-íris está começando…";
      return `Falta${faltam === 1 ? "" : "m"} ${faltam} cor${faltam === 1 ? "" : "es"} pro arco-íris ficar pronto`;
    },
    tituloFim: "O arco-íris ficou pronto!",
    Cena: ArcoIris,
  },
  lagarta: {
    label: "Lagarta vira borboleta",
    emoji: "🦋",
    maxEtapas: 8,
    comoUsar: () =>
      "A lagarta se transforma aos poucos: vira casulo, depois nascem as asas (cor por cor) e, por último, as anteninhas — é quando o tempo acaba.",
    antecipacao: (depois) => (
      <>
        Quando a borboleta ganhar as <span className="text-brand-purple">antenas</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) => {
      if (p < 0.3) return "A lagarta está se preparando…";
      if (p < 0.52) return "Virou casulo — espera só um pouquinho…";
      if (p < 0.95) return "A borboleta está abrindo as asas!";
      return "Só falta a antena!";
    },
    tituloFim: "A borboleta ficou pronta!",
    Cena: LagartaBorboleta,
  },
  piscina: {
    label: "Vamos nadar",
    emoji: "🏊",
    maxEtapas: 6,
    comoUsar: () =>
      "A criança vai se preparando pra nadar: coloca a touca, os óculos, a boia, passa protetor — e quando estiver pronta, mergulha. É quando o tempo acaba.",
    antecipacao: (depois) => (
      <>
        Quando ela <span className="text-brand-purple">mergulhar</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) => {
      if (p < 0.34) return "Colocando a touca…";
      if (p < 0.52) return "Pondo os óculos…";
      if (p < 0.7) return "Já está com a boia!";
      if (p < 0.86) return "Passou o protetor — quase lá!";
      return "Hora de mergulhar!";
    },
    tituloFim: "Mergulhou!",
    Cena: Piscina,
  },
};

function formatar(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${m}:${seg.toString().padStart(2, "0")}`;
}

function Setup({
  duracaoMin,
  setDuracaoMin,
  depois,
  setDepois,
  tema,
  setTema,
  onAvancar,
}: {
  duracaoMin: number;
  setDuracaoMin: (n: number) => void;
  depois: string;
  setDepois: (s: string) => void;
  tema: TemaKey;
  setTema: (t: TemaKey) => void;
  onAvancar: () => void;
}) {
  const t = TEMAS[tema];
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.07] px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">
          <strong className="font-semibold">Quem cuida:</strong> escolha o filminho, o tempo
          e o que vem <em className="not-italic">depois</em>, e conte pra criança antes de
          começar. {t.comoUsar(depois)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Qual filminho</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMAS) as TemaKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTema(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                tema === k
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-input bg-white text-foreground hover:border-brand-purple/40",
              )}
            >
              <span aria-hidden>{TEMAS[k].emoji}</span> {TEMAS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Quanto tempo</span>
        <div className="flex flex-wrap gap-2">
          {DURACOES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuracaoMin(d)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                duracaoMin === d
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-input bg-white text-foreground hover:border-brand-purple/40",
              )}
            >
              {d} min
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Mais tempo, mais etapas no filminho — não fica só mais devagar.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          O que vem depois{" "}
          <span className="font-normal text-muted-foreground">(o combinado)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {DEPOIS_SUGESTOES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDepois(d)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                depois === d
                  ? "border-brand-purple bg-kolo-lilas-bg-2 text-brand-purple"
                  : "border-foreground/10 bg-white text-foreground hover:border-brand-purple/30",
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <input
          value={depois}
          onChange={(e) => setDepois(e.target.value)}
          placeholder="ou escreva outro combinado"
          className="mt-1 h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div>
        <Button type="button" size="lg" onClick={onAvancar}>
          Ver o combinado
        </Button>
      </div>
    </div>
  );
}
