"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { enviarMensagem } from "./actions";

/**
 * Form principal de Estratégias (P-EST-3 + P-EST-7):
 * sem Labels, select compacto integrado, textarea editorial,
 * botão "Conversar →" em vez de "Enviar". Disclaimer movido pro
 * rodapé pra não roubar atenção do CTA.
 */
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
        <select
          id="membro"
          aria-label="Sobre quem é?"
          className="h-9 w-fit rounded-full bg-transparent px-1 text-sm text-muted-foreground focus:outline-none focus:ring-0"
          value={membroId}
          onChange={(e) => setMembroId(e.target.value)}
        >
          <option value="">Sobre a família em geral</option>
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              Sobre {m.nome}
            </option>
          ))}
        </select>
      )}

      <textarea
        id="texto"
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex: Ele teve uma crise grande agora pela tarde, do nada. Não sei o que aconteceu."
        className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        disabled={pending}
      />

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending || !texto.trim()}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-brand-purple hover:bg-transparent hover:text-brand-purple-dark",
          )}
        >
          {pending ? "Pensando..." : "Conversar"}
          {!pending && <ArrowRight className="size-3" aria-hidden />}
        </Button>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/60">
        Kolo Família não substitui profissionais da saúde.
      </p>
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
