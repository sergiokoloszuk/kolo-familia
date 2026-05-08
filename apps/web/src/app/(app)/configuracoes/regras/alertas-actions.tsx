"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  snoozeAlerta,
  descartarAlerta,
  silenciarRegra,
  dessilenciarRegra,
  aplicarAdaptacaoAction,
  descartarAdaptacaoAction,
  reverterAdaptacaoAction,
} from "./actions";

export function AlertaAcoes({
  alertaId,
  regraKey,
}: {
  alertaId: string;
  regraKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && (
        <p className="text-xs text-destructive">{erro}</p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run(() => snoozeAlerta(alertaId, 7))}
          disabled={pending}
        >
          Adiar 7 dias
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => run(() => descartarAlerta(alertaId))}
          disabled={pending}
        >
          Já cuidei
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            run(() =>
              silenciarRegra({
                regra_key: regraKey,
                ate_iso: null,
                motivo: "silenciada pela usuária",
              }),
            )
          }
          disabled={pending}
        >
          Silenciar este tipo
        </Button>
      </div>
    </div>
  );
}

export function DessilenciarRegraButton({
  regraKey,
}: {
  regraKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setErro(null);
          startTransition(async () => {
            try {
              await dessilenciarRegra(regraKey);
              router.refresh();
            } catch (e) {
              setErro(e instanceof Error ? e.message : "Erro");
            }
          });
        }}
        disabled={pending}
      >
        Reativar
      </Button>
    </div>
  );
}

export function AdaptacaoAcoes({
  adaptacaoId,
  estado,
}: {
  adaptacaoId: string;
  estado: "pendente" | "aplicada" | "descartada" | "revertida";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div className="flex flex-wrap gap-2 text-xs">
        {estado === "pendente" && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => run(() => aplicarAdaptacaoAction(adaptacaoId))}
              disabled={pending}
            >
              Aplicar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => run(() => descartarAdaptacaoAction(adaptacaoId))}
              disabled={pending}
            >
              Não, obrigada
            </Button>
          </>
        )}
        {estado === "aplicada" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                !confirm(
                  "Reverter esta adaptação? Volto exatamente ao que estava antes.",
                )
              )
                return;
              run(() => reverterAdaptacaoAction(adaptacaoId));
            }}
            disabled={pending}
          >
            Reverter
          </Button>
        )}
      </div>
    </div>
  );
}
