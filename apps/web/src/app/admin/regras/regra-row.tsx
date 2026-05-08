"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { atualizarRegraDefinicao } from "./actions";

export function RegraRow({
  regraKey,
  ativa: ativaInicial,
  cooldownDias: cooldownInicial,
  severidade: severidadeInicial,
}: {
  regraKey: string;
  ativa: boolean;
  cooldownDias: number;
  severidade: "info" | "warn" | "high";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ativa, setAtiva] = useState(ativaInicial);
  const [cooldown, setCooldown] = useState(cooldownInicial);
  const [severidade, setSeveridade] = useState<"info" | "warn" | "high">(
    severidadeInicial,
  );

  function salvar() {
    setErro(null);
    startTransition(async () => {
      try {
        await atualizarRegraDefinicao({
          key: regraKey,
          ativa,
          cooldown_dias: cooldown,
          severidade_default: severidade,
        });
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  const dirty =
    ativa !== ativaInicial ||
    cooldown !== cooldownInicial ||
    severidade !== severidadeInicial;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-xs">{regraKey}</code>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={ativa}
            onChange={(e) => setAtiva(e.target.checked)}
          />
          Ativa
        </label>
        <label className="flex items-center gap-1.5">
          Severidade
          <select
            value={severidade}
            onChange={(e) =>
              setSeveridade(e.target.value as "info" | "warn" | "high")
            }
            className="rounded-md border bg-background px-2 py-0.5 text-xs"
          >
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Cooldown (dias)
          <input
            type="number"
            min={0}
            max={180}
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            className="w-16 rounded-md border bg-background px-2 py-0.5 text-xs"
          />
        </label>
        <Button
          type="button"
          size="sm"
          onClick={salvar}
          disabled={pending || !dirty}
        >
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>
    </div>
  );
}
