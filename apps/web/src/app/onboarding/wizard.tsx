"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dataBrParaIso } from "@/lib/idade";
import { capitalizarNome } from "@/lib/nome";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tela1Mae } from "./steps/tela-1-mae";
import { Tela2Membros } from "./steps/tela-2-membros";
import { Tela3Contexto } from "./steps/tela-3-contexto";
import { Tela4QuickKoloVivo } from "./steps/tela-4-quick-kolo-vivo";
import { Tela5Termos } from "./steps/tela-5-termos";
import { Tela6Confirmacao } from "./steps/tela-6-confirmacao";

export type Membro = {
  id: string;
  nome: string;
  data_nascimento: string;
  perfil: string;
  genero?: "masculino" | "feminino" | "neutro" | null;
  // Diagnóstico múltiplo (reconstruído de diagnosticos_formais).
  diagnosticos?: string[];
  diagnostico_outro?: string | null;
  hipoteses?: string[];
};

export type InitialState = {
  familyId: string;
  userEmail: string;
  currentStep: number;
  profile: {
    nome_mae: string | null;
    data_nascimento_mae: string | null;
    como_chamar: string | null;
    papel: string | null;
    papel_outro: string | null;
    genero_responsavel: string | null;
  } | null;
  whatsapp: string | null;
  membros: Membro[];
  perfilFamilia: {
    composicao: {
      texto?: string;
      irmaos?: Array<{ nome: string; data_nascimento: string; brinca_junto: string }>;
    } | null;
    rotina: { texto?: string } | null;
    recursos: { texto?: string } | null;
    dinamica: { texto?: string } | null;
  } | null;
};

const TOTAL_STEPS = 6;

/**
 * Título (Fraunces) + 1 linha na voz da Ayla por passo — substitui os antigos
 * rótulos "O que é / Por que / Próximo". A linha diz o que é E já avisa o que
 * vem (previsibilidade). [NOME] = primeira criança; antes de capturada, usa
 * "seu filho ou sua filha".
 */
function chromeDoPasso(step: number, nomeCrianca: string | null): { titulo: string; linha: string } {
  const N = capitalizarNome(nomeCrianca) || "seu filho ou sua filha";
  switch (step) {
    case 1:
      return { titulo: "Sobre você", linha: "Pra começar, me diz quem é você." };
    case 2:
      return {
        titulo: "Quem você cuida",
        linha:
          "Agora me conta de quem vamos cuidar. Pode ser mais de uma criança — é só adicionar. Depois, quem mais faz parte do dia a dia dela.",
      };
    case 3:
      return {
        titulo: "Quem mais está por perto",
        linha:
          "Agora me conta quem mais vive com vocês — irmãos, quem ajuda no dia a dia. Assim minhas ideias cabem na sua casa real, não numa receita de revista.",
      };
    case 4:
      return {
        titulo: `Como ${N} está agora`,
        linha: `Me mostra três coisas que estão difíceis agora. Escolhe o tema e conta um pouco do que acontece — quanto mais você detalha, mais as minhas ideias de brincadeira e atividade ficam com a cara de ${N}, não genéricas. Comece pelo que mais pesa; um já me ajuda.`,
      };
    case 5:
      return {
        titulo: "Termos e WhatsApp",
        linha:
          "Por último, dois aceites: um pros termos de uso e outro pra Ayla poder te mandar mensagem no WhatsApp — a lei pede essa permissão separada, e você pode tirar quando quiser. Depois disso, seu trial de 30 dias começa.",
      };
    default:
      return { titulo: "Tudo pronto", linha: "" };
  }
}

export function OnboardingWizard({ initial }: { initial: InitialState }) {
  const router = useRouter();
  const [step, setStep] = useState<number>(Math.min(Math.max(initial.currentStep, 1), TOTAL_STEPS));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Estado mutável compartilhado entre telas — fonte é o que o servidor já tem.
  const [state, setState] = useState(initial);
  // Opt-in do WhatsApp (Passo 5) — o card da Ayla no Passo 6 só aparece se autorizado.
  const [optinAyla, setOptinAyla] = useState(false);

  // Atribuição de afiliado (cookie kolo_ref → afiliado_id), uma vez ao abrir.
  useEffect(() => {
    void (async () => {
      try {
        const { atribuirAfiliado } = await import("./actions");
        await atribuirAfiliado();
      } catch {
        /* best-effort */
      }
    })();
  }, []);

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

  const nomeCrianca = state.membros[0]?.nome ?? null;
  const chrome = chromeDoPasso(step, nomeCrianca);

  return (
    <div className="flex flex-col gap-6">
      <ProgressIndicator step={step} />

      {step === 1 && (
        <>
          <div>
            <h1 className="font-heading text-2xl text-foreground">
              Olá! Você está no Kolo Família
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Apoio diário pra você e pra quem você cuida.
            </p>
          </div>

          <div className="rounded-2xl border border-kolo-linha bg-secondary/50 p-5">
            <h2 className="font-heading text-lg text-foreground">Quem é a Ayla?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A Ayla te acompanha no dia a dia, pelo WhatsApp. Ela vai conhecendo
              seu filho ou sua filha conforme você conta — o que gosta, o que
              incomoda, o que muda. Quanto mais você conta, melhores ficam as
              ideias que ela te manda: o que tentar, o que observar, por onde
              começar. O que você conta fica guardado no aplicativo, e a Ayla
              lembra de tudo.
            </p>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardDescription>
            Passo {step} de {TOTAL_STEPS}
          </CardDescription>
          <CardTitle>{chrome.titulo}</CardTitle>
          {chrome.linha && <CardDescription>{chrome.linha}</CardDescription>}
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
                whatsapp_e164: state.whatsapp ?? "",
                papel: state.profile?.papel ?? "",
                papel_outro: state.profile?.papel_outro ?? "",
                genero_responsavel: state.profile?.genero_responsavel ?? "",
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
                        ...s.profile,
                        nome_mae: values.nome_mae,
                        data_nascimento_mae: dataBrParaIso(values.data_nascimento_mae),
                        como_chamar: s.profile?.como_chamar ?? null,
                        papel: values.papel,
                        papel_outro: values.papel === "outro" ? (values.papel_outro ?? null) : null,
                        genero_responsavel:
                          values.papel === "outro" ? (values.genero_responsavel ?? null) : null,
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
              dobResponsavel={state.profile?.data_nascimento_mae ?? null}
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
                irmaos: state.perfilFamilia?.composicao?.irmaos ?? [],
                observacao: state.perfilFamilia?.composicao?.texto ?? "",
              }}
              pending={pending}
              onSubmit={(values) =>
                runAction(
                  async () => {
                    const { saveTela3 } = await import("./actions");
                    await saveTela3(values);
                  },
                  () => {
                    const irmaos =
                      values.tem_irmaos === "sim"
                        ? values.irmaos.map((i) => ({
                            nome: i.nome,
                            data_nascimento: dataBrParaIso(i.data_nascimento) ?? "",
                            brinca_junto: i.brinca_junto,
                          }))
                        : [];
                    setState((s) => ({
                      ...s,
                      perfilFamilia: {
                        ...s.perfilFamilia,
                        composicao: { texto: values.observacao, irmaos },
                        rotina: s.perfilFamilia?.rotina ?? null,
                        recursos: s.perfilFamilia?.recursos ?? null,
                        dinamica: s.perfilFamilia?.dinamica ?? null,
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
                  () => {
                    setOptinAyla(values.optin_ayla);
                    next();
                  },
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
              nomeCrianca={capitalizarNome(state.membros[0]?.nome) || "quem você cuida"}
              aylaAutorizada={optinAyla}
              pending={pending}
              onComplete={(destino, janela) =>
                runAction(
                  async () => {
                    const { completeOnboarding } = await import("./actions");
                    await completeOnboarding({ janela });
                  },
                  () => router.push(destino),
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
            className={`h-1.5 flex-1 rounded-full ${filled ? "bg-brand-yellow" : "bg-muted"}`}
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
  if (m.includes("whatsapp")) return "WhatsApp inválido. Use o DDD + número, ex: (11) 99999-9999.";
  if (m.includes("data") && (m.includes("nascimento") || m.includes("válida")))
    return "Confira as datas de nascimento (formato dd/mm/aaaa).";
  if (m.includes("nome muito curto")) return "Algum nome ficou muito curto. Confira e tente de novo.";
  // Erro genérico do servidor — em produção o Next esconde o detalhe técnico.
  // Em vez do texto cru ("Server Components render…/digest"), mostra algo humano.
  if (
    m.includes("server components") ||
    m.includes("omitted in production") ||
    m.includes("digest") ||
    m.includes("unexpected")
  ) {
    return "Não consegui salvar agora. Confira os campos desta tela e tente de novo — se continuar, me avise pelo suporte.";
  }
  return message;
}
