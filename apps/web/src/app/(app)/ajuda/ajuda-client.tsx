"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { perguntarAjuda } from "./actions";

const EXEMPLOS = [
  "Como mudo o nome que aparece pra mim?",
  "Onde registro uma conquista do dia?",
  "Como crio o avatar?",
  "Quero pedir ideias de brincadeira",
];

type Bolha = {
  role: "user" | "assistant";
  content: string;
  rota?: string | null;
  rotaLabel?: string | null;
};

export function AjudaClient() {
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Bolha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pending]);

  function submit(texto?: string) {
    const q = (texto ?? input).trim();
    if (!q || pending) return;
    setInput("");
    setErro(null);
    const novo: Bolha[] = [...msgs, { role: "user", content: q }];
    setMsgs(novo);
    startTransition(async () => {
      try {
        const r = await perguntarAjuda(novo.map((m) => ({ role: m.role, content: m.content })));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: r.resposta, rota: r.rota, rotaLabel: r.rotaLabel },
        ]);
      } catch {
        setErro("Não consegui responder agora. Tente de novo em instantes.");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Conversa */}
      {msgs.length > 0 && (
        <div className="flex flex-col gap-3">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div
                key={i}
                className="max-w-[85%] self-end rounded-2xl bg-brand-purple px-4 py-2.5 text-base text-white"
              >
                {m.content}
              </div>
            ) : (
              <div
                key={i}
                className="max-w-[90%] self-start rounded-2xl border border-foreground/[0.08] bg-white p-4 shadow-sm"
              >
                <RespostaMarkdown texto={m.content} className="flex flex-col gap-3 text-base text-foreground" />
                {m.rota && m.rotaLabel && (
                  <Link
                    href={m.rota}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-dark"
                  >
                    Ir para {m.rotaLabel}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            ),
          )}
          {pending && <div className="self-start text-sm text-muted-foreground">Procurando…</div>}
          <div ref={fimRef} />
        </div>
      )}

      {/* Exemplos — só no início */}
      {msgs.length === 0 && !pending && (
        <div className="flex flex-wrap gap-2">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => submit(ex)}
              className="rounded-full border border-foreground/10 bg-white px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand-purple/30 hover:text-brand-purple"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Campo — continua perguntando */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={msgs.length ? "Pode perguntar mais…" : "Ex: quero mudar o horário das mensagens da Ayla"}
          disabled={pending}
          className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
            Enter envia · Shift+Enter pula linha
          </span>
          <Button type="submit" size="lg" disabled={pending || !input.trim()}>
            {pending ? "Procurando..." : msgs.length ? "Perguntar" : "Me orienta"}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </form>

      <div className="mt-2 flex items-start gap-2.5 border-t border-foreground/[0.06] pt-4 text-sm text-muted-foreground">
        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-brand-purple/70" aria-hidden />
        <span>
          Ainda precisa de ajuda de gente?{" "}
          <a
            href="mailto:kolosuporte@gmail.com?subject=Ajuda%20no%20Kolo%20Fam%C3%ADlia"
            className="font-semibold text-brand-purple underline-offset-2 hover:underline"
          >
            kolosuporte@gmail.com
          </a>
        </span>
      </div>
    </div>
  );
}
