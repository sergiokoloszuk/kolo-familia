"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  submeterParaAprovacao,
  aprovarCampanha,
  cancelarCampanha,
  simularCampanha,
  dispararCampanha,
  deleteCampanha,
  type SimulacaoCampanha,
} from "../actions";

const MOTIVO_LABEL: Record<string, string> = {
  optout: "opt-out da categoria",
  sem_consentimento: "sem consentimento Ayla",
  desativada: "Ayla desativada",
  pausa: "em pausa",
  limite_2_por_dia: "limite 2/dia atingido",
  comercial_pos_crise: "janela 48h pós crise",
  silencio_10d: "silêncio total >10d",
  engajamento_recente: "última msg <36h",
  outro: "outro",
};

export function AcoesCampanha({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sim, setSim] = useState<SimulacaoCampanha | null>(null);

  function run(acao: () => Promise<unknown>) {
    setErro(null);
    setInfo(null);
    startTransition(async () => {
      try {
        await acao();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function simular() {
    setErro(null);
    setSim(null);
    startTransition(async () => {
      try {
        const r = await simularCampanha(id);
        setSim(r);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function disparar() {
    if (
      !confirm(
        "Disparar a campanha? Mensagens vão ser enviadas pra cada família elegível.",
      )
    )
      return;
    setErro(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const r = await dispararCampanha(id);
        const msg = `Lote enviado: ${r.enviadas} entregues, ${r.bloqueadas} bloqueadas, ${r.pendentes_restantes} ainda pendentes.`;
        setInfo(msg);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {info && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {info}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={simular}
          disabled={pending || status === "cancelada"}
        >
          {pending ? "Simulando..." : "Simular alcance"}
        </Button>

        {status === "rascunho" && (
          <>
            <Button
              type="button"
              onClick={() => run(() => submeterParaAprovacao(id))}
              disabled={pending}
            >
              Submeter pra aprovação
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!confirm("Apagar este rascunho?")) return;
                run(() => deleteCampanha(id));
              }}
              disabled={pending}
            >
              Apagar
            </Button>
          </>
        )}

        {status === "aguardando_aprovacao" && (
          <>
            <Button
              type="button"
              onClick={() => run(() => aprovarCampanha(id))}
              disabled={pending}
            >
              Aprovar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => run(() => cancelarCampanha(id))}
              disabled={pending}
            >
              Cancelar
            </Button>
          </>
        )}

        {status === "aprovada" && (
          <>
            <Button type="button" onClick={disparar} disabled={pending}>
              Disparar agora
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => run(() => cancelarCampanha(id))}
              disabled={pending}
            >
              Cancelar
            </Button>
          </>
        )}

        {status === "enviando" && (
          <Button type="button" onClick={disparar} disabled={pending}>
            Continuar disparo (próximo lote)
          </Button>
        )}
      </div>

      {sim && (
        <div className="rounded-md border bg-card px-4 py-3 text-sm">
          <p className="font-medium">Simulação</p>
          <p className="mt-1">
            {sim.alcance} de {sim.total_publico} família(s) receberiam.
          </p>
          {sim.bloqueados > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {Object.entries(sim.bloqueios_por_motivo).map(([k, v]) => (
                <li key={k}>
                  {v} bloqueada(s) por {MOTIVO_LABEL[k] ?? k}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
