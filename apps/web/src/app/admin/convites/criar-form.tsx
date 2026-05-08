"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarConvites } from "./actions";

export function CriarConvitesForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string[] | null>(null);
  const [rotulo, setRotulo] = useState("");
  const [max_uses, setMaxUses] = useState(1);
  const [quantidade, setQuantidade] = useState(1);
  const [expira_dias, setExpiraDias] = useState<number | "">("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    startTransition(async () => {
      try {
        const r = await criarConvites({
          rotulo: rotulo || undefined,
          max_uses,
          quantidade,
          expira_em_dias:
            typeof expira_dias === "number" ? expira_dias : undefined,
        });
        setResultado(r.codigos);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {resultado && resultado.length > 0 && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">
            {resultado.length} código(s) criado(s):
          </p>
          <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs">
            {resultado.join("\n")}
          </pre>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rotulo">Rótulo (opcional)</Label>
          <Input
            id="rotulo"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
            placeholder="ex: lote_jan26, indicacao_X"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantidade">Quantos códigos gerar</Label>
          <Input
            id="quantidade"
            type="number"
            min={1}
            max={100}
            value={quantidade}
            onChange={(e) => setQuantidade(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="max_uses">Usos por código</Label>
          <Input
            id="max_uses"
            type="number"
            min={1}
            max={500}
            value={max_uses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expira">Expira em (dias) — opcional</Label>
          <Input
            id="expira"
            type="number"
            min={1}
            max={365}
            value={expira_dias}
            onChange={(e) =>
              setExpiraDias(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="vazio = não expira"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Gerando..." : "Gerar códigos"}
        </Button>
      </div>
    </form>
  );
}
