"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tela1Mae } from "./steps/tela-1-mae";
import { Tela2Membros } from "./steps/tela-2-membros";
import { Tela3Contexto } from "./steps/tela-3-contexto";
import { Tela4QuickKoloVivo } from "./steps/tela-4-quick-kolo-vivo";
import { Tela5Termos } from "./steps/tela-5-termos";
import { Tela6Confirmacao } from "./steps/tela-6-confirmacao";

export type Membro = { id: string; nome: string; data_nascimento: string; perfil: string };

export type InitialState = {
  familyId: string;
  userEmail: string;
  currentStep: number;
  profile: {
    nome_mae: string | null;
    data_nascimento_mae: string | null;
    como_chamar: string | null;
  } | null;
  whatsapp: string | null;
  membros: Membro[];
  perfilFamilia: {
    composicao: { texto?: string } | null;
    rotina: { texto?: string } | null;
    recursos: { texto?: string } | null;
    dinamica: { texto?: string } | null;
  } | null;
};

const TOTAL_STEPS = 6;

const STEP_LABELS = [
  "Sobre você",
  "Membro(s) atípico(s)",
  "Contexto da família",
  "Primeiros sinais",
  "Termos e Ayla",
  "Tudo pronto",
];

const STEP_BLURB = [
  "Vamos te conhecer um pouco.",
  "Quem é o foco do cuidado.",
  "Quem mais está em volta e como vocês vivem.",
  "Três desafios + três interesses + uma conquista.",
  "Aceite e a permissão pra Ayla aparecer.",
  "30 dias grátis começam agora.",
];

export function OnboardingWizard({ initial }: { initial: InitialState }) {
  const router = useRouter();
  const [step, setStep] = useState<number>(Math.min(Math.max(initial.currentStep, 1), TOTAL_STEPS));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Estado mutável compartilhado entre telas — fonte é o que o servidor já tem.
  const [state, setState] = useState(initial);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function previous() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function runAction<T>(action: () => Promise<T>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erro inesperado";
        setError(traduzirErro(message));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressIndicator step={step} />

      {step === 1 && (
        <div className="rounded-2xl border border-kolo-linha bg-secondary/50 p-5">
          <h2 className="font-heading text-lg text-foreground">Quem é a Ayla?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A Ayla é sua assistente no Kolo Família.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ela acompanha a jornada da sua família ao longo do tempo, registra
            acontecimentos importantes e sugere estratégias, reflexões e próximos
            passos adaptados à sua realidade.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Você pode conversar com ela quando quiser, pelo aplicativo ou no dia
            a dia, pelo WhatsApp.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardDescription>
            Passo {step} de {TOTAL_STEPS}
          </CardDescription>
          <CardTitle>{STEP_LABELS[step - 1]}</CardTitle>
          <CardDescription>{STEP_BLURB[step - 1]}</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 1 && (
            <Tela1Mae
              initial={{
                nome_mae: state.profile?.nome_mae ?? "",
                data_nascimento_mae: state.profile?.data_nascimento_mae ?? "",
                como_chamar: state.profile?.como_chamar ?? "",
                whatsapp_e164: state.whatsapp ?? "",
              }}
              pending={pending}
              onSubmit={(values) =>
                runAction(
                  async () => {
                    const { saveTela1 } = await import("./actions");
                    await saveTela1(values);
                  },
                  () => {
                    setState((s) => ({
                      ...s,
                      profile: {
                        nome_mae: values.nome_mae,
                        data_nascimento_mae: values.data_nascimento_mae,
                        como_chamar: values.como_chamar ?? null,
                      },
                      whatsapp: values.whatsapp_e164,
                    }));
                    next();
                  },
                )
              }
            />
          )}

          {step === 2 && (
            <Tela2Membros
              initial={state.membros}
              pending={pending}
              onSubmit={(membros) =>
                runAction(
                  async () => {
                    const { saveTela2 } = await import("./actions");
                    const novos = await saveTela2({ membros });
                    setState((s) => ({ ...s, membros: novos }));
                  },
                  () => next(),
                )
              }
              onRemove={(id) =>
                runAction(async () => {
                  const { removeMembro } = await import("./actions");
                  await removeMembro(id);
                  setState((s) => ({ ...s, membros: s.membros.filter((m) => m.id !== id) }));
                })
              }
              onPrevious={previous}
            />
          )}

          {step === 3 && (
            <Tela3Contexto
              initial={{
                composicao: state.perfilFamilia?.composicao?.texto ?? "",
                rotina: state.perfilFamilia?.rotina?.texto ?? "",
                recursos: state.perfilFamilia?.recursos?.texto ?? "",
                dinamica: state.perfilFamilia?.dinamica?.texto ?? "",
              }}
              pending={pending}
              onSubmit={(values) =>
                runAction(
                  async () => {
                    const { saveTela3 } = await import("./actions");
                    await saveTela3(values);
                  },
                  () => {
                    setState((s) => ({
                      ...s,
                      perfilFamilia: {
                        composicao: { texto: values.composicao },
                        rotina: { texto: values.rotina },
                        recursos: { texto: values.recursos },
                        dinamica: { texto: values.dinamica },
                      },
                    }));
                    next();
                  },
                )
              }
              onPrevious={previous}
            />
          )}

          {step === 4 && (
            <Tela4QuickKoloVivo
              membros={state.membros}
              pending={pending}
              onSubmit={(porMembro) =>
                runAction(
                  async () => {
                    const { saveTela4 } = await import("./actions");
                    await saveTela4({ porMembro });
                  },
                  () => next(),
                )
              }
              onPrevious={previous}
            />
          )}

          {step === 5 && (
            <Tela5Termos
              pending={pending}
              onSubmit={(values) =>
                runAction(
                  async () => {
                    const { saveTela5 } = await import("./actions");
                    await saveTela5(values);
                  },
                  () => next(),
                )
              }
              onPrevious={previous}
            />
          )}

          {step === 6 && (
            <Tela6Confirmacao
              apelido={
                state.profile?.como_chamar?.trim() ||
                state.profile?.nome_mae?.trim().split(/\s+/)[0] ||
                state.userEmail.split("@")[0] ||
                "você"
              }
              pending={pending}
              onComplete={() =>
                runAction(
                  async () => {
                    const { completeOnboarding } = await import("./actions");
                    await completeOnboarding();
                  },
                  () => router.push("/painel"),
                )
              }
              onPrevious={previous}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div className="flex w-full items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
        const filled = n <= step;
        return (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${filled ? "bg-primary" : "bg-muted"}`}
            aria-label={`Passo ${n}${n === step ? " (atual)" : ""}`}
          />
        );
      })}
    </div>
  );
}

function traduzirErro(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("não autenticado")) return "Sessão expirada. Faça login novamente.";
  if (m.includes("não inicializada"))
    return "Sua família não está inicializada. Recarregue a página.";
  if (m.includes("whatsapp")) return "WhatsApp inválido. Use o formato +5511999999999.";
  return message;
}
