"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tema = {
  key: string;
  label: string;
  cor: string; // gradiente tailwind
  personagem: string;
  carga: string;
  destino: string;
  fraseChegada: string; // "a formiga chegar no formigueiro"
  fraseFim: string; // "A formiga chegou no formigueiro!"
  cenario: string[];
  etapas: string[];
};

const TEMAS: Tema[] = [
  {
    key: "formiga",
    label: "A formiga e a folhinha",
    cor: "from-emerald-100 to-lime-50",
    personagem: "🐜",
    carga: "🍃",
    destino: "🪵",
    fraseChegada: "a formiga chegar no formigueiro",
    fraseFim: "A formiga chegou no formigueiro!",
    cenario: ["🌳", "🌿", "🍄", "🌼", "🐛"],
    etapas: [
      "Cortando a folhinha da árvore",
      "Carregando a folhinha",
      "Desviando de uma pedrinha",
      "Cruzando com um amiguinho",
      "Chegando no formigueiro!",
    ],
  },
  {
    key: "garca",
    label: "A garça pescadora",
    cor: "from-sky-100 to-cyan-50",
    personagem: "🦢",
    carga: "",
    destino: "🐟",
    fraseChegada: "a garça pescar o peixinho",
    fraseFim: "A garça pescou o peixinho!",
    cenario: ["🌾", "💧", "🪷", "🐸", "🌊"],
    etapas: [
      "Descendo do voo devagar",
      "Pousando bem quietinha",
      "Esperando com paciência",
      "Mirando o peixinho",
      "Pescou! Hora de comer",
    ],
  },
  {
    key: "piscina",
    label: "Nadando na raia",
    cor: "from-cyan-100 to-blue-50",
    personagem: "🏊",
    carga: "",
    destino: "🏁",
    fraseChegada: "chegar no fim da raia",
    fraseFim: "Chegou no fim da raia!",
    cenario: ["🌊", "💦", "🟦"],
    etapas: [
      "Entrando na água",
      "Primeira volta",
      "Respirando e seguindo",
      "Reta final",
      "Chegou na parede!",
    ],
  },
  {
    key: "foguete",
    label: "Viagem ao planeta",
    cor: "from-indigo-100 to-violet-50",
    personagem: "🚀",
    carga: "",
    destino: "🪐",
    fraseChegada: "o foguete pousar no planeta",
    fraseFim: "O foguete pousou no planeta!",
    cenario: ["⭐", "✨", "☄️", "🌙", "🌟"],
    etapas: [
      "Preparando a decolagem",
      "Decolou!",
      "Viajando pelo espaço",
      "Chegando perto",
      "Pousou no planeta!",
    ],
  },
  {
    key: "corrida",
    label: "Corrida de carrinhos",
    cor: "from-amber-100 to-orange-50",
    personagem: "🏎️",
    carga: "",
    destino: "🏁",
    fraseChegada: "o carrinho cruzar a linha de chegada",
    fraseFim: "Cruzou a linha de chegada!",
    cenario: ["🚥", "🚧", "🏆", "🌳"],
    etapas: ["Largada!", "Primeira volta", "Acelerando", "Última volta", "Cruzou a chegada!"],
  },
];

const DURACOES = [5, 10, 15, 20, 30];
const DEPOIS_SUGESTOES = ["jantar", "dormir", "tomar banho", "guardar os brinquedos", "ir pra escola"];

type Fase = "setup" | "antecipacao" | "rodando" | "pausado" | "fim";

export function TimerClient() {
  const [fase, setFase] = useState<Fase>("setup");
  const [temaKey, setTemaKey] = useState(TEMAS[0].key);
  const [duracaoMin, setDuracaoMin] = useState(10);
  const [depois, setDepois] = useState("");

  const tema = TEMAS.find((t) => t.key === temaKey) ?? TEMAS[0];
  const totalMs = duracaoMin * 60 * 1000;

  // Cronômetro: elapsed acumulado + início do segmento atual.
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
  const etapaIdx = Math.min(Math.floor(progresso * tema.etapas.length), tema.etapas.length - 1);
  const depoisTxt = depois.trim() || "a próxima atividade";

  if (fase === "setup") {
    return (
      <Setup
        temaKey={temaKey}
        setTemaKey={setTemaKey}
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
      <div className={cn("flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b p-8 text-center", tema.cor)}>
        <div className="text-6xl">{tema.personagem}</div>
        <div>
          <p className="font-heading text-xl text-foreground md:text-2xl">
            Quando {tema.fraseChegada},
            <br />
            vai ser hora de <span className="text-brand-purple">{depoisTxt}</span>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            São {duracaoMin} minutos. Dá pra ver a {tema.destino} no fim do caminho o tempo
            todo.
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
      <div className={cn("flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-b p-10 text-center", tema.cor)}>
        <div className="text-7xl">{tema.destino}</div>
        <div>
          <p className="font-heading text-2xl text-foreground md:text-3xl">
            Chegou! 🎉
          </p>
          <p className="mt-2 text-lg text-foreground">{tema.fraseFim}</p>
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
  const quaseLa = progresso > 0.85;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-lg text-foreground">{tema.label}</p>
          <p className="text-sm text-muted-foreground">
            Depois: <span className="font-medium text-foreground">{depoisTxt}</span>
          </p>
        </div>
        <span className="font-heading text-2xl tabular-nums text-foreground">
          {formatar(restanteMs)}
        </span>
      </div>

      {/* Cena: caminho com destino à vista e o personagem avançando */}
      <div className={cn("relative h-44 overflow-hidden rounded-3xl bg-gradient-to-b", tema.cor)}>
        {/* cenário decorativo */}
        {tema.cenario.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute text-2xl opacity-70"
            style={{
              left: `${8 + i * 17}%`,
              top: i % 2 === 0 ? "18%" : "55%",
            }}
          >
            {c}
          </span>
        ))}
        {/* linha do chão */}
        <div className="absolute inset-x-0 bottom-9 h-px bg-foreground/15" />
        {/* destino — sempre à vista no fim */}
        <span aria-hidden className="absolute bottom-5 right-3 text-5xl">
          {tema.destino}
        </span>
        {/* personagem */}
        <span
          aria-hidden
          className="absolute bottom-4 text-4xl transition-all duration-200 ease-linear"
          style={{ left: `calc(${progresso * 86}% + 0.5rem)` }}
        >
          {tema.carga}
          {tema.personagem}
        </span>
        {quaseLa && (
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-purple">
            quase lá…
          </span>
        )}
      </div>

      {/* etapa atual */}
      <p className="text-center font-heading text-lg text-foreground">{tema.etapas[etapaIdx]}</p>

      {/* progresso */}
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

function formatar(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const seg = s % 60;
  return `${m}:${seg.toString().padStart(2, "0")}`;
}

function Setup({
  temaKey,
  setTemaKey,
  duracaoMin,
  setDuracaoMin,
  depois,
  setDepois,
  onAvancar,
}: {
  temaKey: string;
  setTemaKey: (k: string) => void;
  duracaoMin: number;
  setDuracaoMin: (n: number) => void;
  depois: string;
  setDepois: (s: string) => void;
  onAvancar: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">O tema</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMAS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTemaKey(t.key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-gradient-to-b p-4 text-center transition-all",
                t.cor,
                temaKey === t.key ? "border-brand-purple" : "border-transparent hover:border-brand-purple/30",
              )}
            >
              <span className="text-3xl">
                {t.carga}
                {t.personagem}
              </span>
              <span className="text-xs font-medium text-foreground">{t.label}</span>
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
          O que vem depois <span className="font-normal text-muted-foreground">(o combinado)</span>
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
