"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { alterarConsentimentoMarketing } from "./actions";

export function OptOutsForm({ consentido }: { consentido: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aceitar, setAceitar] = useState(consentido);

  function alternar() {
    const anterior = aceitar;
    const proximo = !anterior;
    setAceitar(proximo);
    setErro(null);
    startTransition(async () => {
      try {
        await alterarConsentimentoMarketing({ aceitar: proximo });
      } catch (e) {
        setAceitar(anterior);
        setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
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
      <label className="flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={aceitar}
          disabled={pending}
          onChange={alternar}
        />
        <div className="flex-1">
          <Label className="font-medium">Novidades e promoções</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Quero receber novidades sobre novas funcionalidades, parcerias e
            promoções. Mensagens necessárias para usar a conta não dependem
            desta escolha.
          </p>
        </div>
      </label>
    </div>
  );
}
