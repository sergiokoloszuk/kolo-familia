"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrarNaListaEspera } from "./actions";

export function ListaEsperaForm() {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [contexto, setContexto] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await entrarNaListaEspera({
          nome,
          email,
          contexto: contexto.trim() || undefined,
        });
        setEnviado(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  if (enviado) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Te coloquei na lista.</p>
        <p className="mt-1 text-muted-foreground">
          Quando abrirmos novas vagas, mando um e-mail pro endereço informado
          com o código de convite. Pode demorar — agradeço a paciência.
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
        <Label htmlFor="contexto">
          Conta um pouco da sua família (opcional)
        </Label>
        <textarea
          id="contexto"
          rows={4}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          maxLength={500}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Ex: tenho um filho de 7 anos com TEA, é a primeira vez que vou tentar acompanhar a rotina dele com mais estrutura..."
        />
        <span className="text-xs text-muted-foreground">
          {contexto.length} / 500
        </span>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Entrar na lista"}
        </Button>
      </div>
    </form>
  );
}
