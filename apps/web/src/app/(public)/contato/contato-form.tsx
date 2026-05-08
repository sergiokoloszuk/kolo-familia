"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarContato } from "./actions";

export function ContatoForm() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await enviarContato({ nome, email, mensagem });
        setEnviado(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  if (enviado) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Recebemos sua mensagem.</p>
        <p className="mt-1 text-muted-foreground">
          Respondemos em até 2 dias úteis no e-mail informado. Obrigada por
          escrever.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mensagem">Mensagem</Label>
        <textarea
          id="mensagem"
          rows={6}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Pode contar o que está pesando, o que faz sentido, o que você gostaria de ver no Kolo."
        />
        <span className="text-xs text-muted-foreground">
          {mensagem.length} / 2000
        </span>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
