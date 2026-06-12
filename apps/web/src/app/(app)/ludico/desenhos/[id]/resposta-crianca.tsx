"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarRespostaCrianca, aprofundarDesenho } from "../actions";

const CARINHAS = [
  { emoji: "😊", label: "feliz" },
  { emoji: "😟", label: "preocupada" },
  { emoji: "😠", label: "brava" },
  { emoji: "😨", label: "com medo" },
  { emoji: "😐", label: "tranquila" },
];

export function RespostaCrianca({
  desenhoId,
  inicial,
  nome,
  temReleitura,
}: {
  desenhoId: string;
  inicial: string | null;
  nome: string | null;
  temReleitura: boolean;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState(inicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendingSalvar, startSalvar] = useTransition();
  const [pendingGerar, startGerar] = useTransition();
  const ocupado = pendingSalvar || pendingGerar;

  function addCarinha(label: string) {
    setTexto((t) => (t.trim() ? `${t.trim()} · apontou: ${label}` : `Apontou: ${label}`));
  }

  // Emoção fora das 5 carinhas — prepara o texto e foca pra mãe digitar.
  function outraEmocao() {
    setTexto((t) => (t.trim() ? `${t.trim()} · apontou: ` : "Apontou: "));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  function soGuardar() {
    if (ocupado) return;
    setErro(null);
    setSalvo(false);
    startSalvar(async () => {
      const r = await salvarRespostaCrianca({ desenhoId, resposta: texto.trim() });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setSalvo(true);
      router.refresh();
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  // Salva o que está digitado AGORA e gera a leitura em cima disso (um clique só).
  function gerar() {
    if (ocupado) return;
    setErro(null);
    startGerar(async () => {
      const s = await salvarRespostaCrianca({ desenhoId, resposta: texto.trim() });
      if (!s.ok) {
        setErro(s.error);
        return;
      }
      const r = await aprofundarDesenho({ desenhoId });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4">
      <p className="font-heading text-base font-medium text-foreground">
        O que {nome ?? "a criança"} respondeu?
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Converse e anote com as palavras dela. Se ela fala pouco, mostre as carinhas e toque na
        que ela apontou. Depois, é só gerar a leitura — a partir do que ela contou.
      </p>

      <div className="flex flex-wrap gap-2">
        {CARINHAS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => addCarinha(c.label)}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-sm transition-colors hover:border-brand-purple/30"
          >
            <span aria-hidden className="text-base">
              {c.emoji}
            </span>
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={outraEmocao}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/20 bg-white px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-purple/40 hover:text-brand-purple"
        >
          <Pencil className="size-3.5" aria-hidden />
          outra…
        </button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <textarea
        ref={textareaRef}
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: 'É um pato na lagoa, feliz com a roupa preferida.' · apontou: feliz"
        className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={gerar} disabled={ocupado}>
          {pendingGerar ? (
            <>
              <Sparkles className="size-4 animate-pulse" aria-hidden /> Gerando a leitura…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />{" "}
              {temReleitura ? "Gerar a leitura de novo" : "Gerar a leitura"}
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={soGuardar}
          disabled={ocupado}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          {pendingSalvar ? "Guardando…" : salvo ? "Guardado ✓" : "Só guardar por enquanto"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground/80">
        A leitura fica muito melhor com a resposta da criança — mas dá pra gerar sem ela também.
      </p>
    </div>
  );
}
