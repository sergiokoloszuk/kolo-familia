"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { LottieRefCurrentProps } from "lottie-react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Lottie usa APIs do browser — carrega só no cliente.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const DURACOES = [5, 10, 15, 20, 30];
const DEPOIS_SUGESTOES = ["jantar", "dormir", "tomar banho", "guardar os brinquedos", "ir pra escola"];

type Fase = "setup" | "antecipacao" | "rodando" | "pausado" | "fim";
type TemaKey = "arco_iris" | "lagarta" | "piscina";

type Tema = {
  label: string;
  emoji: string;
  /** Caminho do arquivo Lottie em /public. A Karina solta o JSON aqui. */
  lottie: string;
  comoUsar: () => string;
  antecipacao: (depois: string) => React.ReactNode;
  narracao: (progresso: number) => string;
  tituloFim: string;
};

const TEMAS: Record<TemaKey, Tema> = {
  arco_iris: {
    label: "Arco-íris",
    emoji: "🌈",
    lottie: "/lottie/arco-iris.json",
    comoUsar: () =>
      "O arco-íris vai se formando aos poucos; quando ficar completo, o tempo acabou.",
    antecipacao: (depois) => (
      <>
        Quando o arco-íris ficar <span className="text-brand-purple">prontinho</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) =>
      p > 0.85 ? "Quase pronto!" : p < 0.1 ? "O arco-íris está começando…" : "Vai ficando colorido…",
    tituloFim: "O arco-íris ficou pronto!",
  },
  lagarta: {
    label: "Lagarta vira borboleta",
    emoji: "🦋",
    lottie: "/lottie/borboleta.json",
    comoUsar: () =>
      "A lagarta vira casulo e nasce a borboleta, que vai abrindo as asas; quando a borboleta estiver pronta, o tempo acabou.",
    antecipacao: (depois) => (
      <>
        Quando a borboleta abrir as <span className="text-brand-purple">asas</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) =>
      p < 0.25
        ? "A lagarta está se preparando…"
        : p < 0.55
          ? "Virou casulo…"
          : p > 0.9
            ? "Quase voando!"
            : "A borboleta está abrindo as asas!",
    tituloFim: "A borboleta ficou pronta!",
  },
  piscina: {
    label: "Vamos nadar",
    emoji: "🏊",
    lottie: "/lottie/nadar.json",
    comoUsar: () =>
      "A criança vai se preparando pra nadar e, quando estiver pronta, mergulha; é quando o tempo acaba.",
    antecipacao: (depois) => (
      <>
        Quando ela <span className="text-brand-purple">mergulhar</span>,<br />
        vai ser hora de <span className="text-brand-purple">{depois}</span>.
      </>
    ),
    narracao: (p) => (p > 0.85 ? "Hora de mergulhar!" : p < 0.2 ? "Se preparando…" : "Quase lá!"),
    tituloFim: "Mergulhou!",
  },
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
        <Visual key={tema} tema={t} progresso={0} />
        <div>
          <p className="font-heading text-xl text-foreground md:text-2xl">{t.antecipacao(depoisTxt)}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            São {duracaoMin} minutos. O desenho vai se formando conforme o tempo passa — quando
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
          <Visual key={tema} tema={t} progresso={1} />
          <span aria-hidden className="absolute -right-1 top-0 animate-pulse text-2xl">
            ✨
          </span>
        </div>
        <div>
          <p className="font-heading text-2xl text-foreground md:text-3xl">
            {t.tituloFim} {t.emoji}
          </p>
          <p className="mt-4 font-heading text-xl text-brand-purple">Agora é hora de {depoisTxt}.</p>
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
        <span className="font-heading text-2xl tabular-nums text-foreground">{formatar(restanteMs)}</span>
      </div>

      <div className="flex items-center justify-center rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 px-6 py-8">
        <Visual key={tema} tema={t} progresso={progresso} />
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

/**
 * Visual do timer. Se o arquivo Lottie do tema existir em /public, mostra a
 * ANIMAÇÃO sincronizada com o tempo (avança o quadro conforme o progresso, e
 * termina exatamente no zero). Enquanto não houver arquivo, mostra um anel de
 * progresso limpo com o emoji do tema — funcional e sem feiura.
 */
function Visual({ tema, progresso }: { tema: Tema; progresso: number }) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [data, setData] = useState<object | null>(null);
  const [estado, setEstado] = useState<"loading" | "ok" | "ausente">("loading");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(tema.lottie)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ausente"))))
      .then((j) => {
        if (vivo) {
          setData(j);
          setEstado("ok");
        }
      })
      .catch(() => {
        if (vivo) setEstado("ausente");
      });
    return () => {
      vivo = false;
    };
  }, [tema.lottie]);

  // Sincroniza o quadro da animação com o progresso do cronômetro.
  useEffect(() => {
    if (!carregado) return;
    const inst = lottieRef.current;
    if (!inst) return;
    const total = inst.getDuration(true) ?? 0;
    if (total > 0) {
      inst.goToAndStop(Math.max(0, Math.min(total - 0.001, progresso * total)), true);
    }
  }, [progresso, carregado]);

  if (estado === "ok" && data) {
    return (
      <div className="w-full max-w-md">
        <Lottie
          lottieRef={lottieRef}
          animationData={data}
          autoplay={false}
          loop={false}
          onDOMLoaded={() => setCarregado(true)}
        />
      </div>
    );
  }

  return <AnelProgresso progresso={progresso} emoji={tema.emoji} />;
}

/** Anel de progresso limpo (estado temporário até ter o Lottie). */
function AnelProgresso({ progresso, emoji }: { progresso: number; emoji: string }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 140 140" className="w-full max-w-[220px]" role="img" aria-label="Tempo passando">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#e9e2f5" strokeWidth="11" />
      <circle
        cx="70"
        cy="70"
        r={R}
        fill="none"
        stroke="#6b1fa8"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - progresso)}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 250ms linear" }}
      />
      <text x="70" y="74" textAnchor="middle" fontSize="44">
        {emoji}
      </text>
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
