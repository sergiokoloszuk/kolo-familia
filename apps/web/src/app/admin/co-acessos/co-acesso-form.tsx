"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addCoAcesso, removeCoAcesso, type CoAcessoRow } from "./actions";

export function CoAcessoForm({ acessos }: { acessos: CoAcessoRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [rotulo, setRotulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function adicionar() {
    const e = email.trim();
    if (!e || pending) return;
    setErro(null);
    setOk(null);
    start(async () => {
      const r = await addCoAcesso({ email: e, rotulo: rotulo.trim() || null });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(`${e} autorizado. Peça pra pessoa se cadastrar com esse e-mail.`);
      setEmail("");
      setRotulo("");
      router.refresh();
    });
  }

  function remover(id: string) {
    if (pending) return;
    setErro(null);
    setOk(null);
    start(async () => {
      const r = await removeCoAcesso({ id });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Autorizar um e-mail</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            <Label htmlFor="email-co">E-mail</Label>
            <Input
              id="email-co"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="pessoa@agencia.com"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rotulo-co">Rótulo (opcional)</Label>
            <Input
              id="rotulo-co"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder='Ex.: "Agência X — João"'
              disabled={pending}
            />
          </div>
          <div>
            <Button type="button" onClick={adicionar} disabled={pending || !email.trim()}>
              <UserPlus className="size-4" aria-hidden /> {pending ? "Autorizando…" : "Autorizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acessos autorizados ({acessos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {acessos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum co-acesso autorizado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-foreground/[0.06]">
              {acessos.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="font-medium text-foreground">{a.email}</span>
                    {a.rotulo && <span className="text-muted-foreground">· {a.rotulo}</span>}
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (a.cadastrado
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-foreground/5 text-muted-foreground")
                      }
                    >
                      {a.cadastrado ? "ativo" : "aguardando cadastro"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(a.id)}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" /> Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
