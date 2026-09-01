"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { excluirContaAction } from "./actions";

export function ExcluirContaForm() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmacao !== "EXCLUIR") {
      setErro("Digite EXCLUIR pra confirmar.");
      return;
    }
    if (
      !confirm(
        "Isso é irreversível. Vou apagar sua conta, todos os registros e cancelar a assinatura. Continuar?",
      )
    )
      return;
    setErro(null);
    startTransition(async () => {
      try {
        await excluirContaAction({ confirmacao });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmacao">
          Digite <strong>EXCLUIR</strong> em maiúsculas pra confirmar
        </Label>
        <Input
          id="confirmacao"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          placeholder="EXCLUIR"
          autoComplete="off"
        />
      </div>

      <div>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || confirmacao !== "EXCLUIR"}
        >
          {pending ? "Excluindo..." : "Excluir minha conta"}
        </Button>
      </div>
    </form>
  );
}
