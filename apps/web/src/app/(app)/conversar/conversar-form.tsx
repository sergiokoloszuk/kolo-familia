"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { enviarMensagem } from "./actions";

export function ConversarForm({
  membros,
}: {
  membros: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [membroId, setMembroId] = useState<string>(membros[0]?.id ?? "");
  const [texto, setTexto] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const { conversaId } = await enviarMensagem({
          conversaId: null,
          membroAtipicoId: membroId || null,
          texto,
        });
        router.push(`/conversar/${conversaId}`);
      } catch (e) {
        setError(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {membros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="membro">Sobre quem é?</Label>
          <select
            id="membro"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={membroId}
            onChange={(e) => setMembroId(e.target.value)}
          >
            <option value="">Conversa geral da família</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="texto">O que aconteceu? Como posso ajudar?</Label>
        <textarea
          id="texto"
          rows={4}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex: Ele teve uma crise grande agora pela tarde, do nada. Não sei o que aconteceu."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={pending}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          O Kolo Família não substitui profissionais da saúde.
        </p>
        <Button type="submit" disabled={pending || !texto.trim()}>
          {pending ? "Pensando..." : "Enviar"}
        </Button>
      </div>
    </form>
  );
}

function traduzirErro(msg: string): string {
  if (msg.toLowerCase().includes("anthropic_api_key"))
    return "A chave da Anthropic não está configurada no servidor. Adicione ANTHROPIC_API_KEY em .env.local.";
  if (msg.toLowerCase().includes("nenhuma skill"))
    return "Skills iniciais ainda não estão no banco. Aplique a migração 0003_seed.sql.";
  return msg;
}
