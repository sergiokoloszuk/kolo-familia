"use client";

import { useEffect, useState } from "react";
import { CardVideoGuia } from "@/components/video-guia";
import { track } from "@/lib/analytics/track-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { CheckCircle2, Leaf, Sparkles, ArrowRight } from "lucide-react";

export type JanelaKey = "manha" | "meio_dia" | "tarde" | "noite";

const JANELAS: { key: JanelaKey; label: string; faixa: string }[] = [
  { key: "manha", label: "Manhã", faixa: "8h–10h" },
  { key: "meio_dia", label: "Meio-dia", faixa: "12h–14h" },
  { key: "tarde", label: "Tarde", faixa: "15h–17h" },
  { key: "noite", label: "Noite", faixa: "19h–21h" },
];

export function Tela6Confirmacao({
  apelido,
  nomeCrianca,
  aylaAutorizada,
  pending,
  onComplete,
  onPrevious,
}: {
  apelido: string;
  nomeCrianca: string;
  aylaAutorizada: boolean;
  pending: boolean;
  onComplete: (destino: "/kolo-vivo" | "/estrategias", janela: JanelaKey | null) => void;
  onPrevious: () => void;
}) {
  const [janela, setJanela] = useState<JanelaKey | null>(null);

  // Quantas famílias novas chegam a ver o guia. NÃO prova que assistiu — prova
  // que o player esteve na tela dela.
  useEffect(() => {
    track("onboarding_video_exibido");
  }, []);

  // Quem autorizou a Ayla precisa escolher um horário antes de seguir.
  const faltaJanela = aylaAutorizada && !janela;
  const bloqueado = pending || faltaJanela;

  return (
    <div className="flex flex-col gap-6">
      {/* O GUIA EM VÍDEO — RECOLHIDO.
          Aqui, e não na /boas-vindas: aquela tela foi FUNDIDA nesta
          (`completeOnboarding` grava `boas_vindas_vista_at` junto com
          `onboarding_completed`), então ninguém chega lá — 0 de 82 famílias
          com o campo nulo.
          E recolhido de propósito: o player aberto deixava a última tela do
          cadastro comprida no celular, logo antes do botão que conclui. Mesmo
          padrão da Home — quem quer ver, clica. */}
      <CardVideoGuia
        titulo="Quer ver como a Kolo funciona por dentro?"
        descricao="Vídeo rápido de apresentação."
        rotulo="Ver como funciona"
        evento="onboarding_video_aberto"
      />

      <div className="rounded-md border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-yellow/25"
          >
            <CheckCircle2 className="size-4 text-brand-purple-dark" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">Tudo pronto, {apelido}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seus 7 dias grátis começam agora. Sem cartão. Cancela quando quiser.
            </p>
          </div>
        </div>
      </div>

      {/* Horário do WhatsApp — só pra quem autorizou a Ayla. */}
      {aylaAutorizada && (
        <div className="flex flex-col gap-2">
          <Label>Qual a melhor hora pra eu te dar um oi no WhatsApp?</Label>
          <ChipGroup label="Horário preferido">
            {JANELAS.map((j) => (
              <Chip
                key={j.key}
                selected={janela === j.key}
                onClick={() => setJanela(j.key)}
                disabled={pending}
              >
                {j.label} · {j.faixa}
              </Chip>
            ))}
          </ChipGroup>
          <p className="text-xs text-muted-foreground">
            Dá pra mudar depois — e se vocês já tiverem conversado no dia, eu não te
            interrompo.
          </p>
        </div>
      )}

      {/* As 2 portas — onde começar. */}
      <div className="flex flex-col gap-2">
        <Label>Como você quer começar?</Label>
        {faltaJanela && (
          <p className="text-sm text-muted-foreground">
            Escolha um horário acima e toque numa das opções.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onComplete("/kolo-vivo", janela)}
            disabled={bloqueado}
            className="flex flex-col gap-2 rounded-2xl border border-kolo-linha bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            <span className="font-heading text-base text-foreground">
              Selecione “Perfil”
            </span>
            <span className="text-sm text-muted-foreground">
              quando quiser atualizar o que a gente sabe sobre {nomeCrianca} —
              interesses, rotina, o que mudou.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-purple">
              Começar pelo Perfil <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => onComplete("/estrategias", janela)}
            disabled={bloqueado}
            className="flex flex-col gap-2 rounded-2xl border border-kolo-linha bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-purple/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-yellow/20 text-brand-purple">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="font-heading text-base text-foreground">
              Selecione “Estratégias”
            </span>
            <span className="text-sm text-muted-foreground">
              quando quiser ideias pra um desafio — foco, sono, socialização, o
              que estiver mais difícil.
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-purple">
              Começar pelas Estratégias <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {pending ? "Abrindo…" : "Dá pra fazer as duas — escolha por onde começar."}
        </p>
      </div>

      <div className="flex justify-start pt-2">
        <Button type="button" variant="outline" onClick={onPrevious} disabled={pending}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
