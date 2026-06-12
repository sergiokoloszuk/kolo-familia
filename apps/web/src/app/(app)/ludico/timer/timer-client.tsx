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

export function TimerClient() {
  const [fase, setFase] = useState<Fase>("setup");
  const [duracaoMin, setDuracaoMin] = useState(10);
  const [depois, setDepois] = useState("");

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
        onAvancar={() => setFase("antecipacao")}
      />
    );
  }

  if (fase === "antecipacao") {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 p-8 text-center">
        <ArcoIris progresso={0} />
        <div>
          <p className="font-heading text-xl text-foreground md:text-2xl">
            Quando o arco-íris ficar{" "}
            <span className="text-brand-purple">prontinho</span>,
            <br />
            vai ser hora de <span className="text-brand-purple">{depoisTxt}</span>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            São {duracaoMin} minutos. As cores vão chegando uma por uma — quando o arco-íris
            estiver completo, o tempo acabou.
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
          <ArcoIris progresso={1} />
          <span aria-hidden className="absolute -right-1 top-0 animate-pulse text-2xl">
            ✨
          </span>
        </div>
        <div>
          <p className="font-heading text-2xl text-foreground md:text-3xl">
            O arco-íris ficou pronto! 🌈
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
  const coresProntas = Math.floor(progresso * CORES.length);
  const faltam = CORES.length - coresProntas;
  const quaseLa = progresso > 0.85;
  const narracao = quaseLa
    ? "Quase pronto!"
    : coresProntas === 0
      ? "O arco-íris está começando…"
      : `Falta${faltam === 1 ? "" : "m"} ${faltam} cor${faltam === 1 ? "" : "es"} pro arco-íris ficar pronto`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-lg text-foreground">O arco-íris</p>
          <p className="text-sm text-muted-foreground">
            Depois: <span className="font-medium text-foreground">{depoisTxt}</span>
          </p>
        </div>
        <span className="font-heading text-2xl tabular-nums text-foreground">
          {formatar(restanteMs)}
        </span>
      </div>

      <div className="flex items-center justify-center rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 px-6 py-8">
        <ArcoIris progresso={progresso} />
      </div>

      <p className="text-center font-heading text-lg text-foreground">{narracao}</p>

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

/** Arco-íris que se forma: cada cor aparece na sua fatia do tempo (0 → 1). */
function ArcoIris({ progresso }: { progresso: number }) {
  const n = CORES.length;
  return (
    <svg viewBox="0 0 200 118" className="w-full max-w-md" role="img" aria-label="Arco-íris se formando">
      {CORES.map((cor, i) => {
        const r = 90 - i * 11;
        const slice = 1 / n;
        const op = Math.max(0, Math.min(1, (progresso - i * slice) / slice));
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
      {/* nuvenzinhas na base, cobrindo as pontas do arco */}
      <ellipse cx="38" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
      <ellipse cx="162" cy="100" rx="30" ry="13" fill="#fff" opacity="0.95" />
    </svg>
  );
}

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
  onAvancar,
}: {
  duracaoMin: number;
  setDuracaoMin: (n: number) => void;
  depois: string;
  setDepois: (s: string) => void;
  onAvancar: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.07] px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground">
          <strong className="font-semibold">Quem cuida:</strong> combine o tempo e o que
          vem <em className="not-italic">depois</em>, e conte pra criança antes de começar
          (“quando o arco-íris ficar pronto, é hora de…”). O combinado claro é o que evita a
          surpresa — o arco-íris só mostra, pra ela, quanto falta.
        </p>
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
