"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingCopy } from "@/lib/onboarding/copy-default";
import type { ModoOnboarding } from "@/lib/onboarding/modo";
import { OnboardingExperiencia } from "./preview";
import { TestarCadastroNovo } from "./testar-cadastro";
import {
  ajustarCopyComIA,
  publicarCopyAction,
  resetarRascunhoAction,
  definirModoAction,
} from "./actions";

type Msg = { autor: "voce" | "ayla"; texto: string };

const EXEMPLOS = [
  "Deixe a primeira fala mais curta e calorosa",
  "Troque 'desafio' por 'o que está difícil'",
  "No passo do WhatsApp, explique melhor por que preciso do número",
];

/**
 * Fatia 2 — editor da copy do onboarding por chat de IA, com preview ao vivo.
 * Você escreve o ajuste, a IA reescreve a copy, o preview atualiza (rascunho).
 * "Publicar" leva o rascunho pro cadastro real (quando a Fatia 3 estiver ligada).
 */
const MODOS: { valor: ModoOnboarding; label: string; desc: string }[] = [
  { valor: "antigo", label: "Antigo", desc: "todos no cadastro atual (padrão seguro)" },
  { valor: "teste", label: "Teste", desc: "fluxo novo só pras suas contas de teste" },
  { valor: "todos", label: "Todos", desc: "fluxo novo pra todos os leads novos" },
];

export function OnboardingEditor({
  initialCopy,
  modoInicial,
}: {
  initialCopy: OnboardingCopy;
  modoInicial: ModoOnboarding;
}) {
  const [modo, setModo] = useState(modoInicial);
  const [copy, setCopy] = useState(initialCopy);
  const [edicao, setEdicao] = useState(0); // re-monta o preview a cada mudança
  const [msgs, setMsgs] = useState<Msg[]>([
    { autor: "ayla", texto: "Me diz o que quer ajustar na copy — eu reescrevo e você vê na hora aqui do lado." },
  ]);
  const [input, setInput] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [publicando, startPublicar] = useTransition();

  function enviar(texto: string) {
    const t = texto.trim();
    if (!t || pending) return;
    setMsgs((m) => [...m, { autor: "voce", texto: t }]);
    setInput("");
    startTransition(async () => {
      const r = await ajustarCopyComIA(t);
      if (r.ok) {
        setCopy(r.copy);
        setEdicao((n) => n + 1);
        setMsgs((m) => [...m, { autor: "ayla", texto: r.resumo }]);
        setAviso(r.persistido ? null : "Editando só nesta sessão — aplique a migração 0059 pra salvar de verdade.");
      } else {
        setMsgs((m) => [...m, { autor: "ayla", texto: `Ops: ${r.error}` }]);
      }
    });
  }

  function trocarModo(m: ModoOnboarding) {
    const anterior = modo;
    setModo(m);
    startTransition(async () => {
      const r = await definirModoAction(m);
      if (!r.ok) {
        setModo(anterior);
        setAviso(`Não troquei o modo: ${r.error}`);
      }
    });
  }

  function publicar() {
    startPublicar(async () => {
      const r = await publicarCopyAction();
      setAviso(r.ok ? "Publicado ✓ — vai valer quando o cadastro novo for ligado (Fatia 3)." : `Não publicou: ${r.error}`);
    });
  }

  function resetar() {
    startTransition(async () => {
      const r = await resetarRascunhoAction();
      if (r.ok) {
        setCopy(r.copy);
        setEdicao((n) => n + 1);
        setMsgs((m) => [...m, { autor: "ayla", texto: "Voltei a copy pro texto padrão." }]);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Chave de troca: qual cadastro os leads veem */}
      <div className="rounded-2xl border border-kolo-linha bg-white p-4">
        <p className="text-sm font-semibold text-foreground">Qual cadastro os leads veem</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MODOS.map((m) => (
            <button
              key={m.valor}
              onClick={() => trocarModo(m.valor)}
              disabled={pending}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                modo === m.valor
                  ? "border-brand-purple bg-brand-purple/10 text-brand-purple-dark"
                  : "border-kolo-linha bg-white text-muted-foreground hover:border-brand-purple/40"
              }`}
            >
              <span className="block font-semibold">{m.label}</span>
              <span className="block text-xs">{m.desc}</span>
            </button>
          ))}
        </div>
        {modo === "todos" && (
          <p className="mt-2 text-xs text-destructive">
            ⚠ O fluxo novo está valendo pra TODOS os leads. Se a conversão cair, volte pra “Antigo” — vale na hora.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          A troca vale na hora, sem deploy. O cadastro antigo continua intacto como rede.
        </p>
        {modo === "teste" && (
          <div className="mt-3">
            <TestarCadastroNovo />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
      {/* Preview ao vivo */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia ao vivo</p>
        <OnboardingExperiencia key={edicao} copy={copy} />
      </div>

      {/* Editor por chat */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajustar a copy</p>

        <div className="rounded-xl border border-kolo-linha bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          Aqui é pra <strong className="text-foreground">mudar o texto e melhorar o acolhimento</strong> — à
          vontade. Pra <strong className="text-foreground">acrescentar perguntas novas</strong> (que viram
          dado do perfil), é melhor fazer via programação — me chame.
        </div>

        <div className="flex min-h-64 flex-col gap-2 rounded-2xl border border-kolo-linha bg-secondary/30 p-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.autor === "voce" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.autor === "voce"
                    ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-purple px-3.5 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-foreground shadow-sm"
                }
              >
                {m.texto}
              </div>
            </div>
          ))}
          {pending && <p className="text-xs text-muted-foreground">ajustando…</p>}
        </div>

        {/* Exemplos rápidos */}
        <div className="flex flex-wrap gap-1.5">
          {EXEMPLOS.map((ex) => (
            <button
              key={ex}
              onClick={() => enviar(ex)}
              disabled={pending}
              className="rounded-full border border-kolo-linha bg-white px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand-purple/40 hover:text-foreground disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            placeholder="Ex.: deixe a fala do WhatsApp mais curta"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviar(input);
            }}
            disabled={pending}
          />
          <Button onClick={() => enviar(input)} disabled={pending || !input.trim()}>
            Ajustar
          </Button>
        </div>

        {aviso && (
          <p className="rounded-lg bg-brand-yellow/15 px-3 py-2 text-xs text-foreground">{aviso}</p>
        )}

        <div className="mt-1 flex items-center justify-between border-t border-kolo-linha pt-3">
          <button onClick={resetar} disabled={pending} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
            ↺ voltar ao texto padrão
          </button>
          <Button variant="secondary" onClick={publicar} disabled={publicando}>
            {publicando ? "Publicando…" : "Publicar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enquanto você não clica em <strong>Publicar</strong>, os ajustes ficam como rascunho — ninguém mais vê.
        </p>
      </div>
      </div>
    </div>
  );
}
