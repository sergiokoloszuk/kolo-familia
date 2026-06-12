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

/** Opacidade de um elemento que "pop" em p0 (com janelinha de fade). */
function popAt(progresso: number, p0: number, janela = 0.05): number {
  return clamp01((progresso - p0) / janela);
}

/**
 * Quantos enfeites o filminho ganha — alvo de ~1 elemento novo a cada ~10s,
 * pra NUNCA ficar parado. Escala com o tempo (mais minutos = mais enfeites),
 * em vez de "a mesma coisa mais lenta".
 */
function nEnfeites(duracaoMin: number): number {
  return Math.max(14, Math.min(80, Math.round(duracaoMin * 6)));
}

type CenaProps = { progresso: number; duracaoMin: number };

type Tema = {
  label: string;
  emoji: string;
  comoUsar: () => string;
  antecipacao: (depois: string) => React.ReactNode;
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
        <t.Cena progresso={0.02} duracaoMin={duracaoMin} />
        <div>
          <p className="font-heading text-xl text-foreground md:text-2xl">
            {t.antecipacao(depoisTxt)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            São {duracaoMin} minutos. O desenho vai ganhando detalhes o tempo todo — quando
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
          <t.Cena progresso={1} duracaoMin={duracaoMin} />
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
        <t.Cena progresso={progresso} duracaoMin={duracaoMin} />
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
// Enfeites procedurais (jardim que floresce) — surgem ao longo do tempo,
// um a cada ~10s, pra nunca ficar parado. Posições determinísticas (sem
// random), então não "pulam" entre renders.
// ============================================================

const PALETA_FLOR = ["#ef6aa6", "#f2a23b", "#9a55d6", "#3fae5a", "#3b86d8", "#e23b3b"];

function Flor({ x, y, op, cor }: { x: number; y: number; op: number; cor: string }) {
  if (op <= 0) return null;
  return (
    <g opacity={op} style={{ transition: "opacity 500ms ease-out" }}>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle
          key={a}
          cx={x + Math.cos((a * Math.PI) / 180) * 4.2}
          cy={y + Math.sin((a * Math.PI) / 180) * 4.2}
          r="3.1"
          fill={cor}
        />
      ))}
      <circle cx={x} cy={y} r="2.6" fill="#fff2c4" />
    </g>
  );
}

function Brilho({ x, y, op }: { x: number; y: number; op: number }) {
  if (op <= 0) return null;
  return (
    <g opacity={op} style={{ transition: "opacity 500ms ease-out" }}>
      <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke="#ffe08a" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke="#ffe08a" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/** Jardim de flores (base) + brilhos (espalhados) que vão surgindo no tempo. */
function Jardim({ progresso, duracaoMin }: CenaProps) {
  const n = nEnfeites(duracaoMin);
  const itens = [];
  for (let i = 0; i < n; i++) {
    const op = popAt(progresso, 0.02 + (i / n) * 0.95);
    if (op <= 0) continue;
    const fx = 12 + (((i * 61) % 100) / 100) * 176;
    if (i % 2 === 0) {
      const fy = 116 + ((i * 29) % 14);
      itens.push(<Flor key={i} x={fx} y={fy} op={op} cor={PALETA_FLOR[i % PALETA_FLOR.length]} />);
    } else {
      const fy = 20 + ((i * 47) % 86);
      itens.push(<Brilho key={i} x={fx} y={fy} op={op} />);
    }
  }
  return <>{itens}</>;
}

// ============================================================
// Cenas (filminhos)
// ============================================================

/** Arco-íris que se DESENHA faixa por faixa (não só fade) + brilhos surgindo. */
function ArcoIris({ progresso, duracaoMin }: CenaProps) {
  const n = CORES.length;
  return (
    <svg viewBox="0 0 200 134" className="w-full max-w-md" role="img" aria-label="Arco-íris se formando">
      <Jardim progresso={progresso} duracaoMin={duracaoMin} />
      {CORES.map((cor, i) => {
        const r = 90 - i * 11;
        const slice = 1 / n;
        const draw = clamp01((progresso - i * slice) / slice); // 0→1: desenha a faixa
        return (
          <path
            key={i}
            d={`M ${100 - r},100 A ${r},${r} 0 0 1 ${100 + r},100`}
            fill="none"
            stroke={cor}
            strokeWidth={9}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            opacity={draw > 0 ? 1 : 0}
            style={{ transition: "stroke-dashoffset 300ms linear" }}
          />
        );
      })}
      <ellipse cx="38" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
      <ellipse cx="162" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
    </svg>
  );
}

// Pintinhas que vão "trabalhando" a asa da borboleta ao longo do tempo.
const ASA_SPOTS: Array<{ x: number; y: number; r: number; c: string }> = [
  { x: 74, y: 54, r: 5, c: "#fff2c4" },
  { x: 126, y: 54, r: 5, c: "#fff2c4" },
  { x: 66, y: 49, r: 3, c: "#ffd98a" },
  { x: 134, y: 49, r: 3, c: "#ffd98a" },
  { x: 80, y: 61, r: 2.6, c: "#fff" },
  { x: 120, y: 61, r: 2.6, c: "#fff" },
  { x: 78, y: 83, r: 4, c: "#d7ccff" },
  { x: 122, y: 83, r: 4, c: "#d7ccff" },
  { x: 72, y: 87, r: 2.4, c: "#fff" },
  { x: 128, y: 87, r: 2.4, c: "#fff" },
  { x: 58, y: 56, r: 2, c: "#ffd98a" },
  { x: 142, y: 56, r: 2, c: "#ffd98a" },
  { x: 64, y: 92, r: 2, c: "#d7ccff" },
  { x: 136, y: 92, r: 2, c: "#d7ccff" },
];

/** Lagarta → casulo → borboleta, com a asa sendo "trabalhada" peça por peça. */
function LagartaBorboleta({ progresso, duracaoMin }: CenaProps) {
  const p = progresso;
  const cx = 100;
  const cy = 66;

  const lagartaOp = clamp01((0.16 - p) / 0.06);
  const casuloOp = p < 0.12 ? clamp01((p - 0.06) / 0.05) : clamp01((0.28 - p) / 0.06);
  const corpoOp = clamp01((p - 0.24) / 0.05);
  const asaScale = clamp01((p - 0.26) / 0.2); // asas crescem do corpo
  const antenaOp = p >= 0.96 ? 1 : 0; // a ÚLTIMA coisa
  const trans = { transition: "opacity 450ms linear" } as const;

  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-md" role="img" aria-label="Lagarta virando borboleta">
      <ellipse cx={cx} cy={124} rx="64" ry="9" fill="#cdeacb" opacity="0.6" />
      <Jardim progresso={progresso} duracaoMin={duracaoMin} />

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
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={cx - 6}
            y1={58 + i * 8}
            x2={cx + 6}
            y2={62 + i * 8}
            stroke="#a9854b"
            strokeWidth="1.2"
            opacity={popAt(p, 0.13 + i * 0.025)}
            style={trans}
          />
        ))}
      </g>

      {/* Borboleta */}
      <g opacity={corpoOp} style={trans}>
        <g
          style={{
            transform: `translate(${cx}px,${cy}px) scale(${asaScale}) translate(${-cx}px,${-cy}px)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 500ms ease-out",
          }}
        >
          <ellipse cx={cx - 26} cy={cy - 12} rx="24" ry="18" fill="#f2a23b" stroke="#d98428" strokeWidth="1.5" />
          <ellipse cx={cx + 26} cy={cy - 12} rx="24" ry="18" fill="#f2a23b" stroke="#d98428" strokeWidth="1.5" />
          <ellipse cx={cx - 22} cy={cy + 16} rx="19" ry="15" fill="#7c64d6" stroke="#5f49b3" strokeWidth="1.5" />
          <ellipse cx={cx + 22} cy={cy + 16} rx="19" ry="15" fill="#7c64d6" stroke="#5f49b3" strokeWidth="1.5" />
          {/* a asa vai sendo "trabalhada": cada pintinha aparece no seu tempo */}
          {ASA_SPOTS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={s.c}
              opacity={popAt(p, 0.46 + (i / ASA_SPOTS.length) * 0.46)}
              style={trans}
            />
          ))}
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

/** Vamos nadar: a criança se equipa aos poucos, com bolhas subindo o tempo todo. */
function Piscina({ progresso, duracaoMin }: CenaProps) {
  const p = progresso;
  const toucaOp = popAt(p, 0.16);
  const oculosOp = popAt(p, 0.34);
  const boiaOp = popAt(p, 0.52);
  const protetorOp = popAt(p, 0.7);
  const mergulho = clamp01((p - 0.86) / 0.14);
  const trans = { transition: "opacity 450ms linear" } as const;

  const cx = 100;
  const baseY = 92;
  const dive = mergulho * 18;

  // bolhas subindo (enfeites) — uma nova a cada ~10s
  const n = nEnfeites(duracaoMin);
  const bolhas = [];
  for (let i = 0; i < n; i++) {
    const op = popAt(p, 0.04 + (i / n) * 0.92);
    if (op <= 0) continue;
    const bx = 24 + (((i * 53) % 100) / 100) * 152;
    const sobe = ((i * 37) % 30);
    bolhas.push(
      <circle key={i} cx={bx} cy={120 - sobe} r={1.6 + (i % 3)} fill="#cdeefb" opacity={op * 0.9} style={trans} />,
    );
  }

  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-md" role="img" aria-label="Se preparando pra nadar">
      {/* sol */}
      <g opacity={protetorOp} style={trans}>
        <circle cx="170" cy="24" r="12" fill="#ffd23f" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={170 + Math.cos((a * Math.PI) / 180) * 16}
            y1={24 + Math.sin((a * Math.PI) / 180) * 16}
            x2={170 + Math.cos((a * Math.PI) / 180) * 21}
            y2={24 + Math.sin((a * Math.PI) / 180) * 21}
            stroke="#ffd23f"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* água */}
      <rect x="16" y="104" width="168" height="32" rx="8" fill="#7ec8f2" />
      <path d="M 16 108 q 21 -5 42 0 q 21 5 42 0 q 21 -5 42 0 q 21 5 42 0 v 6 h -168 z" fill="#a6dbf7" opacity="0.7" />
      {bolhas}

      <g style={{ transform: `translateY(${dive}px)`, transition: "transform 500ms ease-in" }}>
        <ellipse cx={cx} cy={baseY} rx="13" ry="22" fill="#ef6aa6" />
        <line x1={cx - 12} y1={baseY - 6} x2={cx - 24} y2={baseY + 4} stroke="#f4b78d" strokeWidth="5" strokeLinecap="round" />
        <line x1={cx + 12} y1={baseY - 6} x2={cx + 24} y2={baseY + 4} stroke="#f4b78d" strokeWidth="5" strokeLinecap="round" />
        <circle cx={cx} cy={baseY - 30} r="14" fill="#f4b78d" />
        <path d={`M ${cx - 14} ${baseY - 30} a 14 14 0 0 1 28 0 z`} fill="#3b86d8" opacity={toucaOp} style={trans} />
        <g opacity={oculosOp} style={trans}>
          <circle cx={cx - 5} cy={baseY - 30} r="4.2" fill="#bdeaff" stroke="#2f6fb0" strokeWidth="1.5" />
          <circle cx={cx + 5} cy={baseY - 30} r="4.2" fill="#bdeaff" stroke="#2f6fb0" strokeWidth="1.5" />
          <line x1={cx - 1} y1={baseY - 30} x2={cx + 1} y2={baseY - 30} stroke="#2f6fb0" strokeWidth="1.5" />
        </g>
        <g opacity={protetorOp} style={trans}>
          <circle cx={cx - 7} cy={baseY - 24} r="2.4" fill="#fff" opacity="0.8" />
          <circle cx={cx + 7} cy={baseY - 24} r="2.4" fill="#fff" opacity="0.8" />
        </g>
        <path d={`M ${cx - 5} ${baseY - 22} q 5 4 10 0`} fill="none" stroke="#7a4a2b" strokeWidth="1.6" strokeLinecap="round" />
        <g opacity={boiaOp} style={trans}>
          <ellipse cx={cx} cy={baseY + 2} rx="26" ry="12" fill="none" stroke="#ff7a59" strokeWidth="7" />
          <ellipse cx={cx} cy={baseY + 2} rx="26" ry="12" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray="10 14" />
        </g>
      </g>

      <g opacity={mergulho} style={trans}>
        {[-18, -8, 8, 18].map((dx, i) => (
          <circle key={i} cx={cx + dx} cy={102 - (i % 2 === 0 ? 6 : 12)} r={i % 2 === 0 ? 3 : 2} fill="#cdeefb" />
        ))}
      </g>
    </svg>
  );
}

const TEMAS: Record<TemaKey, Tema> = {
  arco_iris: {
    label: "Arco-íris",
    emoji: "🌈",
    comoUsar: () =>
      "O arco-íris vai sendo desenhado faixa por faixa, com brilhos surgindo o tempo todo; quando as 7 cores estiverem prontas, o tempo acabou.",
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
    comoUsar: () =>
      "A lagarta vira casulo e nasce a borboleta; a asa vai sendo trabalhada aos poucos (pintinha por pintinha) e, por último, aparecem as anteninhas — é quando o tempo acaba.",
    antecipacao: (depois) => (
      <>
        Quando a borboleta ganhar as <span className="text-brand-purple">antenas</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) => {
      if (p < 0.16) return "A lagarta está se preparando…";
      if (p < 0.28) return "Virou casulo — espera só um pouquinho…";
      if (p < 0.96) return "A borboleta está ganhando as cores das asas!";
      return "Só falta a antena!";
    },
    tituloFim: "A borboleta ficou pronta!",
    Cena: LagartaBorboleta,
  },
  piscina: {
    label: "Vamos nadar",
    emoji: "🏊",
    comoUsar: () =>
      "A criança vai se preparando pra nadar: touca, óculos, boia, protetor — com bolhas subindo o tempo todo — e quando estiver pronta, mergulha. É quando o tempo acaba.",
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
          começar. {t.comoUsar()}
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
          Mais tempo, mais detalhes surgindo — algo novo o tempo todo, não fica parado.
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
