"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaywallAssine } from "@/components/paywall-assine";
import { criarConversa } from "./actions";

/**
 * Form principal de Estratégias. Seletor de criança e CTA destacados.
 * Enter NÃO envia — a pessoa escreve livremente e aperta "Conversar".
 */
export function ConversarForm({
  membros,
  initialMembroId,
  tema,
}: {
  membros: Array<{ id: string; nome: string }>;
  initialMembroId?: string;
  /** Quando vem de um card do Kolo Vivo: guia a pergunta sem pré-preencher. */
  tema?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [membroId, setMembroId] = useState<string>(
    initialMembroId ?? membros[0]?.id ?? "",
  );
  const [texto, setTexto] = useState("");
  const placeholder = tema
    ? `Conte o desafio atual com ${tema.toLowerCase()} — o que acontece no dia a dia — e depois aperte Conversar.`
    : "Escreva à vontade o que está acontecendo. Quando terminar, é só apertar Conversar.";

  function submit() {
    if (!texto.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await criarConversa({
          membroAtipicoId: membroId || null,
          texto,
        });
        if ("erro" in res) {
          if (res.assinatura) setBloqueado(true);
          else setError(res.erro);
          return;
        }
        router.push(`/conversar/${res.conversaId}`);
      } catch (e) {
        setError(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      }
    });
  }

  if (bloqueado) return <PaywallAssine />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {membros.length > 0 && (
        <select
          id="membro"
          aria-label="Sobre quem é?"
          className="h-10 w-fit rounded-full border border-brand-purple/20 bg-white px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand-purple/40 focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
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

      {tema && (
        <p className="text-sm font-medium text-foreground">
          Sobre <span className="text-brand-purple">{tema}</span> — conte o desafio
          atual:
        </p>
      )}

      <textarea
        id="texto"
        rows={5}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-2xl border border-foreground/[0.08] bg-white/70 px-4 py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        disabled={pending}
      />

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" size="lg" disabled={pending || !texto.trim()}>
          {pending ? "Pensando..." : "Conversar"}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
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
