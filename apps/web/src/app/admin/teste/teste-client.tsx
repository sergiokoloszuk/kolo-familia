"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetMinhaConta, resetContaPorEmail, seedExemplo, type ActionResult } from "./actions";

type Feedback = { kind: "ok" | "erro"; msg: string } | null;

export function TesteClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [email, setEmail] = useState("");

  function run(label: string, fn: () => Promise<ActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setFeedback({ kind: "ok", msg: `${label} — feito.` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.msg}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="size-4" aria-hidden /> Resetar minha conta
          </CardTitle>
          <CardDescription>
            Apaga todos os dados da sua família (membros, perfil vivo, diários,
            conversas, mensagens da Ayla) e volta pro onboarding no passo 1. Seu
            login e seu acesso de admin continuam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!confirm("Apagar TODOS os dados da sua família e voltar ao onboarding?")) return;
              run("Conta resetada", resetMinhaConta);
            }}
          >
            Resetar minha conta
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" aria-hidden /> Preencher com dados de exemplo
          </CardTitle>
          <CardDescription>
            Popula a sua família com um caso realista (2 membros, contexto,
            interesses, desafios e conquistas) e marca o onboarding como
            concluído. Útil pra ver como o painel aparece &ldquo;cheio&rdquo;.
            Refaz os membros do zero a cada clique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            disabled={pending}
            onClick={() => run("Dados de exemplo aplicados", seedExemplo)}
          >
            Preencher com dados de exemplo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="size-4" aria-hidden /> Resetar conta de outra pessoa
          </CardTitle>
          <CardDescription>
            Mesmo reset, mirando uma conta de teste específica pelo email (útil
            quando você testa em outro device ou login).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="sm:max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || !email.trim()}
            onClick={() => {
              if (!confirm(`Apagar TODOS os dados da família de ${email}?`)) return;
              run(`Conta de ${email} resetada`, () => resetContaPorEmail(email));
            }}
          >
            Resetar conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
