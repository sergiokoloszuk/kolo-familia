"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sincronizarStripe } from "./actions";

export function SincronizarStripeForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function sincronizar() {
    const e = email.trim();
    if (!e || pending) return;
    setErro(null);
    setOk(null);
    start(async () => {
      const r = await sincronizarStripe({ email: e });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(r.resumo);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sincronizar assinatura com o Stripe</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Quando o pagamento consta no Stripe mas o app não liberou (o webhook não chegou),
          isto busca o status <strong>ao vivo no Stripe</strong> e corrige a conta. Não inventa
          nada — só reflete o que o Stripe diz.
        </p>
        {erro && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            {ok}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email-sync">E-mail da conta</Label>
          <Input
            id="email-sync"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sincronizar()}
            placeholder="pessoa@exemplo.com"
            disabled={pending}
          />
        </div>
        <div>
          <Button type="button" onClick={sincronizar} disabled={pending || !email.trim()}>
            <RefreshCw className="size-4" aria-hidden /> {pending ? "Sincronizando…" : "Sincronizar com o Stripe"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
