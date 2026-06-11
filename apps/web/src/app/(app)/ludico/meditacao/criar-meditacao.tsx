"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { criarMeditacao, sugerirTemasMeditacao } from "./actions";

// Duplicado do lib (evita bundlar o cliente Anthropic no cliente).
const INTENCOES = [
  { key: "acalmar", label: "Acalmar", desc: "voltar ao corpo quando está agitada ou brava" },
  { key: "visualizar", label: "Visualizar um momento", desc: "ensaiar algo que vai acontecer, correndo bem" },
  { key: "dormir", label: "Relaxar pra dormir", desc: "soltar o corpo à noite" },
  { key: "coragem", label: "Coragem", desc: "sentir-se forte antes de algo difícil" },
  { key: "seguranca", label: "Sentir-se segura", desc: "sentir-se protegida e querida" },
] as const;

type Sugestao = { intencao: string; tema: string; motivo: string };

export function CriarMeditacao({ membros }: { membros: Array<{ id: string; nome: string }> }) {
  const router = useRouter();
  const [membroId, setMembroId] = useState(membros[0]?.id ?? "");
  const [intencao, setIntencao] = useState<string>("acalmar");
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pendSug, startSug] = useTransition();
  const [pend, start] = useTransition();

  const nomeMembro = membros.find((m) => m.id === membroId)?.nome ?? "";

  function sugerir() {
    if (!membroId || pendSug) return;
    setErro(null);
    startSug(async () => {
      const r = await sugerirTemasMeditacao({ membroId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setSugestoes(r.sugestoes);
    });
  }

  function aplicar(s: Sugestao) {
    setIntencao(s.intencao);
    setTema(s.tema);
  }

  function criar() {
    if (!membroId || pend) return;
    setErro(null);
    start(async () => {
      const r = await criarMeditacao({
        membroId,
        intencao: intencao as "acalmar",
        tema: tema.trim() || undefined,
        contexto: contexto.trim() || undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/ludico/meditacao/${r.meditacaoId}`);
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-5">
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {membros.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="med-membro" className="text-sm font-medium text-foreground">
            Pra quem
          </label>
          <select
            id="med-membro"
            value={membroId}
            onChange={(e) => {
              setMembroId(e.target.value);
              setSugestoes([]);
            }}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          >
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sugestões pertinentes ao momento da criança */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={sugerir}
          disabled={pendSug || !membroId}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-purple hover:text-brand-purple-dark disabled:opacity-50"
        >
          <Lightbulb className="size-4" aria-hidden />
          {pendSug ? "Pensando…" : `Sugestões pra ${nomeMembro || "ela"} agora`}
        </button>
        {sugestoes.length > 0 && (
          <div className="flex flex-col gap-2">
            {sugestoes.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => aplicar(s)}
                className="rounded-xl border border-foreground/10 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-brand-purple/30"
              >
                <span className="text-sm font-medium text-foreground">
                  {INTENCOES.find((x) => x.key === s.intencao)?.label ?? "Meditação"} — {s.tema}
                </span>
                {s.motivo && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.motivo}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Intenção */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">A intenção</span>
        <div className="flex flex-wrap gap-2">
          {INTENCOES.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setIntencao(it.key)}
              title={it.desc}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                intencao === it.key
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-input bg-white text-foreground hover:border-brand-purple/40",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="med-tema" className="text-sm font-medium text-foreground">
          Foco <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <Input
          id="med-tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Ex.: o primeiro dia de escola, a consulta no dentista…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="med-contexto" className="text-sm font-medium text-foreground">
          O que está acontecendo <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="med-contexto"
          rows={2}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          placeholder="Conte com suas palavras — ajuda a deixar a meditação no ponto."
          className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
      </div>

      <div>
        <Button type="button" onClick={criar} disabled={pend || !membroId}>
          {pend ? (
            <>
              <Wand2 className="size-4 animate-pulse" aria-hidden /> Criando…
            </>
          ) : (
            <>
              <Wand2 className="size-4" aria-hidden /> Criar meditação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
