"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarWhatsappAyla } from "./numero-actions";

/** (11) 96319-7032 a partir de 5511963197032 — só pra leitura humana. */
function legivel(num: string): string {
  const d = num.replace(/\D/g, "");
  const semPais = d.startsWith("55") ? d.slice(2) : d;
  if (semPais.length < 10) return num;
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  return `(${ddd}) ${meio}-${resto.slice(meio.length)}`;
}

export function NumeroAylaForm({ atual }: { atual: string | null }) {
  const [valor, setValor] = useState(atual ?? "");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, startTransition] = useTransition();

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await salvarWhatsappAyla(valor);
      if (r.ok) {
        setValor(r.numero);
        setMsg({ tipo: "ok", texto: `Salvo: ${legivel(r.numero)}` });
      } else {
        setMsg({ tipo: "erro", texto: r.erro });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="5511963197032"
          inputMode="numeric"
          className="max-w-[240px]"
          aria-label="WhatsApp da Ayla"
        />
        <Button onClick={salvar} disabled={pendente || !valor.trim()}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {msg && (
        <p className={msg.tipo === "ok" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
          {msg.texto}
        </p>
      )}

      {!msg && atual && (
        <p className="text-sm text-muted-foreground">
          Em uso: <strong>{legivel(atual)}</strong>
        </p>
      )}

      {!atual && (
        <p className="text-sm text-amber-700">
          Nenhum número configurado — o botão &ldquo;falar com a Ayla&rdquo; não aparece pra quem
          termina o cadastro.
        </p>
      )}
    </div>
  );
}
