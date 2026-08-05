"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlayerGuia } from "@/components/video-guia";
import { track } from "@/lib/analytics/track-client";
import { Sparkles, MessageCircle, BookHeart, ArrowRight, Sunrise, Sun, CloudSun, Moon } from "lucide-react";
import { salvarBoasVindas, pularBoasVindas, type JanelaKey } from "./actions";
import { capitalizarNome } from "@/lib/nome";

type Janela = {
  key: JanelaKey;
  label: string;
  faixa: string;
  icon: React.ReactNode;
};

const JANELAS: Janela[] = [
  { key: "manha", label: "Manhã", faixa: "8h–10h", icon: <Sunrise className="size-4" aria-hidden /> },
  { key: "meio_dia", label: "Meio-dia", faixa: "12h–14h", icon: <Sun className="size-4" aria-hidden /> },
  { key: "tarde", label: "Tarde", faixa: "15h–17h", icon: <CloudSun className="size-4" aria-hidden /> },
  { key: "noite", label: "Noite", faixa: "19h–21h", icon: <Moon className="size-4" aria-hidden /> },
];

export function BoasVindasForm({
  nome,
  primeiraCrianca,
  periodo,
}: {
  nome: string;
  primeiraCrianca: { id: string; nome: string } | null;
  /** Duração REAL do período gratuito. Null quando já é assinante. */
  periodo: { dias: number; cortesia: boolean } | null;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<JanelaKey | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Quantas famílias novas chegam a ver o guia — e quantas seguem sem ver.
  useEffect(() => {
    track("onboarding_video_exibido");
  }, []);

  const saudacao = nome
    ? `Que bom que você chegou, ${capitalizarNome(nome)}.`
    : "Que bom que você chegou.";
  const nomeCrianca = primeiraCrianca ? capitalizarNome(primeiraCrianca.nome) : null;

  function escolher(destino: "/kolo-vivo" | "/estrategias") {
    if (!janela || pending) return;
    setErro(null);
    start(async () => {
      const r = await salvarBoasVindas({ janela });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(destino);
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Acolhida */}
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-yellow/20 text-brand-purple">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h1 className="font-heading text-3xl leading-tight text-foreground md:text-4xl">
          {saudacao}
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          Antes de te levar pro painel, uma coisa só:
          <br />
          quando é melhor pra eu te mandar uma mensagem rápida no WhatsApp?
        </p>
      </header>

      {/* O PERÍODO GRATUITO E O GUIA EM VÍDEO.
          A auditoria do trial mostrou metade das famílias chegando ao fim do
          teste sem nunca ter escrito pra Ayla: elas não descobrem o que dá pra
          pedir. O vídeo é a explicação principal — e ninguém é obrigado a ver. */}
      {periodo && (
        <p className="-mt-4 text-center text-sm font-semibold text-brand-purple">
          Seu período {periodo.cortesia ? "de cortesia" : "gratuito"} de {periodo.dias}{" "}
          {periodo.dias === 1 ? "dia" : "dias"} começa agora.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-center text-sm text-muted-foreground">
          Você não precisa saber exatamente o que pedir — a Kolo vai te ajudando a encontrar
          caminhos para os desafios do dia a dia. Este vídeo curto mostra como.
        </p>
        <PlayerGuia titulo="Como usar a Kolo Família — guia completo" />
      </section>

      {/* Janela WhatsApp — 4 chips */}
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {JANELAS.map((j) => {
            const ativa = janela === j.key;
            return (
              <button
                key={j.key}
                type="button"
                onClick={() => setJanela(j.key)}
                disabled={pending}
                className={`group flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-5 text-center transition-all ${
                  ativa
                    ? "border-brand-purple bg-brand-purple/5 text-brand-purple-dark shadow-[0_0_0_3px_rgba(105,49,156,0.12)]"
                    : "border-kolo-linha bg-white text-muted-foreground hover:-translate-y-0.5 hover:border-brand-purple/40 hover:text-foreground"
                } disabled:opacity-50`}
              >
                <span className={ativa ? "text-brand-purple" : "text-muted-foreground/70"}>
                  {j.icon}
                </span>
                <span className="font-heading text-base text-foreground">{j.label}</span>
                <span className="text-xs text-muted-foreground">{j.faixa}</span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Dá pra mudar isso depois nas configurações.
        </p>
      </section>

      {/* As 2 portas — agora uma escolha de verdade */}
      <section className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-purple">
          Como você quer começar?
        </p>
        {!janela && (
          <p className="text-sm text-muted-foreground">
            Escolha um horário acima e toque numa das opções.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => escolher("/kolo-vivo")}
            disabled={!janela || pending}
            className="flex flex-col gap-2 rounded-2xl border border-kolo-linha bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <BookHeart className="size-4" aria-hidden />
            </span>
            <span className="font-heading text-base text-foreground">
              Continuar preenchendo o perfil
            </span>
            <span className="text-sm text-muted-foreground">
              Te levo ao Perfil, onde você atualiza tudo sobre{" "}
              {nomeCrianca ?? "quem você cuida"}.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-purple">
              Ir pro Perfil <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>

          <button
            type="button"
            onClick={() => escolher("/estrategias")}
            disabled={!janela || pending}
            className="flex flex-col gap-2 rounded-2xl border border-kolo-linha bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <MessageCircle className="size-4" aria-hidden />
            </span>
            <span className="font-heading text-base text-foreground">
              Começar a receber orientações
            </span>
            <span className="text-sm text-muted-foreground">
              Foco, socialização, autonomia, sono e muito mais — é só perguntar.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-purple">
              Ir pra Estratégias <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {pending ? "Abrindo…" : "Dá pra fazer as duas — escolha por onde começar."}
        </p>
      </section>

      {/* PULAR — a ação já existia e nunca tinha sido ligada a um botão: até
          hoje a mãe era obrigada a escolher janela e porta pra entrar. Ninguém
          é obrigado a assistir nem a decidir agora. */}
      <form action={pularBoasVindas}>
        <button
          type="submit"
          onClick={() => track("onboarding_video_pulado")}
          className="mx-auto flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Pular por enquanto <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </form>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
