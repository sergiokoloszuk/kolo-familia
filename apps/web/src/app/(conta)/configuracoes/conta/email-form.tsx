"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pedirCodigoEmailAction, confirmarEmailAction } from "./actions";

/**
 * TROCAR O E-MAIL EM DUAS ETAPAS — e sem nunca pedir o endereço antigo.
 *
 * A tela anterior chamava `updateUser({ email })` e dizia "mandamos um link de
 * confirmação pro novo e-mail". Era mentira por omissão: com
 * `SECURE_EMAIL_CHANGE` ligado (PROVADO em produção, 31/08/2026), o GoTrue
 * manda DOIS e-mails e exige confirmar os DOIS. Quem tinha digitado o endereço
 * errado — a única pessoa que precisa desta tela — via "enviei o link", nunca
 * conseguia terminar, e não recebia explicação nenhuma.
 *
 * Agora: informa o endereço novo → recebe 6 dígitos NELE → digita aqui. A
 * pessoa não vê token, link, nem jargão; vê o que qualquer aplicativo faz.
 */
export function EmailForm({
  atual,
  pendente,
}: {
  atual: string;
  /** Endereço com código em aberto, se a pessoa recarregou a página no meio. */
  pendente?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [etapa, setEtapa] = useState<"email" | "codigo" | "ok">(
    pendente ? "codigo" : "email",
  );
  const [valor, setValor] = useState(pendente ?? atual);
  const [enviadoPara, setEnviadoPara] = useState(pendente ?? "");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  // Contagem do cooldown. Sem ela a pessoa fica clicando num botão que só
  // devolve erro, sem entender que é só esperar.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function pedir(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await pedirCodigoEmailAction({ email: valor });
      if (!res.ok) {
        setErro(res.error);
        const m = res.error.match(/Espera (\d+)s/);
        if (m) setEspera(Number(m[1]));
        return;
      }
      setEnviadoPara(valor.trim().toLowerCase());
      setCodigo("");
      setEtapa("codigo");
      setEspera(60);
    });
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await confirmarEmailAction({ email: enviadoPara, codigo });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setEtapa("ok");
    });
  }

  if (etapa === "ok") {
    return (
      <div
        data-testid="email-confirmado"
        className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800"
      >
        <p className="font-medium">E-mail atualizado 🌿</p>
        <p className="mt-1">
          Agora você entra com <strong>{enviadoPara}</strong> — e é para ele que
          mandamos o link se você esquecer a senha.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="email-form">
      {erro && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erro}
        </div>
      )}

      {etapa === "email" ? (
        <form onSubmit={pedir} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail de login</Label>
            <Input
              id="email"
              type="email"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoComplete="email"
              disabled={pending}
            />
            <span className="text-xs text-muted-foreground">
              Se estiver errado, escreva o certo aqui. Vamos mandar um código de
              6 números para o endereço novo — não precisamos do antigo.
            </span>
          </div>
          <div>
            <Button type="submit" disabled={pending || espera > 0}>
              {pending
                ? "Enviando…"
                : espera > 0
                  ? `Aguarde ${espera}s`
                  : "Enviar código"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmar} className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            Mandei um código de 6 números para{" "}
            <strong className="break-all">{enviadoPara}</strong>. Digite aqui
            para confirmar que a caixa é sua.
          </p>
          <Input
            id="codigo-email"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-[0.4em]"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || codigo.length < 6}>
            {pending ? "Confirmando…" : "Confirmar e-mail"}
          </Button>
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={(e) => {
                if (espera > 0) return;
                pedir(e);
              }}
              disabled={pending || espera > 0}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            >
              {espera > 0 ? `Reenviar em ${espera}s` : "Não chegou? Reenviar"}
            </button>
            <button
              type="button"
              onClick={() => {
                // Trocar o endereço invalida o desafio anterior no servidor: o
                // código é amarrado ao e-mail para que um não confirme o outro.
                setEtapa("email");
                setCodigo("");
                setErro(null);
              }}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Usar outro e-mail
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
