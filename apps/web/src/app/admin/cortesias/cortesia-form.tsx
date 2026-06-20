"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { grantCortesia, revokeCortesia, type CortesiaRow } from "./actions";

const PERIODOS: { label: string; dias: number | null }[] = [
  { label: "Vitalícia", dias: null },
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
  { label: "180 dias", dias: 180 },
  { label: "1 ano", dias: 365 },
];

function fmt(ate: string | null): string {
  if (!ate) return "vitalícia";
  const d = new Date(ate);
  const expirado = d.getTime() < Date.now();
  return `${expirado ? "expirou em" : "até"} ${d.toLocaleDateString("pt-BR")}`;
}

export function CortesiaForm({ cortesias }: { cortesias: CortesiaRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function conceder() {
    const e = email.trim();
    if (!e || pending) return;
    setErro(null);
    setOk(null);
    start(async () => {
      const r = await grantCortesia({ email: e, dias: PERIODOS[periodoIdx].dias });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(`Cortesia concedida a ${e}.`);
      setEmail("");
      router.refresh();
    });
  }

  function remover(e: string) {
    if (pending) return;
    setErro(null);
    setOk(null);
    start(async () => {
      const r = await revokeCortesia({ email: e });
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
          <CardTitle className="text-base">Conceder cortesia</CardTitle>
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
            <Label htmlFor="email-cortesia">E-mail da conta</Label>
            <Input
              id="email-cortesia"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && conceder()}
              placeholder="pessoa@exemplo.com"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Período</Label>
            <div className="flex flex-wrap gap-2">
              {PERIODOS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPeriodoIdx(i)}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                    (i === periodoIdx
                      ? "border-brand-purple bg-brand-purple text-white"
                      : "border-input bg-white text-foreground hover:border-brand-purple/40")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Button type="button" onClick={conceder} disabled={pending || !email.trim()}>
              <Gift className="size-4" aria-hidden /> {pending ? "Concedendo…" : "Conceder cortesia"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A pessoa precisa já ter conta. Se ainda não tiver, peça pra criar (ela define a
            senha) e conceda depois.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cortesias ativas ({cortesias.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cortesias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cortesia concedida ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-foreground/[0.06]">
              {cortesias.map((c) => (
                <li key={c.email} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-emerald-600" aria-hidden />
                    <span className="font-medium text-foreground">{c.email}</span>
                    <span className="text-muted-foreground">· {fmt(c.ate)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(c.email)}
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
