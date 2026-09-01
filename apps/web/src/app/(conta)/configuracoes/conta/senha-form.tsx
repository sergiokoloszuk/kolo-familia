"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { definirSenhaAction } from "./actions";

/**
 * Cria/troca a senha AQUI, sem passar por e-mail.
 *
 * Antes este cartão só levava pro fluxo de "mando um link pro seu e-mail" — e
 * isso quebrava de dois jeitos pra quem vive no WhatsApp: (1) o e-mail pode nem
 * chegar (endereço com typo, caixa que ela não abre), e (2) o token do e-mail e
 * o link de acesso da Ayla dividem o MESMO slot no Supabase e se matam — tocar
 * num link da Ayla enquanto o e-mail de redefinição está pendente derruba o
 * e-mail. Quem já está logada não precisa de nada disso: define a senha e
 * pronto.
 */
export function SenhaForm() {
  const [pending, startTransition] = useTransition();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "erro"; msg: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (senha.length < 8) {
      setFeedback({ kind: "erro", msg: "A senha precisa ter pelo menos 8 caracteres." });
      return;
    }
    if (senha !== confirmacao) {
      setFeedback({ kind: "erro", msg: "As duas senhas não são iguais." });
      return;
    }
    startTransition(async () => {
      const res = await definirSenhaAction({ senha });
      if (!res.ok) {
        setFeedback({ kind: "erro", msg: res.error });
        return;
      }
      setSenha("");
      setConfirmacao("");
      setFeedback({ kind: "ok", msg: "Senha salva 🌿 Da próxima vez dá pra entrar com ela." });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {feedback && (
        <div
          className={
            feedback.kind === "ok"
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
              : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha-nova">Nova senha</Label>
        <Input
          id="senha-nova"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="new-password"
          disabled={pending}
          placeholder="pelo menos 8 caracteres"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha-confirma">Repete a senha</Label>
        <Input
          id="senha-confirma"
          type="password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar senha"}
        </Button>
      </div>
    </form>
  );
}
