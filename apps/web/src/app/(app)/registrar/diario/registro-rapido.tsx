"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hojeLocalISO } from "@/lib/idade";
import {
  registrarDia,
  proporKoloVivoDoDiario,
  salvarKoloVivoDoDiario,
} from "./actions";

const MOODS = [
  { v: "muito_bem", emoji: "🌞", label: "Muito bem" },
  { v: "bem", emoji: "🙂", label: "Bem" },
  { v: "neutro", emoji: "😐", label: "Neutro" },
  { v: "dificil", emoji: "🌧", label: "Difícil" },
  { v: "muito_dificil", emoji: "🌧🌧", label: "Muito difícil" },
] as const;
type Mood = (typeof MOODS)[number]["v"];

const QUEM_ESTAVA = [
  { v: "mae", label: "Eu" },
  { v: "pai", label: "Pai" },
  { v: "avo_a", label: "Avó" },
  { v: "avo_o", label: "Avô" },
  { v: "irmao_a", label: "Irmão/Irmã" },
  { v: "baba", label: "Babá" },
  { v: "professor_a", label: "Professor(a)" },
  { v: "outro", label: "Outro" },
] as const;
const ESTADO_ADULTO = [
  { v: "calmo", label: "Calma" },
  { v: "firme", label: "Firme" },
  { v: "cansado", label: "Cansada" },
  { v: "ansioso", label: "Ansiosa" },
  { v: "impaciente", label: "Impaciente" },
] as const;
const REACAO_ADULTO = [
  { v: "acolhedor", label: "Acolhi" },
  { v: "esperou", label: "Esperei" },
  { v: "interveio", label: "Intervim" },
  { v: "impositivo", label: "Fui impositiva" },
  { v: "chamou_ajuda", label: "Chamei ajuda" },
  { v: "outro", label: "Outro" },
] as const;

const CAMPO_LABEL: Record<string, string> = {
  nutricional: "Alimentação",
  sono: "Sono",
  sensorial: "Sensorial",
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  emocional: "Regulação emocional",
  foco: "Foco e atenção",
  motor: "Motor",
  autonomia: "Autonomia",
  aprendizado: "Aprendizado",
  imitacao: "Imitação",
  tela_midia: "Tela e mídia",
  escola: "Escola",
  saude_geral: "Saúde geral",
  como_e: "Interesses e jeito de ser",
  essencial: "O essencial",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios",
};

type KvItem = {
  camada: "camada1" | "camada2";
  campo: string;
  subcampo?: string | null;
  texto: string;
  operacao: "adicionar" | "reescrever";
};

/**
 * Registro do dia — leve. Humor (1 toque) + "celebrar?"/"desafio?" em texto
 * livre; a IA limpa e etiqueta por área (registrarDia). Em sinal de CRISE
 * (humor difícil/muito difícil OU desafio escrito), pede o possível gatilho.
 * "Detalhar" guarda a profundidade (quem estava, estado/reação do adulto).
 * Subject = criança ativa. Reusa o fluxo de proposta de Perfil pós-registro.
 */
export function RegistroRapido({
  nomeCrianca,
  membroId,
}: {
  nomeCrianca: string | null;
  membroId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mood, setMood] = useState<Mood | null>(null);
  const [conquista, setConquista] = useState("");
  const [desafio, setDesafio] = useState("");
  const [gatilho, setGatilho] = useState("");
  const [detalhar, setDetalhar] = useState(false);
  const [quemEstava, setQuemEstava] = useState<string | null>(null);
  const [estadoAdulto, setEstadoAdulto] = useState<string | null>(null);
  const [reacaoAdulto, setReacaoAdulto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [proposta, setProposta] = useState<{ koloVivo: KvItem[]; nome: string } | null>(null);
  const [kvFeito, setKvFeito] = useState<"salvo" | null>(null);
  const [kvPending, startKv] = useTransition();

  // Sinal de crise → puxa o possível gatilho (alimenta a detecção de padrões).
  const sinalCrise = mood === "dificil" || mood === "muito_dificil" || desafio.trim().length > 0;
  const podeSalvar = Boolean(mood || conquista.trim() || desafio.trim());

  function salvar() {
    if (!podeSalvar || pending) return;
    setErro(null);
    setProposta(null);
    setKvFeito(null);
    start(async () => {
      try {
        await registrarDia({
          membroAtipicoId: membroId,
          data: hojeLocalISO(),
          escalaEmocionalMae: mood ?? "neutro",
          escalaEmocionalMembro: null,
          conquista: conquista.trim() || undefined,
          desafio: desafio.trim() || undefined,
          possivelGatilho: gatilho.trim() || undefined,
          quemEstava: (quemEstava as never) ?? null,
          estadoAdulto: (estadoAdulto as never) ?? null,
          reacaoAdulto: (reacaoAdulto as never) ?? null,
        });
        setSucesso(true);
        router.refresh();
        if (membroId && (conquista.trim() || desafio.trim())) {
          const texto = [
            conquista.trim() && `Conquista: ${conquista.trim()}`,
            desafio.trim() && `Desafio: ${desafio.trim()}`,
            gatilho.trim() && `Possível gatilho: ${gatilho.trim()}`,
          ]
            .filter(Boolean)
            .join("\n");
          const r = await proporKoloVivoDoDiario({ membroAtipicoId: membroId, texto });
          if (r.ok && r.koloVivo.length > 0) {
            setProposta({ koloVivo: r.koloVivo as KvItem[], nome: r.nome });
          }
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function salvarKv() {
    if (!proposta || !membroId) return;
    startKv(async () => {
      const r = await salvarKoloVivoDoDiario({ membroAtipicoId: membroId, koloVivo: proposta.koloVivo });
      if (r.ok) {
        setKvFeito("salvo");
        router.refresh();
      } else {
        setErro(r.error);
      }
    });
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border-l-4 border-brand-yellow bg-brand-yellow/10 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-yellow text-brand-purple-dark"
          >
            <Check className="size-5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-heading text-base font-semibold text-brand-purple-dark">Registrado! 🌿</p>
            <p className="mt-0.5 text-sm text-foreground/80">
              Já entrou na Evolução{nomeCrianca ? ` de ${nomeCrianca}` : ""}.
            </p>
          </div>
        </div>

        {pending && <p className="text-sm text-muted-foreground">Vendo se tem algo novo pro Perfil…</p>}

        {kvFeito === "salvo" ? (
          <p className="text-sm font-medium text-brand-purple-dark">✓ Guardado no Perfil.</p>
        ) : proposta && proposta.koloVivo.length > 0 ? (
          <div className="w-full rounded-xl border border-brand-purple/20 bg-white p-4">
            <p className="text-sm font-medium text-foreground">
              Percebi algo novo sobre {proposta.nome} — guardar no Perfil?
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {proposta.koloVivo.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span aria-hidden className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-brand-purple/40" />
                  <span>
                    <span className="font-medium text-foreground">{CAMPO_LABEL[it.campo] ?? it.campo}:</span>{" "}
                    {it.texto}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" onClick={salvarKv} disabled={kvPending}>
                {kvPending ? "Guardando…" : "Guardar no Perfil"}
              </Button>
              <button
                type="button"
                onClick={() => setProposta(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Agora não
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setSucesso(false);
            setMood(null);
            setConquista("");
            setDesafio("");
            setGatilho("");
            setProposta(null);
            setKvFeito(null);
          }}
          className="text-sm font-semibold text-brand-purple underline-offset-4 hover:underline"
        >
          Registrar outra coisa
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">
          Como foi o dia{nomeCrianca ? ` da ${nomeCrianca}` : ""}?
        </p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMood(mood === m.v ? null : m.v)}
              aria-pressed={mood === m.v}
              title={m.label}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                mood === m.v
                  ? "border-brand-purple bg-kolo-lilas-bg-2 text-brand-purple"
                  : "border-input bg-white text-foreground hover:border-brand-purple/40",
              )}
            >
              <span aria-hidden>{m.emoji}</span> {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground">🎉 Algo pra celebrar?</label>
        <Input
          value={conquista}
          onChange={(e) => setConquista(e.target.value)}
          placeholder="Ex.: comeu um alimento novo, pediu ajuda sozinho…"
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground">🌧 Algum desafio?</label>
        <Input
          value={desafio}
          onChange={(e) => setDesafio(e.target.value)}
          placeholder="Ex.: difícil sair de casa, crise na transição…"
          disabled={pending}
        />
      </div>

      {/* Sinal de crise → checar possível gatilho (alimenta os padrões). */}
      {sinalCrise && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-brand-yellow/40 bg-brand-yellow/[0.07] p-3">
          <label className="flex items-center gap-1.5 text-sm text-foreground">
            <Search className="size-3.5 text-[#8B5A00]" aria-hidden /> O que parece ter disparado?{" "}
            <span className="font-normal text-muted-foreground">(opcional — ajuda a achar padrões)</span>
          </label>
          <Input
            value={gatilho}
            onChange={(e) => setGatilho(e.target.value)}
            placeholder="Ex.: barulho, fome, mudança de rotina, cansaço…"
            disabled={pending}
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setDetalhar((v) => !v)}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-purple"
        >
          Quer detalhar?
          <ChevronDown className={cn("size-4 transition-transform", detalhar && "rotate-180")} aria-hidden />
        </button>
        {detalhar && (
          <div className="flex flex-col gap-3 rounded-xl border border-foreground/[0.08] bg-white p-3">
            <Chips label="Quem estava" opcoes={QUEM_ESTAVA} valor={quemEstava} onPick={setQuemEstava} />
            <Chips label="Como você estava" opcoes={ESTADO_ADULTO} valor={estadoAdulto} onPick={setEstadoAdulto} />
            <Chips label="Como você reagiu" opcoes={REACAO_ADULTO} valor={reacaoAdulto} onPick={setReacaoAdulto} />
          </div>
        )}
      </div>

      <div>
        <Button type="button" onClick={salvar} disabled={!podeSalvar || pending}>
          {pending ? "Salvando…" : "Salvar o dia"}
        </Button>
      </div>
    </div>
  );
}

function Chips({
  label,
  opcoes,
  valor,
  onPick,
}: {
  label: string;
  opcoes: readonly { v: string; label: string }[];
  valor: string | null;
  onPick: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(valor === o.v ? null : o.v)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              valor === o.v
                ? "border-brand-purple bg-kolo-lilas-bg-2 text-brand-purple"
                : "border-foreground/10 bg-white text-foreground hover:border-brand-purple/30",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
